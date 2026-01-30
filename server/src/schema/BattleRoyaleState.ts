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
});

/**
 * Pipe state - synchronized across all clients
 */
export class Pipe extends Schema {
  x: number = 0;
  gapY: number = 0.5;
  gapSize: number = 0.18;
  passed: boolean = false;
}

defineTypes(Pipe, {
  x: "number",
  gapY: "number",
  gapSize: "number",
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
