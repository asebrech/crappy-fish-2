/**
 * Multiplayer Battle Royale Game Renderer
 * Renders game state received from the server
 */

import { GameState, PlayerState, PipeState } from './MultiplayerClient';
import SpriteDestructor from '../core/lib/sprite-destructor';
import { WebGLPostProcessor } from '../rendering/WebGLPostProcessor';

// Custom bird sprites (neutral, down, up)
const CUSTOM_BIRD_SPRITES = ['bird-blue-up', 'bird-blue-mid', 'bird-blue-down'];

export class BattleRoyaleRenderer {
  private canvas: HTMLCanvasElement;
  private renderCanvas: HTMLCanvasElement; // Offscreen canvas for 2D rendering
  private context: CanvasRenderingContext2D;
  private canvasSize: { width: number; height: number };
  private mySessionId: string = "";
  private animationFrame: number = 0;
  private platformOffset: number = 0;

  // WebGL post-processing
  private postProcessor: WebGLPostProcessor | null = null;

  // Visual feedback tracking
  private lastLivesCount: number = 2; // Track lives to detect when player loses a life
  private lifeFlashEndTime: number = 0; // When to stop the red flash effect

  // Cached sprites
  private birdSprites: Map<string, HTMLImageElement> = new Map();
  private gasBoostSprite: HTMLImageElement | null = null;
  private maskSprite: HTMLImageElement | null = null;
  private pipeSprites: { top: HTMLImageElement | null; bottom: HTMLImageElement | null } = { top: null, bottom: null };
  private backgroundSprite: HTMLImageElement | null = null;
  private platformSprite: HTMLImageElement | null = null;
  private gasTrails: Array<{ x: number; y: number; timestamp: number }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvasSize = { width: canvas.width, height: canvas.height };

    // Create offscreen canvas for 2D rendering
    this.renderCanvas = document.createElement('canvas');
    this.renderCanvas.width = canvas.width;
    this.renderCanvas.height = canvas.height;
    this.context = this.renderCanvas.getContext('2d', { alpha: false })!;
    
    // Initialize WebGL post-processor on the display canvas
    try {
      this.postProcessor = new WebGLPostProcessor(this.canvas);
    } catch (e) {
      console.error('Failed to initialize WebGL post-processor:', e);
      // Fallback: use the display canvas for 2D rendering
      this.context = this.canvas.getContext('2d', { alpha: false })!;
    }
  }

  setSessionId(sessionId: string): void {
    this.mySessionId = sessionId;
  }

  onFlap(playerY: number): void {
    // Add gas trail slightly behind player position (x=0.3 in normalized coordinates)
    this.gasTrails.push({
      x: 0.25, // Slightly behind player (player is at 0.3)
      y: playerY,
      timestamp: Date.now()
    });
  }

  loadSprites(): void {
    // Load custom bird sprites
    for (let i = 0; i < CUSTOM_BIRD_SPRITES.length; i++) {
      try {
        const sprite = SpriteDestructor.asset(CUSTOM_BIRD_SPRITES[i]);
        this.birdSprites.set(`custom.${i}`, sprite);
      } catch (e) {
        console.warn(`Failed to load sprite ${CUSTOM_BIRD_SPRITES[i]}`);
      }
    }

    // Load gas boost sprite
    try {
      this.gasBoostSprite = SpriteDestructor.asset('bird-gas-boost');
    } catch (e) {
      console.warn('Failed to load gas boost sprite');
    }

    // Load mask sprite (collectible item)
    this.maskSprite = new Image();
    this.maskSprite.src = '/game-assets/mask_degeulasse.png';

    // Load pipe sprites
    try {
      this.pipeSprites.top = SpriteDestructor.asset('pipe-green-top');
      this.pipeSprites.bottom = SpriteDestructor.asset('pipe-green-bottom');
    } catch (e) {
      console.warn('Failed to load pipe sprites');
    }

    // Load background
    try {
      this.backgroundSprite = SpriteDestructor.asset('theme-day');
    } catch (e) {
      console.warn('Failed to load background sprite');
    }

    // Load platform
    try {
      this.platformSprite = SpriteDestructor.asset('platform');
    } catch (e) {
      console.warn('Failed to load platform sprite');
    }
  }

  resize(width: number, height: number): void {
    this.canvasSize = { width, height };
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Also resize offscreen render canvas
    if (this.renderCanvas) {
      this.renderCanvas.width = width;
      this.renderCanvas.height = height;
    }
  }

  render(state: GameState): void {
    this.animationFrame++;
    
    const ctx = this.context;
    const { width, height } = this.canvasSize;

    // Synchronize platform offset with server game time (60 FPS tick rate)
    if (state.phase === "playing") {
      this.platformOffset = state.gameTime * state.gameSpeed * 0.06;
      
      // Update gas trails - move them left at same speed as pipes
      this.gasTrails.forEach(trail => {
        trail.x -= state.gameSpeed;
      });
      
      // Remove trails that are off-screen or too old
      this.gasTrails = this.gasTrails.filter(trail => 
        trail.x > -0.2 && (Date.now() - trail.timestamp) < 1500
      );
    }

    // Get local player for vision-based effects
    const players = Array.from(state.players.values());
    const myPlayer = players.find(p => p.id === this.mySessionId);

    // Detect if player lost a life and trigger flash effect
    if (myPlayer && myPlayer.lives < this.lastLivesCount && myPlayer.alive) {
      this.lifeFlashEndTime = Date.now() + 300; // Flash for 300ms
      this.lastLivesCount = myPlayer.lives;
    }
    
    // Reset lives counter if game restarted
    if (myPlayer && state.phase === "countdown") {
      this.lastLivesCount = myPlayer.lives;
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    // Draw background
    this.drawBackground(ctx, width, height);

    // Draw pipes
    state.pipes.forEach(pipe => {
      this.drawPipe(ctx, pipe, width, height);
    });

    // Draw platform
    this.drawPlatform(ctx, width, height);

    // Draw gas trails (behind players)
    this.drawGasTrails(ctx, width, height);

    // Draw all players (other players first, then local player on top)
    // Skip spectating players - they don't have a bird in the game
    const otherPlayers = players.filter(p => p.id !== this.mySessionId && !p.isSpectating);

    // Draw other players (slightly transparent)
    otherPlayers.forEach(player => {
      this.drawBird(ctx, player, width, height, 0.7);
    });

    // Draw local player (if not spectating)
    if (myPlayer && !myPlayer.isSpectating) {
      this.drawBird(ctx, myPlayer, width, height, 1.0);
    }

    // Draw underwater color overlay (tint effect) - only during active gameplay (not for spectators)
    if (state.phase === "playing" && myPlayer && myPlayer.alive && !myPlayer.isSpectating) {
      this.drawUnderwaterTintOverlay(ctx, myPlayer.vision, width, height);
    }
    
    // Draw red flash overlay when player loses a life
    if (Date.now() < this.lifeFlashEndTime) {
      const flashAlpha = 0.5 * (this.lifeFlashEndTime - Date.now()) / 300; // Fade out
      ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw UI overlay
    this.drawUI(ctx, state, width, height);

    // Apply WebGL radial blur post-processing (not for spectators)
    if (this.postProcessor && state.phase === "playing" && myPlayer && myPlayer.alive && !myPlayer.isSpectating) {
      const intensity = 1.0 - myPlayer.vision;
      
      // Update blur parameters based on vision (more aggressive settings)
      this.postProcessor.setParams({
        intensity: intensity,
        centerRadius: 0.25,    // Reduced from 0.45 to 0.25 - blur comes much closer to center
        maxBlurRadius: 40.0    // Increased from 25 to 40px - much stronger blur at edges
      });
      
      // Render offscreen Canvas2D output through WebGL shader to display canvas
      this.postProcessor.render(this.renderCanvas);
      
      // Debug log
      if (this.animationFrame % 60 === 0) {
        console.log('Vision:', myPlayer.vision.toFixed(2), 'Blur intensity:', intensity.toFixed(2));
      }
    } else if (this.postProcessor) {
      // No blur during waiting, countdown, finished, or when dead
      this.postProcessor.setParams({ intensity: 0 });
      this.postProcessor.render(this.renderCanvas);
    } else {
      // Fallback: copy renderCanvas to display canvas if WebGL failed
      const displayCtx = this.canvas.getContext('2d');
      if (displayCtx) {
        displayCtx.drawImage(this.renderCanvas, 0, 0);
      }
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.backgroundSprite) {
      ctx.drawImage(this.backgroundSprite, 0, 0, width, height);
    } else {
      // Fallback gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#E0F6FF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const platformHeight = height * 0.15;
    const platformY = height - platformHeight;

    if (this.platformSprite) {
      // Tile the platform sprite with scrolling offset
      const tileWidth = platformHeight * 2;
      const offsetPixels = -(this.platformOffset * width) % tileWidth;
      
      for (let x = offsetPixels; x < width; x += tileWidth) {
        ctx.drawImage(this.platformSprite, x, platformY, tileWidth, platformHeight);
      }
    } else {
      // Fallback solid color
      ctx.fillStyle = '#DEB887';
      ctx.fillRect(0, platformY, width, platformHeight);
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, platformY, width, 5);
    }
  }

  private drawPipe(ctx: CanvasRenderingContext2D, pipe: PipeState, width: number, height: number): void {
    const pipeWidth = width * 0.1;
    const pipeX = pipe.x * width - pipeWidth / 2;
    const platformHeight = height * 0.15;
    const platformY = height - platformHeight;

    // Sort holes by Y position for rendering
    const sortedHoles = [...pipe.holes].sort((a, b) => a.y - b.y);
    
    // Draw pipe sections between holes
    let lastY = 0;
    
    for (let i = 0; i < sortedHoles.length; i++) {
      const hole = sortedHoles[i];
      const gapCenterY = hole.y * height;
      const gapHeight = hole.size * height;
      const gapTop = gapCenterY - gapHeight / 2;
      const gapBottom = gapCenterY + gapHeight / 2;
      
      // Draw pipe section above this hole
      if (gapTop > lastY) {
        this.drawPipeSection(ctx, pipeX, lastY, pipeWidth, gapTop - lastY, 'top');
      }
      
      // Draw item if present and not collected by this player
      if (hole.hasItem && !hole.itemCollectedBy.includes(this.mySessionId)) {
        this.drawItem(ctx, pipeX + pipeWidth / 2, gapCenterY, width);
      }
      
      lastY = gapBottom;
    }
    
    // Draw pipe section from last hole to platform
    if (lastY < platformY) {
      this.drawPipeSection(ctx, pipeX, lastY, pipeWidth, platformY - lastY, 'bottom');
    }
  }

  private drawPipeSection(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    pipeWidth: number, 
    sectionHeight: number, 
    type: 'top' | 'bottom'
  ): void {
    if (this.pipeSprites[type]) {
      // Draw pipe sprite (tiled if necessary)
      ctx.drawImage(this.pipeSprites[type]!, x, y, pipeWidth, sectionHeight);
    } else {
      // Fallback: Draw pipe with gradient
      const gradient = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
      gradient.addColorStop(0, '#4A9D2F');
      gradient.addColorStop(0.5, '#5BBD3B');
      gradient.addColorStop(1, '#4A9D2F');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, pipeWidth, sectionHeight);
      
      // Pipe edges
      ctx.fillStyle = '#3A7D1F';
      ctx.fillRect(x, y, 4, sectionHeight); // Left edge
      ctx.fillStyle = '#6FD74F';
      ctx.fillRect(x + pipeWidth - 4, y, 4, sectionHeight); // Right edge
    }
  }

  private drawItem(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
    const itemSize = width * 0.06; // Bigger size for the mask
    const time = this.animationFrame * 0.1;
    
    ctx.save();
    
    // Pulsing effect
    const pulseScale = 1 + Math.sin(time) * 0.15;
    
    // Slight wobble effect (no full rotation for the mask)
    const wobble = Math.sin(time * 0.8) * 0.1;
    
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.scale(pulseScale, pulseScale);
    
    // Draw the mask sprite
    if (this.maskSprite && this.maskSprite.complete) {
      const maskWidth = itemSize * 2;
      const maskHeight = itemSize * 2;
      ctx.drawImage(this.maskSprite, -maskWidth / 2, -maskHeight / 2, maskWidth, maskHeight);
    } else {
      // Fallback: Draw golden star if mask not loaded
      this.drawStar(ctx, 0, 0, 5, itemSize, itemSize * 0.5);
    }
    
    ctx.restore();
  }

  private drawStar(
    ctx: CanvasRenderingContext2D, 
    cx: number, 
    cy: number, 
    spikes: number, 
    outerRadius: number, 
    innerRadius: number
  ): void {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    
    // Golden gradient
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFA500');
    gradient.addColorStop(1, '#FF8C00');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Outline
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawUnderwaterTintOverlay(
    ctx: CanvasRenderingContext2D,
    vision: number,
    width: number,
    height: number
  ): void {
    // Calculate intensity (inverse of vision)
    const intensity = 1.0 - vision;
    
    if (intensity < 0.01) return; // Skip if vision is near perfect
    
    // Save current canvas state
    ctx.save();
    
    // Create underwater color tint overlay (blue-green)
    const tintOpacity = intensity * 0.25;
    
    // Animated wave effect
    const waveOffset = Math.sin(this.animationFrame * 0.03) * 30 * intensity;
    const waveOffset2 = Math.cos(this.animationFrame * 0.05) * 20 * intensity;
    
    // Draw multiple gradient layers for underwater depth effect
    const gradient1 = ctx.createRadialGradient(
      width / 2 + waveOffset, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.8
    );
    gradient1.addColorStop(0, `rgba(80, 160, 200, ${tintOpacity * 0.2})`);
    gradient1.addColorStop(1, `rgba(20, 100, 150, ${tintOpacity * 0.6})`);
    
    ctx.fillStyle = gradient1;
    ctx.fillRect(0, 0, width, height);
    
    // Second wave layer for more depth
    const gradient2 = ctx.createRadialGradient(
      width / 2 - waveOffset2, height / 2 + waveOffset, 0,
      width / 2, height / 2, Math.max(width, height) * 0.6
    );
    gradient2.addColorStop(0, `rgba(100, 180, 220, ${tintOpacity * 0.15})`);
    gradient2.addColorStop(1, `rgba(40, 120, 180, ${tintOpacity * 0.4})`);
    
    ctx.fillStyle = gradient2;
    ctx.fillRect(0, 0, width, height);
    
    ctx.restore();
  }

  private drawBird(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    width: number,
    height: number,
    alpha: number
  ): void {
    const birdX = width * 0.3; // Fixed X position
    const birdY = player.y * height;
    const birdWidth = width * 0.25; // GIGANTIC BIRD MODE 🐦
    const birdHeight = birdWidth * 0.45; // Fixed aspect ratio (avg of sprites: ~125x55 → 0.44)

    // Check if player is invulnerable
    const isInvulnerable = Date.now() - player.lastHitTime < 2000;
    const glowIntensity = isInvulnerable ? (Math.sin(Date.now() / 100) * 0.5 + 0.5) : 0;

    // Get wing state based on animation (use custom sprite instead of color-based)
    const wingState = player.alive ? Math.floor(this.animationFrame / 5) % 3 : 1;
    const spriteKey = `custom.${wingState}`;
    const sprite = this.birdSprites.get(spriteKey);

    ctx.save();
    
    // Add glowing effect when invulnerable
    if (isInvulnerable && player.alive) {
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20 + glowIntensity * 15;
    }
    
    ctx.globalAlpha = player.alive ? alpha : 0.4;
    ctx.translate(birdX, birdY);
    ctx.rotate((player.rotation * Math.PI) / 180);

    if (sprite) {
      ctx.drawImage(sprite, -birdWidth / 2, -birdHeight / 2, birdWidth, birdHeight);
    } else {
      // Fallback circle
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, birdWidth / 2, birdHeight / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // Draw player name above bird
    if (player.alive) {
      ctx.save();
      ctx.fillStyle = player.id === this.mySessionId ? '#FFD700' : '#FFFFFF';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      const nameY = birdY - birdHeight - 5;
      ctx.strokeText(player.name, birdX, nameY);
      ctx.fillText(player.name, birdX, nameY);
      ctx.restore();
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean): void {
    ctx.save();
    
    // Scale for heart size
    const scale = size / 20;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Draw heart shape
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-10, -5, -10, -10, 0, -15);
    ctx.bezierCurveTo(10, -10, 10, -5, 0, 3);
    
    if (filled) {
      ctx.fill();
    } else {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();
  }

  private drawUI(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    ctx.save();

    // Draw phase-specific UI
    switch (state.phase) {
      case 'waiting':
        this.drawWaitingUI(ctx, state, width, height);
        break;
      case 'countdown':
        this.drawCountdownUI(ctx, state, width, height);
        break;
      case 'playing':
        this.drawPlayingUI(ctx, state, width, height);
        break;
      case 'finished':
        this.drawFinishedUI(ctx, state, width, height);
        break;
    }

    ctx.restore();
  }

  private drawWaitingUI(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CRAPPY FISH 2 ROYALE', width / 2, height * 0.3);

    // Player count
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Players: ${state.totalPlayers}`, width / 2, height * 0.45);
    ctx.fillText('Waiting for players...', width / 2, height * 0.55);
    ctx.font = '16px Arial';
    ctx.fillText('(Need at least 2 players to start)', width / 2, height * 0.65);
  }

  private drawCountdownUI(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Check if local player is spectating
    const myPlayer = state.players.get(this.mySessionId);
    
    if (myPlayer && myPlayer.isSpectating) {
      // Spectator joined during countdown
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SPECTATING', width / 2, height * 0.35);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px Arial';
      ctx.fillText(`Game starting in ${state.countdown}...`, width / 2, height / 2);
      
      ctx.fillStyle = '#AAAAAA';
      ctx.font = '16px Arial';
      ctx.fillText('You will join the next round', width / 2, height * 0.6);
    } else {
      // Normal countdown for active players
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.countdown.toString(), width / 2, height / 2);

      ctx.font = '24px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('GET READY!', width / 2, height * 0.35);
    }
  }

  private drawPlayingUI(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    // Players alive counter (top left)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 120, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Alive: ${state.playersAlive}/${state.totalPlayers}`, 20, 35);

    // My score (top right)
    const myPlayer = state.players.get(this.mySessionId);
    if (myPlayer) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(width - 100, 10, 90, 40);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(myPlayer.score.toString(), width - 55, 38);
      
      // Vision indicator (top right, below score)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(width - 100, 60, 90, 30);
      const visionPercent = Math.round(myPlayer.vision * 100);
      const visionColor = myPlayer.vision > 0.5 ? '#00FF00' : myPlayer.vision > 0.25 ? '#FFFF00' : '#FF4444';
      ctx.fillStyle = visionColor;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`Vision: ${visionPercent}%`, width - 55, 80);
      
      // Lives indicator (top right, below vision)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(width - 100, 100, 90, 35);
      
      // Draw hearts based on lives remaining
      const heartSize = 20;
      const heartSpacing = 25;
      const startX = width - 75;
      const heartY = 120;
      
      // Check if player is invulnerable (flashing effect)
      const isInvulnerable = Date.now() - myPlayer.lastHitTime < 2000;
      const flash = isInvulnerable && Math.floor(Date.now() / 200) % 2 === 0;
      
      for (let i = 0; i < 2; i++) {
        const x = startX + (i * heartSpacing);
        
        if (i < myPlayer.lives) {
          // Full heart - alive
          if (myPlayer.lives === 2) {
            ctx.fillStyle = flash ? '#FFD700' : '#00FF00'; // Green hearts (or gold when flashing)
          } else if (myPlayer.lives === 1) {
            ctx.fillStyle = flash ? '#FFD700' : '#FF9900'; // Orange heart (or gold when flashing)
          }
          this.drawHeart(ctx, x, heartY, heartSize, true);
        } else {
          // Empty heart - lost
          ctx.fillStyle = '#444444';
          this.drawHeart(ctx, x, heartY, heartSize, false);
        }
      }
      
      // "-1 LIFE" popup text when player loses a life
      if (Date.now() < this.lifeFlashEndTime) {
        const popupAlpha = (this.lifeFlashEndTime - Date.now()) / 300; // Fade out
        const popupY = height * 0.35 - (1 - popupAlpha) * 50; // Rise up as it fades
        
        ctx.save();
        ctx.globalAlpha = popupAlpha;
        ctx.fillStyle = '#FF4444';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText('-1 LIFE', width / 2, popupY);
        ctx.fillText('-1 LIFE', width / 2, popupY);
        
        // Show lives remaining
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = myPlayer.lives > 0 ? '#FFD700' : '#FF4444';
        const remainingText = myPlayer.lives > 0 ? `${myPlayer.lives} LEFT` : 'GAME OVER';
        ctx.strokeText(remainingText, width / 2, popupY + 50);
        ctx.fillText(remainingText, width / 2, popupY + 50);
        ctx.restore();
      }
    }

    // "YOU DIED" message if eliminated
    if (myPlayer && !myPlayer.alive) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, height * 0.4, width, height * 0.2);
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('YOU DIED!', width / 2, height * 0.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px Arial';
      ctx.fillText(`Rank: #${myPlayer.rank}`, width / 2, height * 0.55);
    }

    // Spectator UI - show when player joined mid-game
    if (myPlayer && myPlayer.isSpectating) {
      // Semi-transparent overlay at top
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, height * 0.35, width, height * 0.25);
      
      // "SPECTATING" banner
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SPECTATING', width / 2, height * 0.45);
      
      // Info text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '18px Arial';
      ctx.fillText('You joined while a game was in progress', width / 2, height * 0.52);
      ctx.fillStyle = '#AAAAAA';
      ctx.font = '16px Arial';
      ctx.fillText('Waiting for next round...', width / 2, height * 0.57);
    }
  }

  private drawFinishedUI(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    const winner = state.players.get(state.winnerId);
    const isWinner = state.winnerId === this.mySessionId;

    if (isWinner) {
      // Victory screen
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY!', width / 2, height * 0.35);
      ctx.font = 'bold 24px Arial';
      ctx.fillText('#1 WINNER', width / 2, height * 0.45);
    } else {
      // Defeat screen
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', width / 2, height * 0.35);

      if (winner) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.fillText(`Winner: ${winner.name}`, width / 2, height * 0.45);
      }

      const myPlayer = state.players.get(this.mySessionId);
      if (myPlayer) {
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '20px Arial';
        ctx.fillText(`Your Rank: #${myPlayer.rank}`, width / 2, height * 0.55);
        ctx.fillText(`Score: ${myPlayer.score}`, width / 2, height * 0.62);
      }
    }

    // Restart message
    ctx.fillStyle = '#888888';
    ctx.font = '16px Arial';
    ctx.fillText('New game starting soon...', width / 2, height * 0.75);
  }

  private drawGasTrails(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.gasBoostSprite) return;

    const sprite = this.gasBoostSprite; // Store in const for type narrowing
    const gasWidth = width * 0.15; // Reduced from 0.18
    const gasHeight = gasWidth * 0.69; // Correct aspect ratio for gas sprite (67/97)

    this.gasTrails.forEach(trail => {
      const trailX = trail.x * width;
      const trailY = trail.y * height;
      const age = Date.now() - trail.timestamp;
      
      // Pop-on effect: scale from 0.5 to 1.0 in first 150ms
      let scale = 1.0;
      if (age < 150) {
        scale = 0.5 + (age / 150) * 0.5; // Smooth scale from 0.5 to 1.0
      }
      
      // Fade out over 1.5s
      const opacity = Math.max(0.2, 1 - age / 1500);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(
        sprite,
        trailX - (gasWidth * scale) / 2,
        trailY - (gasHeight * scale) / 2,
        gasWidth * scale,
        gasHeight * scale
      );
      ctx.restore();
    });
  }
}
