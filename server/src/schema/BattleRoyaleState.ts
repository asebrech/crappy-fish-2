import { Schema, MapSchema, ArraySchema, defineTypes } from "@colyseus/schema";

/**
 * Player state - represents a bird in the game
 */
export class Player extends Schema {
  id: string = "";
  name: string = "";
  color: string = "yellow";
  y: number = 0.5;
  velocityY: number = 0;
  rotation: number = 0;
  score: number = 0;
  alive: boolean = true;
  rank: number = 0;
  eliminatedAt: number = 0;
  vision: number = 1.0; // Vision clarity (1.0 = clear, 0.0 = blind)
  visionDegradationMultiplier: number = 1.0; // Multiplier for vision degradation speed
  lives: number = 2; // Number of lives remaining
  lastHitTime: number = 0; // Timestamp of last hit for invulnerability
}

defineTypes(Player, {
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
  vision: "number",
  visionDegradationMultiplier: "number",
  lives: "number",
  lastHitTime: "number",
});

/**
 * Hole state - represents a gap in a pipe
 */
export class Hole extends Schema {
  y: number = 0.5;           // Hole center Y position (0-1)
  size: number = 0.18;       // Hole size
  hasItem: boolean = false;  // Whether this hole contains an item
  itemCollectedBy = new ArraySchema<string>(); // Array of player IDs who collected this item
}

defineTypes(Hole, {
  y: "number",
  size: "number",
  hasItem: "boolean",
  itemCollectedBy: ["string"],
});

/**
 * Pipe state - synchronized across all clients
 */
export class Pipe extends Schema {
  x: number = 0;
  holes = new ArraySchema<Hole>();  // 2-3 holes per pipe
  passed: boolean = false;
}

defineTypes(Pipe, {
  x: "number",
  holes: [Hole],
  passed: "boolean",
});

/**
 * Main game state
 */
export class BattleRoyaleState extends Schema {
  phase: string = "waiting";
  countdown: number = 3;
  startTime: number = 0;
  gameTime: number = 0;
  playersAlive: number = 0;
  totalPlayers: number = 0;
  winnerId: string = "";
  
  players = new MapSchema<Player>();
  pipes = new ArraySchema<Pipe>();
  
  gameSpeed: number = 0.005;
  gravity: number = 0.0004;
  jumpForce: number = -0.008;
  pipeDistance: number = 0.4;
}

defineTypes(BattleRoyaleState, {
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
