"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleRoyaleState = exports.Pipe = exports.Player = void 0;
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
 * Pipe state - synchronized across all clients
 */
class Pipe extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.x = 0;
        this.gapY = 0.5;
        this.gapSize = 0.18;
        this.passed = false;
    }
}
exports.Pipe = Pipe;
(0, schema_1.defineTypes)(Pipe, {
    x: "number",
    gapY: "number",
    gapSize: "number",
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
