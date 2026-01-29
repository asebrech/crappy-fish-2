/**
 * Game initialization module for React integration
 * Refactored from the original index.ts
 */

import { framer as Framer, rescaleDim } from './utils';
import { CANVAS_DIMENSION } from './constants';
import EventHandler from './events';
import GameObject from './game';
import prepareAssets from './asset-preparation';

export interface GameInstance {
  destroy: () => void;
  resize: () => void;
}

/**
 * Initialize the Flappy Bird game
 * @param canvas - The canvas element to render the game on
 * @param onReady - Optional callback when game is ready
 * @returns GameInstance with destroy and resize methods
 */
export function initGame(
  canvas: HTMLCanvasElement,
  onReady?: () => void
): GameInstance {
  /**
   * Enabling desynchronized to reduce latency
   * but the frame tearing may experience so
   * we'll need double buffer to atleast reduce
   * the frame tearing
   */
  const virtualCanvas = document.createElement('canvas');
  const physicalContext = canvas.getContext('2d')!;
  const Game = new GameObject(virtualCanvas);
  const fps = new Framer(Game.context);

  let isLoaded = false;
  let animationFrameId: number | null = null;
  let isDestroyed = false;

  // FPS counter setup (development only)
  fps.text({ x: 50, y: 50 }, '', ' Cycle');
  fps.container({ x: 10, y: 10 }, { x: 230, y: 70 });

  const GameUpdate = (): void => {
    if (isDestroyed) return;

    physicalContext.drawImage(virtualCanvas, 0, 0);
    Game.Update();
    Game.Display();

    if (process.env.NODE_ENV === 'development') fps.mark();

    // Schedule next frame
    animationFrameId = requestAnimationFrame(GameUpdate);
  };

  const ScreenResize = () => {
    if (isDestroyed) return;

    const sizeResult = rescaleDim(CANVAS_DIMENSION, {
      height: window.innerHeight * 2 - 50
    });

    canvas.style.maxWidth = String(sizeResult.width / 2) + 'px';
    canvas.style.maxHeight = String(sizeResult.height / 2) + 'px';

    canvas.height = sizeResult.height;
    canvas.width = sizeResult.width;
    virtualCanvas.height = sizeResult.height;
    virtualCanvas.width = sizeResult.width;

    Game.Resize(sizeResult);
  };

  const handleResize = () => {
    if (!isLoaded || isDestroyed) return;
    ScreenResize();
  };

  // Add resize listener
  window.addEventListener('resize', handleResize);

  // Load assets and start the game
  prepareAssets(() => {
    if (isDestroyed) return;

    isLoaded = true;
    Game.init();
    ScreenResize();

    // Setup event handlers
    EventHandler(Game, canvas);

    // Start game loop
    animationFrameId = requestAnimationFrame(GameUpdate);

    // Call ready callback
    onReady?.();
  });

  // Return cleanup interface
  return {
    destroy: () => {
      isDestroyed = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);
    },
    resize: handleResize
  };
}
