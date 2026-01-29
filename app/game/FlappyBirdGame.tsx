'use client';

import { useEffect, useRef, useState } from 'react';
import { initGame, type GameInstance } from './core/game-init';

interface FlappyBirdGameProps {
  className?: string;
}

export default function FlappyBirdGame({ className }: FlappyBirdGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize the game
    gameRef.current = initGame(canvas, () => {
      setIsLoading(false);
    });

    // Cleanup on unmount
    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(28, 28, 30, 1)' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          color: 'white',
          zIndex: 10
        }}>
          <img src="/game-assets/icon.png" alt="Flappy Bird" style={{ width: '128px', height: '128px' }} />
          <div>Loading...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        id="main-canvas"
        style={{
          display: 'block',
          touchAction: 'none',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
    </div>
  );
}
