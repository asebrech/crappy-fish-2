'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MultiplayerClient, getMultiplayerClient, GameState } from './MultiplayerClient';
import { BattleRoyaleRenderer } from './BattleRoyaleRenderer';
import prepareAssets from '../core/asset-preparation';
import { rescaleDim } from '../core/utils';

interface BattleRoyaleGameProps {
  serverUrl?: string;
}

const CANVAS_DIMENSION = { width: 288, height: 512 };

export default function BattleRoyaleGame({ serverUrl = 'ws://localhost:2567' }: BattleRoyaleGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BattleRoyaleRenderer | null>(null);
  const clientRef = useRef<MultiplayerClient | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<string>('waiting');

  // Resize handler
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !rendererRef.current) return;

    const sizeResult = rescaleDim(CANVAS_DIMENSION, {
      height: window.innerHeight * 2 - 50
    });

    canvasRef.current.style.maxWidth = String(sizeResult.width / 2) + 'px';
    canvasRef.current.style.maxHeight = String(sizeResult.height / 2) + 'px';

    rendererRef.current.resize(sizeResult.width, sizeResult.height);
  }, []);

  // Game loop
  const gameLoop = useCallback(() => {
    if (rendererRef.current && gameStateRef.current) {
      rendererRef.current.render(gameStateRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // Handle flap
  const handleFlap = useCallback(() => {
    clientRef.current?.flap();
  }, []);

  // Connect to server
  const connect = useCallback(async () => {
    if (!playerName.trim()) {
      setError('Please enter a name');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const client = getMultiplayerClient(serverUrl);
      clientRef.current = client;

      // Set up event handlers
      client.setOnStateChange((state) => {
        gameStateRef.current = state;
        setGamePhase(state.phase);
      });

      client.setOnConnected(() => {
        setIsConnected(true);
        setIsConnecting(false);
        if (rendererRef.current) {
          rendererRef.current.setSessionId(client.sessionId);
        }
      });

      client.setOnDisconnected(() => {
        setIsConnected(false);
        setError('Disconnected from server');
      });

      client.setOnError((err) => {
        setError(err.message);
        setIsConnecting(false);
      });

      await client.connect(playerName.trim());
    } catch (err) {
      setError('Failed to connect to server');
      setIsConnecting(false);
    }
  }, [playerName, serverUrl]);

  // Initialize game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Load assets
    prepareAssets(() => {
      // Create renderer
      rendererRef.current = new BattleRoyaleRenderer(canvas);
      rendererRef.current.loadSprites();
      handleResize();

      setIsLoading(false);

      // Start render loop
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    });

    // Resize listener
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clientRef.current?.disconnect();
    };
  }, [handleResize, gameLoop]);

  // Input handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isConnected) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handleFlap();
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleFlap();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleFlap();
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isConnected, handleFlap]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(28, 28, 30, 1)',
      flexDirection: 'column'
    }}>
      {/* Loading screen */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          color: 'white',
          zIndex: 20
        }}>
          <img src="/game-assets/icon.png" alt="Crappy Fish 2" style={{ width: '128px', height: '128px' }} />
          <div>Loading assets...</div>
        </div>
      )}

      {/* Connection screen */}
      {!isLoading && !isConnected && (
        <div style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          color: 'white',
          zIndex: 15,
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '40px',
          borderRadius: '16px'
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#FFD700', margin: 0 }}>
            CRAPPY FISH 2 ROYALE
          </h1>
          <p style={{ color: '#aaa', margin: 0 }}>Battle Royale Edition</p>

          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            maxLength={15}
            style={{
              padding: '12px 20px',
              fontSize: '18px',
              borderRadius: '8px',
              border: 'none',
              outline: 'none',
              width: '250px',
              textAlign: 'center'
            }}
          />

          <button
            onClick={connect}
            disabled={isConnecting || !playerName.trim()}
            style={{
              padding: '12px 40px',
              fontSize: '18px',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isConnecting ? '#666' : '#4CAF50',
              color: 'white',
              cursor: isConnecting ? 'wait' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {isConnecting ? 'Connecting...' : 'PLAY'}
          </button>

          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <div style={{ color: '#666', fontSize: '12px', marginTop: '10px' }}>
            Press Space or Click to flap
          </div>
        </div>
      )}

      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          touchAction: 'none',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          cursor: isConnected ? 'pointer' : 'default'
        }}
      />

      {/* Connection status indicator */}
      {isConnected && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '8px 16px',
          borderRadius: '20px',
          color: '#4CAF50',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#4CAF50',
            borderRadius: '50%'
          }} />
          Connected
        </div>
      )}
    </div>
  );
}
