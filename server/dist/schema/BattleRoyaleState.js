"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleRoyaleState = exports.Pipe = exports.Hole = exports.Player = void 0;
const schema_1 = require("@colyseus/schema");
/**
 * Player state - represents a bird in the game
 */
class Player extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.id = "";
        this.name = "";
        this.color = "yellow";
        this.y = 0.5;
        this.velocityY = 0;
        this.rotation = 0;
        this.score = 0;
        this.alive = true;
        this.rank = 0;
        this.eliminatedAt = 0;
    }
}
exports.Player = Player;
(0, schema_1.defineTypes)(Player, {
    id: "string",
    name: "string",
    color: "string",
    y: "number",
    velocityY: "number",
    rotation: "number",
    score: "number",
    alive: "boolean",
    rank: "number",
    eliminatedAt: "number",
});
/**
 * Hole state - represents a gap in a pipe
 */
class Hole extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.y = 0.5; // Hole center Y position (0-1)
        this.size = 0.18; // Hole size
        this.hasItem = false; // Whether this hole contains an item
        this.itemCollected = false; // Whether item was collected
    }
}
exports.Hole = Hole;
(0, schema_1.defineTypes)(Hole, {
    y: "number",
    size: "number",
    hasItem: "boolean",
    itemCollected: "boolean",
});
/**
 * Pipe state - synchronized across all clients
 */
class Pipe extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.x = 0;
        this.holes = new schema_1.ArraySchema(); // 2-3 holes per pipe
        this.passed = false;
    }
}
exports.Pipe = Pipe;
(0, schema_1.defineTypes)(Pipe, {
    x: "number",
    holes: [Hole],
    passed: "boolean",
});
/**
 * Main game state
 */
class BattleRoyaleState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.phase = "waiting";
        this.countdown = 3;
        this.startTime = 0;
        this.gameTime = 0;
        this.playersAlive = 0;
        this.totalPlayers = 0;
        this.winnerId = "";
        this.players = new schema_1.MapSchema();
        this.pipes = new schema_1.ArraySchema();
        this.gameSpeed = 0.005;
        this.gravity = 0.0004;
        this.jumpForce = -0.008;
        this.pipeDistance = 0.4;
    }
}
exports.BattleRoyaleState = BattleRoyaleState;
(0, schema_1.defineTypes)(BattleRoyaleState, {
    phase: "string",
    countdown: "number",
    startTime: "number",
    gameTime: "number",
    playersAlive: "number",
    totalPlayers: "number",
    winnerId: "string",
    players: { map: Player },
    pipes: [Pipe],
    gameSpeed: "number",
    gravity: "number",
    jumpForce: "number",
    pipeDistance: "number",
});
