import { Room, Client } from "@colyseus/core";
import { BattleRoyaleState, Player, Pipe } from "../schema/BattleRoyaleState";

// Game constants
const GAME_SPEED = 0.005;
const GRAVITY = 0.0004;
const JUMP_FORCE = -0.008;
const PIPE_DISTANCE = 0.4;
const PIPE_GAP_SIZE = 0.18;
const PIPE_MIN_Y = 0.2;
const PIPE_MAX_Y = 0.7;
const BIRD_COLORS = ["yellow", "red", "blue"];
const MIN_PLAYERS_TO_START = process.env.DEBUG_MODE === "true" ? 1 : 2;
const MAX_PLAYERS = 20;
const COUNTDOWN_SECONDS = 5;
const TICK_RATE = 60; // 60 FPS

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
    pipe.gapY = PIPE_MIN_Y + Math.random() * (PIPE_MAX_Y - PIPE_MIN_Y);
    pipe.gapSize = PIPE_GAP_SIZE;
    pipe.passed = false;
    
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

    // Check collisions
    this.checkCollisions(player);
  }

  private checkCollisions(player: Player) {
    // Floor collision
    if (player.y > 0.85) {
      this.eliminatePlayer(player);
      return;
    }

    // Ceiling collision
    if (player.y < 0.02) {
      player.y = 0.02;
      player.velocityY = 0;
    }

    // Pipe collision
    const birdX = 0.3; // Bird X position (constant)
    const birdSize = 0.03; // Bird hitbox size

    for (const pipe of this.state.pipes) {
      // Check if bird is horizontally within pipe
      const pipeWidth = 0.08;
      if (birdX + birdSize > pipe.x - pipeWidth / 2 && 
          birdX - birdSize < pipe.x + pipeWidth / 2) {
        
        // Check if bird is outside the gap
        const gapTop = pipe.gapY - pipe.gapSize / 2;
        const gapBottom = pipe.gapY + pipe.gapSize / 2;
        
        if (player.y - birdSize < gapTop || player.y + birdSize > gapBottom) {
          this.eliminatePlayer(player);
          return;
        }

        // Score point for passing pipe
        if (!pipe.passed && birdX > pipe.x) {
          pipe.passed = true;
          player.score++;
        }
      }
    }
  }

  private eliminatePlayer(player: Player) {
    if (!player.alive) return;
    
    player.alive = false;
    player.eliminatedAt = Date.now();
    player.rank = this.state.playersAlive;
    
    this.state.playersAlive = this.countAlivePlayers();
    
    console.log(`Player ${player.name} eliminated! ${this.state.playersAlive} players remaining.`);
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

    // Reset room after 10 seconds
    setTimeout(() => {
      this.resetRoom();
    }, 10000);
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
