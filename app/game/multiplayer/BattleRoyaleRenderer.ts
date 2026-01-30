/**
 * Multiplayer Battle Royale Game Renderer
 * Renders game state received from the server
 */

import { GameState, PlayerState, PipeState } from './MultiplayerClient';
import SpriteDestructor from '../core/lib/sprite-destructor';

// Custom bird sprites (neutral, down, up)
const CUSTOM_BIRD_SPRITES = ['bird-blue-up', 'bird-blue-mid', 'bird-blue-down'];

export class BattleRoyaleRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private canvasSize: { width: number; height: number };
  private mySessionId: string = "";
  private animationFrame: number = 0;
  private platformOffset: number = 0;

  // Cached sprites
  private birdSprites: Map<string, HTMLImageElement> = new Map();
  private pipeSprites: { top: HTMLImageElement | null; bottom: HTMLImageElement | null } = { top: null, bottom: null };
  private backgroundSprite: HTMLImageElement | null = null;
  private platformSprite: HTMLImageElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false })!;
    this.canvasSize = { width: canvas.width, height: canvas.height };
  }

  setSessionId(sessionId: string): void {
    this.mySessionId = sessionId;
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
  }

  render(state: GameState): void {
    this.animationFrame++;
    
    const ctx = this.context;
    const { width, height } = this.canvasSize;

    // Synchronize platform offset with server game time (60 FPS tick rate)
    if (state.phase === "playing") {
      this.platformOffset = state.gameTime * state.gameSpeed * 0.06;
    }

    // Get local player for vision-based effects
    const players = Array.from(state.players.values());
    const myPlayer = players.find(p => p.id === this.mySessionId);
    
    // Apply underwater blur CSS filter to canvas based on vision
    // Only apply during active gameplay when player is alive
    if (state.phase === "playing" && myPlayer && myPlayer.alive) {
      const intensity = 1.0 - myPlayer.vision;
      const blurAmount = Math.round(intensity * 12); // 0-12px blur
      
      // Apply CSS filter to the entire canvas
      this.canvas.style.filter = blurAmount > 0 
        ? `blur(${blurAmount}px) hue-rotate(${intensity * 20}deg) saturate(${1 + intensity * 0.3})`
        : 'none';
      
      // Debug log
      if (this.animationFrame % 60 === 0) {
        console.log('Vision:', myPlayer.vision, 'Blur:', blurAmount + 'px');
      }
    } else {
      // Reset filter during waiting, countdown, finished, or when dead
      this.canvas.style.filter = 'none';
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

    // Draw all players (other players first, then local player on top)
    const otherPlayers = players.filter(p => p.id !== this.mySessionId);

    // Draw other players (slightly transparent)
    otherPlayers.forEach(player => {
      this.drawBird(ctx, player, width, height, 0.7);
    });

    // Draw local player
    if (myPlayer) {
      this.drawBird(ctx, myPlayer, width, height, 1.0);
    }

    // Draw underwater color overlay (tint effect) - only during active gameplay
    if (state.phase === "playing" && myPlayer && myPlayer.alive) {
      this.drawUnderwaterTintOverlay(ctx, myPlayer.vision, width, height);
    }

    // Draw UI overlay
    this.drawUI(ctx, state, width, height);
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
      
      // Draw item if present and not collected
      if (hole.hasItem && !hole.itemCollected) {
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
    const itemSize = width * 0.025;
    const time = this.animationFrame * 0.1;
    
    ctx.save();
    
    // Pulsing effect
    const pulseScale = 1 + Math.sin(time) * 0.15;
    
    // Rotation effect
    ctx.translate(x, y);
    ctx.rotate(time * 0.05);
    ctx.scale(pulseScale, pulseScale);
    
    // Draw golden star
    this.drawStar(ctx, 0, 0, 5, itemSize, itemSize * 0.5);
    
    // Sparkle effect
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(time * 2) * 0.5})`;
    ctx.beginPath();
    ctx.arc(itemSize * 0.4, -itemSize * 0.4, itemSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
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

    // Get wing state based on animation (use custom sprite instead of color-based)
    const wingState = player.alive ? Math.floor(this.animationFrame / 5) % 3 : 1;
    const spriteKey = `custom.${wingState}`;
    const sprite = this.birdSprites.get(spriteKey);

    ctx.save();
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
    ctx.fillText('FLAPPY ROYALE', width / 2, height * 0.3);

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

    // Countdown number
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.countdown.toString(), width / 2, height / 2);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('GET READY!', width / 2, height * 0.35);
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
}
