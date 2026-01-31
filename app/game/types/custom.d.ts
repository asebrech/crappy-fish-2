interface IDimension {
  width: number;
  height: number;
}

interface ICoordinate {
  x: number;
  y: number;
}

interface IVelocity {
  x: number;
  y: number;
}

type IEmptyFunction = (...args) => void;

// WebGL shader module declarations
declare module '*.glsl' {
  const content: string;
  export default content;
}

declare module '*.vert.glsl' {
  const content: string;
  export default content;
}

declare module '*.frag.glsl' {
  const content: string;
  export default content;
}

declare module '*.vert' {
  const content: string;
  export default content;
}

declare module '*.frag' {
  const content: string;
  export default content;
}
