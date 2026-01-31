// WebGL Post-Processing Manager
// Handles radial blur shader rendering

const vertexShaderSource = `
// Vertex shader for radial blur post-processing
// Simple passthrough that sets up texture coordinates

attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    // Flip Y coordinate because WebGL texture coordinates are inverted
    v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

const fragmentShaderSource = `
// Fragment shader for radial blur effect
// Applies variable blur based on distance from center

precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_blurIntensity; // 0.0 = no blur, 1.0 = max blur
uniform float u_centerRadius;   // 0.45 = 45% clear center
uniform float u_maxBlurRadius;  // max blur in pixels (25.0)

varying vec2 v_texCoord;

// easeOut curve for smooth falloff
float easeOut(float t) {
    return 1.0 - pow(1.0 - t, 3.0);
}

// Optimized Gaussian blur using smart sampling
vec4 gaussianBlur(sampler2D tex, vec2 uv, vec2 direction, float blurAmount) {
    if (blurAmount < 0.5) {
        return texture2D(tex, uv);
    }
    
    vec4 color = vec4(0.0);
    vec2 pixelSize = 1.0 / u_resolution;
    
    // Dynamic sample count based on blur amount (performance optimization)
    int samples = int(clamp(blurAmount * 0.5, 3.0, 12.0));
    
    // Gaussian weights for quality blur
    float weights[12];
    weights[0] = 0.2270270270;
    weights[1] = 0.1945945946;
    weights[2] = 0.1216216216;
    weights[3] = 0.0540540541;
    weights[4] = 0.0162162162;
    weights[5] = 0.0108108108;
    weights[6] = 0.0054054054;
    weights[7] = 0.0027027027;
    weights[8] = 0.0013513514;
    weights[9] = 0.0006756757;
    weights[10] = 0.0003378378;
    weights[11] = 0.0001689189;
    
    // Center sample
    color += texture2D(tex, uv) * weights[0];
    float totalWeight = weights[0];
    
    // Sample in both directions
    for (int i = 1; i < 12; i++) {
        if (i >= samples) break;
        
        float offset = float(i) * blurAmount * 0.5;
        vec2 sampleOffset = direction * pixelSize * offset;
        
        color += texture2D(tex, uv + sampleOffset) * weights[i];
        color += texture2D(tex, uv - sampleOffset) * weights[i];
        totalWeight += weights[i] * 2.0;
    }
    
    return color / totalWeight;
}

void main() {
    // Calculate normalized position from center (-1 to 1)
    vec2 centerPos = (v_texCoord - 0.5) * 2.0;
    
    // Account for aspect ratio to get circular blur
    float aspectRatio = u_resolution.x / u_resolution.y;
    centerPos.x *= aspectRatio;
    
    // Calculate radial distance from center
    float dist = length(centerPos);
    
    // Calculate blur amount based on distance
    // 0.0 in center (< centerRadius), smoothly increasing to edges
    float distFromCenter = max(0.0, dist - u_centerRadius);
    float normalizedDist = distFromCenter / (1.0 - u_centerRadius);
    
    // Apply easeOut curve for natural falloff
    float blurFactor = easeOut(clamp(normalizedDist, 0.0, 1.0));
    
    // Final blur amount in pixels
    float blurAmount = blurFactor * u_blurIntensity * u_maxBlurRadius;
    
    // Two-pass blur for better quality and performance
    // Horizontal pass
    vec4 blurredH = gaussianBlur(u_texture, v_texCoord, vec2(1.0, 0.0), blurAmount);
    
    // For max performance, we do a single-pass approximation
    // by sampling diagonally as well
    vec4 blurredV = gaussianBlur(u_texture, v_texCoord, vec2(0.0, 1.0), blurAmount);
    vec4 blurredD1 = gaussianBlur(u_texture, v_texCoord, vec2(0.707, 0.707), blurAmount * 0.7);
    vec4 blurredD2 = gaussianBlur(u_texture, v_texCoord, vec2(0.707, -0.707), blurAmount * 0.7);
    
    // Combine all directions for smooth radial blur
    vec4 finalBlur = (blurredH + blurredV + blurredD1 + blurredD2) * 0.25;
    
    // Blend between original and blurred based on blur amount
    vec4 original = texture2D(u_texture, v_texCoord);
    gl_FragColor = mix(original, finalBlur, min(blurFactor, 1.0));
}
`;

export interface RadialBlurParams {
  intensity: number;      // 0.0 - 1.0
  centerRadius: number;   // 0.0 - 1.0 (default 0.45)
  maxBlurRadius: number;  // pixels (default 25.0)
}

export class WebGLPostProcessor {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private sourceTexture: WebGLTexture | null = null;
  
  // Attribute locations
  private positionLocation: number = -1;
  private texCoordLocation: number = -1;
  
  // Uniform locations
  private textureLocation: WebGLUniformLocation | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private blurIntensityLocation: WebGLUniformLocation | null = null;
  private centerRadiusLocation: WebGLUniformLocation | null = null;
  private maxBlurRadiusLocation: WebGLUniformLocation | null = null;
  
  // Buffers
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  
  // Parameters
  private params: RadialBlurParams = {
    intensity: 0.0,
    centerRadius: 0.45,
    maxBlurRadius: 25.0
  };
  
  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    
    this.gl = gl;
    this.initialize();
  }
  
  private initialize(): void {
    const gl = this.gl;
    
    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // Create program
    this.program = gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create WebGL program');
    }
    
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program);
      throw new Error('Failed to link program: ' + info);
    }
    
    // Get attribute locations
    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
    this.texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
    
    // Get uniform locations
    this.textureLocation = gl.getUniformLocation(this.program, 'u_texture');
    this.resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    this.blurIntensityLocation = gl.getUniformLocation(this.program, 'u_blurIntensity');
    this.centerRadiusLocation = gl.getUniformLocation(this.program, 'u_centerRadius');
    this.maxBlurRadiusLocation = gl.getUniformLocation(this.program, 'u_maxBlurRadius');
    
    // Create buffers
    this.setupBuffers();
    
    // Create texture
    this.sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  
  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Failed to compile shader: ' + info);
    }
    
    return shader;
  }
  
  private setupBuffers(): void {
    const gl = this.gl;
    
    // Full-screen quad position buffer
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);
    
    // Texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);
  }
  
  public setParams(params: Partial<RadialBlurParams>): void {
    this.params = { ...this.params, ...params };
  }
  
  public render(sourceCanvas: HTMLCanvasElement): void {
    const gl = this.gl;
    
    // Ensure canvas size matches
    if (gl.canvas.width !== sourceCanvas.width || gl.canvas.height !== sourceCanvas.height) {
      gl.canvas.width = sourceCanvas.width;
      gl.canvas.height = sourceCanvas.height;
    }
    
    // Upload source canvas to texture
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sourceCanvas
    );
    
    // Setup rendering
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use program
    gl.useProgram(this.program);
    
    // Bind position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Bind texcoord attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.textureLocation, 0);
    
    gl.uniform2f(this.resolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(this.blurIntensityLocation, this.params.intensity);
    gl.uniform1f(this.centerRadiusLocation, this.params.centerRadius);
    gl.uniform1f(this.maxBlurRadiusLocation, this.params.maxBlurRadius);
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  
  public destroy(): void {
    const gl = this.gl;
    
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.sourceTexture) {
      gl.deleteTexture(this.sourceTexture);
    }
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
    }
    if (this.texCoordBuffer) {
      gl.deleteBuffer(this.texCoordBuffer);
    }
  }
}
