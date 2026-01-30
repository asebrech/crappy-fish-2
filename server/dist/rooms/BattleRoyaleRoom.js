"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleRoyaleRoom = void 0;
const core_1 = require("@colyseus/core");
const BattleRoyaleState_1 = require("../schema/BattleRoyaleState");
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
const COUNTDOWN_SECONDS = 5;
const TICK_RATE = 60; // 60 FPS
// Multi-hole pipe configuration
const MIN_HOLES_PER_PIPE = 2;
const MAX_HOLES_PER_PIPE = 3;
const MIN_HOLE_SPACING = 0.25; // Minimum vertical spacing between holes
const MIN_HOLE_SIZE = 0.15;
const MAX_HOLE_SIZE = 0.2;
const ITEM_SPAWN_CHANCE = 0.35; // 35% chance per hole (max 1 per pipe)
class BattleRoyaleRoom extends core_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = MAX_PLAYERS;
        this.gameLoopInterval = null;
        this.countdownInterval = null;
        this.lastPipeX = 1.5;
    }
    onCreate(options) {
        console.log("BattleRoyaleRoom created!");
        this.setState(new BattleRoyaleState_1.BattleRoyaleState());
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
        this.onMessage("setName", (client, name) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.name = name.substring(0, 15); // Limit name length
            }
        });
    }
    onJoin(client, options) {
        console.log(`Player ${client.sessionId} joined!`);
        // Create new player
        const player = new BattleRoyaleState_1.Player();
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
    onLeave(client, consented) {
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
    checkStartConditions() {
        if (this.state.phase !== "waiting")
            return;
        if (this.state.players.size >= MIN_PLAYERS_TO_START) {
            this.startCountdown();
        }
    }
    startCountdown() {
        if (this.state.phase !== "waiting")
            return;
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
    startGame() {
        console.log("Game starting!");
        this.state.phase = "playing";
        this.state.startTime = Date.now();
        this.state.playersAlive = this.countAlivePlayers();
        // Reset all players
        this.state.players.forEach((player) => {
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
    startGameLoop() {
        const deltaTime = 1000 / TICK_RATE;
        this.gameLoopInterval = setInterval(() => {
            this.update(deltaTime / 1000);
        }, deltaTime);
    }
    stopGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
    update(dt) {
        if (this.state.phase !== "playing")
            return;
        this.state.gameTime = Date.now() - this.state.startTime;
        // Update pipes
        this.updatePipes();
        // Update players
        this.state.players.forEach((player, sessionId) => {
            if (!player.alive)
                return;
            this.updatePlayer(player);
        });
        // Check win condition
        this.checkWinCondition();
    }
    updatePipes() {
        // Move pipes left
        const pipeSpeed = this.state.gameSpeed;
        for (let i = this.state.pipes.length - 1; i >= 0; i--) {
            const pipe = this.state.pipes.at(i);
            if (!pipe)
                continue;
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
    generatePipe() {
        const pipe = new BattleRoyaleState_1.Pipe();
        pipe.x = 1.1; // Start just off screen
        pipe.passed = false;
        // Generate 2-3 random holes
        const numHoles = MIN_HOLES_PER_PIPE + Math.floor(Math.random() * (MAX_HOLES_PER_PIPE - MIN_HOLES_PER_PIPE + 1));
        const holePositions = [];
        for (let i = 0; i < numHoles; i++) {
            let y = 0;
            let attempts = 0;
            // Find a valid position with proper spacing
            do {
                y = PIPE_MIN_Y + Math.random() * (PIPE_MAX_Y - PIPE_MIN_Y);
                attempts++;
            } while (attempts < 20 &&
                holePositions.some(existingY => Math.abs(existingY - y) < MIN_HOLE_SPACING));
            // Only add if we found a valid position
            if (attempts < 20) {
                holePositions.push(y);
                const hole = new BattleRoyaleState_1.Hole();
                hole.y = y;
                // Vary hole sizes for difficulty (easier holes at beginning)
                const sizeFactor = Math.random();
                hole.size = MIN_HOLE_SIZE + sizeFactor * (MAX_HOLE_SIZE - MIN_HOLE_SIZE);
                hole.hasItem = false;
                hole.itemCollected = false;
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
    updatePlayer(player) {
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
    checkCollisions(player) {
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
                // Check if bird is in ANY hole
                let inAnyHole = false;
                for (const hole of pipe.holes) {
                    const gapTop = hole.y - hole.size / 2;
                    const gapBottom = hole.y + hole.size / 2;
                    // Bird is inside this hole
                    if (player.y - birdSize >= gapTop && player.y + birdSize <= gapBottom) {
                        inAnyHole = true;
                        // Check for item collection
                        if (hole.hasItem && !hole.itemCollected && birdX > pipe.x) {
                            hole.itemCollected = true;
                            player.score += 5; // Bonus points for collecting item
                            console.log(`Player ${player.name} collected item! +5 points`);
                        }
                        break;
                    }
                }
                // If not in any hole, collision with pipe!
                if (!inAnyHole) {
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
    eliminatePlayer(player) {
        if (!player.alive)
            return;
        player.alive = false;
        player.eliminatedAt = Date.now();
        player.rank = this.state.playersAlive;
        this.state.playersAlive = this.countAlivePlayers();
        console.log(`Player ${player.name} eliminated! ${this.state.playersAlive} players remaining.`);
    }
    handleFlap(sessionId) {
        const player = this.state.players.get(sessionId);
        if (!player || !player.alive)
            return;
        if (this.state.phase !== "playing")
            return;
        // Apply jump force
        player.velocityY = this.state.jumpForce;
    }
    countAlivePlayers() {
        let count = 0;
        this.state.players.forEach((player) => {
            if (player.alive)
                count++;
        });
        return count;
    }
    checkWinCondition() {
        if (this.state.phase !== "playing")
            return;
        const alivePlayers = this.countAlivePlayers();
        // In debug mode, game only ends when all players are dead
        // In normal mode, game ends when 1 or fewer players remain
        const minPlayersToEnd = process.env.DEBUG_MODE === "true" ? 0 : 1;
        if (alivePlayers <= minPlayersToEnd) {
            this.endGame();
        }
    }
    endGame() {
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
    resetRoom() {
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
exports.BattleRoyaleRoom = BattleRoyaleRoom;
