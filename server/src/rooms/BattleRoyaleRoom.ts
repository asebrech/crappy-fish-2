import { Room, Client } from "@colyseus/core";
import { BattleRoyaleState, Player, Pipe, Hole } from "../schema/BattleRoyaleState";

// Game constants
const GAME_SPEED = 0.005;
const GRAVITY = 0.0004;
const JUMP_FORCE = -0.008;
const PIPE_DISTANCE = 0.4;
const PIPE_MIN_Y = 0.2;
const PIPE_MAX_Y = 0.7;
const BIRD_COLORS = ["yellow", "red", "blue"];
const MIN_PLAYERS_TO_START = process.env.DEBUG_MODE === "true" ? 1 : 2;
const MAX_PLAYERS = 20;
const COUNTDOWN_SECONDS = process.env.DEBUG_MODE === "true" ? 0 : 5; // Skip countdown in debug mode
const TICK_RATE = 60; // 60 FPS

// Multi-hole pipe configuration
const MIN_HOLES_PER_PIPE = 1;
const MAX_HOLES_PER_PIPE = 3;
const MIN_HOLE_SPACING = 0.45; // Minimum vertical spacing between holes (increased from 0.35 for even easier gameplay)
const MIN_HOLE_SIZE = 0.25; // Increased from 0.20 for much easier gameplay
const MAX_HOLE_SIZE = 0.30; // Increased from 0.25 for much easier gameplay
const ITEM_SPAWN_CHANCE = 0.5; // 50% chance per pipe (increased from 35% to compensate for faster degradation)

// Vision system configuration
const VISION_DEGRADATION_RATE = 0.002; // Base vision loss per tick (60 ticks/sec)
const MIN_VISION = 0.05; // Minimum vision - VERY dark (barely able to see)
const VISION_RESTORE_AMOUNT = 1.0; // Full restore when collecting diving mask
const DEGRADATION_MULTIPLIER_INCREASE = 0.3; // How much faster degradation gets after each restore (30% faster)

// Lives system configuration
const STARTING_LIVES = 2; // Players start with 2 lives
const RESPAWN_INVULNERABILITY_TIME = 2000; // 2 seconds invulnerability after losing a life (in milliseconds)

export class BattleRoyaleRoom extends Room<BattleRoyaleState> {
  maxClients = MAX_PLAYERS;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private lastPipeX: number = 1.5;

  onCreate(options: any) {
    console.log("BattleRoyaleRoom created!");
    
    this.setState(new BattleRoyaleState());
    this.state.gameSpeed = GAME_SPEED;
    this.state.gravity = GRAVITY;
    this.state.jumpForce = JUMP_FORCE;
    this.state.pipeDistance = PIPE_DISTANCE;

    // Handle player input
    this.onMessage("flap", (client) => {
      this.handleFlap(client.sessionId);
    });

    // Handle player ready
    this.onMessage("ready", (client) => {
      this.checkStartConditions();
    });

    // Handle name setting
    this.onMessage("setName", (client, name: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.name = name.substring(0, 15); // Limit name length
      }
    });
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined!`);

    // Create new player
    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || `Bird${this.state.players.size + 1}`;
    player.color = BIRD_COLORS[this.state.players.size % BIRD_COLORS.length];
    player.y = 0.5;
    player.alive = true;

    this.state.players.set(client.sessionId, player);
    this.state.totalPlayers = this.state.players.size;
    this.state.playersAlive = this.countAlivePlayers();

    // Check if we should start countdown
    this.checkStartConditions();
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left!`);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.alive = false;
    }
    
    this.state.players.delete(client.sessionId);
    this.state.totalPlayers = this.state.players.size;
    this.state.playersAlive = this.countAlivePlayers();

    // Check win condition
    this.checkWinCondition();
  }

  onDispose() {
    console.log("Room disposed!");
    this.stopGameLoop();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private checkStartConditions() {
    if (this.state.phase !== "waiting") return;
    
    if (this.state.players.size >= MIN_PLAYERS_TO_START) {
      this.startCountdown();
    }
  }

  private startCountdown() {
    if (this.state.phase !== "waiting") return;
    
    this.state.phase = "countdown";
    this.state.countdown = COUNTDOWN_SECONDS;

    // If countdown is 0 (DEBUG_MODE), start game immediately
    if (COUNTDOWN_SECONDS === 0) {
      this.startGame();
      return;
    }

    this.countdownInterval = setInterval(() => {
      this.state.countdown--;
      
      if (this.state.countdown <= 0) {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
        }
        this.startGame();
      }
    }, 1000);
  }

  private startGame() {
    console.log("Game starting!");
    
    this.state.phase = "playing";
    this.state.startTime = Date.now();
    this.state.playersAlive = this.countAlivePlayers();
    
    // Reset all players
    this.state.players.forEach((player: Player) => {
      player.y = 0.5;
      player.velocityY = 0;
      player.rotation = 0;
      player.score = 0;
      player.alive = true;
      player.vision = 1.0; // Start with full vision
      player.visionDegradationMultiplier = 1.0; // Reset degradation speed
      player.lives = STARTING_LIVES; // Start with 2 lives
      player.lastHitTime = 0; // Reset hit timer
    });

    // Clear pipes and generate initial ones
    this.state.pipes.clear();
    this.lastPipeX = 1.5;
    this.generatePipe();

    // Start game loop
    this.startGameLoop();
  }

  private startGameLoop() {
    const deltaTime = 1000 / TICK_RATE;
    
    this.gameLoopInterval = setInterval(() => {
      this.update(deltaTime / 1000);
    }, deltaTime);
  }

  private stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  private update(dt: number) {
    if (this.state.phase !== "playing") return;

    this.state.gameTime = Date.now() - this.state.startTime;

    // Update pipes
    this.updatePipes();

    // Update players
    this.state.players.forEach((player, sessionId) => {
      if (!player.alive) return;
      this.updatePlayer(player);
    });

    // Check win condition
    this.checkWinCondition();
  }

  private updatePipes() {
    // Move pipes left
    const pipeSpeed = this.state.gameSpeed;
    
    for (let i = this.state.pipes.length - 1; i >= 0; i--) {
      const pipe = this.state.pipes.at(i);
      if (!pipe) continue;
      
      pipe.x -= pipeSpeed;

      // Remove pipes that are off screen
      if (pipe.x < -0.1) {
        this.state.pipes.splice(i, 1);
      }
    }

    // Update lastPipeX tracking
    this.lastPipeX -= pipeSpeed;

    // Generate new pipes
    if (this.lastPipeX < 1 - PIPE_DISTANCE) {
      this.generatePipe();
    }
  }

  private generatePipe() {
    const pipe = new Pipe();
    pipe.x = 1.1; // Start just off screen
    pipe.passed = false;
    
    // Generate 2-3 random holes
    const numHoles = MIN_HOLES_PER_PIPE + Math.floor(Math.random() * (MAX_HOLES_PER_PIPE - MIN_HOLES_PER_PIPE + 1));
    const holePositions: number[] = [];
    
    for (let i = 0; i < numHoles; i++) {
      let y: number = 0;
      let attempts = 0;
      
      // Find a valid position with proper spacing
      do {
        y = PIPE_MIN_Y + Math.random() * (PIPE_MAX_Y - PIPE_MIN_Y);
        attempts++;
      } while (
        attempts < 20 && 
        holePositions.some(existingY => Math.abs(existingY - y) < MIN_HOLE_SPACING)
      );
      
      // Only add if we found a valid position
      if (attempts < 20) {
        holePositions.push(y);
        
        const hole = new Hole();
        hole.y = y;
        
        // Vary hole sizes for difficulty (easier holes at beginning)
        const sizeFactor = Math.random();
        hole.size = MIN_HOLE_SIZE + sizeFactor * (MAX_HOLE_SIZE - MIN_HOLE_SIZE);
        
        hole.hasItem = false;
        // itemCollectedBy starts as empty array (no initialization needed)
        
        pipe.holes.push(hole);
      }
    }
    
    // After all holes are created, randomly place ONE item
    if (pipe.holes.length > 0 && Math.random() < ITEM_SPAWN_CHANCE) {
      const randomHoleIndex = Math.floor(Math.random() * pipe.holes.length);
      const randomHole = pipe.holes.at(randomHoleIndex);
      if (randomHole) {
        randomHole.hasItem = true;
      }
    }
    
    this.state.pipes.push(pipe);
    this.lastPipeX = 1.1;
  }

  private updatePlayer(player: Player) {
    // Apply gravity
    player.velocityY += this.state.gravity;
    
    // Clamp velocity
    player.velocityY = Math.max(-0.02, Math.min(0.015, player.velocityY));
    
    // Update position
    player.y += player.velocityY;

    // Update rotation based on velocity
    const targetRotation = player.velocityY > 0 ? 90 : -20;
    player.rotation += (targetRotation - player.rotation) * 0.1;
    player.rotation = Math.max(-20, Math.min(90, player.rotation));

    // Degrade vision over time (gets faster with each restoration)
    const degradationRate = VISION_DEGRADATION_RATE * player.visionDegradationMultiplier;
    player.vision = Math.max(MIN_VISION, player.vision - degradationRate);

    // Check collisions
    this.checkCollisions(player);
  }

  private checkCollisions(player: Player) {
    const isInvulnerable = Date.now() - player.lastHitTime < RESPAWN_INVULNERABILITY_TIME;
    
    // Floor collision - bounce back up if invulnerable, eliminate if not
    if (player.y > 0.85) {
      if (isInvulnerable) {
        // Bounce off floor when invulnerable (no damage)
        player.y = 0.85;
        player.velocityY = Math.min(0, player.velocityY); // Stop downward movement
      } else {
        // Take damage when not invulnerable
        this.eliminatePlayer(player);
        return;
      }
    }

    // Ceiling collision (always active, just bounce)
    if (player.y < 0.02) {
      player.y = 0.02;
      player.velocityY = 0;
    }

    // Pipe collision and item collection
    const birdX = 0.3; // Bird X position (constant)
    const birdSize = 0.03; // Bird hitbox size

    for (const pipe of this.state.pipes) {
      // Check if bird is horizontally within pipe
      const pipeWidth = 0.08;
      if (birdX + birdSize > pipe.x - pipeWidth / 2 && 
          birdX - birdSize < pipe.x + pipeWidth / 2) {
        
        // Check if bird is in ANY hole
        let inAnyHole = false;
        
        for (const hole of pipe.holes) {
          const gapTop = hole.y - hole.size / 2;
          const gapBottom = hole.y + hole.size / 2;
          
          // Bird is inside this hole
          if (player.y - birdSize >= gapTop && player.y + birdSize <= gapBottom) {
            inAnyHole = true;
            
            // Check for item collection (diving mask) - ALWAYS works, even when invulnerable
            // Each player can collect the same item once
            const hasCollected = hole.itemCollectedBy.includes(player.id);
            if (hole.hasItem && !hasCollected && birdX > pipe.x) {
              hole.itemCollectedBy.push(player.id);
              
              // Fully restore vision (diving mask effect)
              player.vision = 1.0;
              
              // Increase degradation speed for next time (gets harder!)
              player.visionDegradationMultiplier += DEGRADATION_MULTIPLIER_INCREASE;
              
              player.score += 5; // Bonus points for collecting item
              console.log(`Player ${player.name} collected diving mask! Vision fully restored. Degradation multiplier: ${player.visionDegradationMultiplier.toFixed(2)}x`);
            }
            
            break;
          }
        }
        
        // If not in any hole, collision with pipe! (skip damage if invulnerable)
        if (!inAnyHole && !isInvulnerable) {
          this.eliminatePlayer(player);
          return;
        }

        // Score point for passing pipe (only once)
        if (!pipe.passed && birdX > pipe.x) {
          pipe.passed = true;
          player.score++;
        }
      }
    }
  }

  private eliminatePlayer(player: Player) {
    if (!player.alive) return;
    
    // Reduce lives by 1
    player.lives = Math.max(0, player.lives - 1);
    player.lastHitTime = Date.now();
    
    if (player.lives > 0) {
      // Player still has lives remaining - respawn them
      console.log(`Player ${player.name} lost a life! ${player.lives} lives remaining.`);
      
      // Respawn at middle of screen with reset velocity
      player.y = 0.5;
      player.velocityY = 0;
      player.rotation = 0;
      
      // Grant 2 seconds of invulnerability (handled in checkCollisions)
    } else {
      // No lives remaining - fully eliminate player
      console.log(`Player ${player.name} eliminated! ${this.state.playersAlive - 1} players remaining.`);
      
      player.alive = false;
      player.eliminatedAt = Date.now();
      player.rank = this.state.playersAlive;
      
      this.state.playersAlive = this.countAlivePlayers();
    }
  }

  private handleFlap(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    
    if (this.state.phase !== "playing") return;

    // Apply jump force
    player.velocityY = this.state.jumpForce;
  }

  private countAlivePlayers(): number {
    let count = 0;
    this.state.players.forEach((player) => {
      if (player.alive) count++;
    });
    return count;
  }

  private checkWinCondition() {
    if (this.state.phase !== "playing") return;

    const alivePlayers = this.countAlivePlayers();
    
    // In debug mode, game only ends when all players are dead
    // In normal mode, game ends when 1 or fewer players remain
    const minPlayersToEnd = process.env.DEBUG_MODE === "true" ? 0 : 1;
    
    if (alivePlayers <= minPlayersToEnd) {
      this.endGame();
    }
  }

  private endGame() {
    this.stopGameLoop();
    this.state.phase = "finished";

    // Find winner
    this.state.players.forEach((player) => {
      if (player.alive) {
        player.rank = 1;
        this.state.winnerId = player.id;
        console.log(`${player.name} wins!`);
      }
    });

    // Reset room immediately in debug mode, or after 10 seconds in production
    const resetDelay = process.env.DEBUG_MODE === "true" ? 0 : 10000;
    setTimeout(() => {
      this.resetRoom();
    }, resetDelay);
  }

  private resetRoom() {
    this.state.phase = "waiting";
    this.state.countdown = COUNTDOWN_SECONDS;
    this.state.winnerId = "";
    this.state.pipes.clear();
    this.lastPipeX = 1.5;
    
    this.state.players.forEach((player) => {
      player.y = 0.5;
      player.velocityY = 0;
      player.rotation = 0;
      player.score = 0;
      player.alive = true;
      player.rank = 0;
    });

    this.state.playersAlive = this.countAlivePlayers();
    
    // Check if we should start again
    this.checkStartConditions();
  }
}
