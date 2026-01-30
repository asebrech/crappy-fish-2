import { Schema, MapSchema, ArraySchema } from "@colyseus/schema";
/**
 * Player state - represents a bird in the game
 */
export declare class Player extends Schema {
    id: string;
    name: string;
    color: string;
    y: number;
    velocityY: number;
    rotation: number;
    score: number;
    alive: boolean;
    rank: number;
    eliminatedAt: number;
}
/**
 * Pipe state - synchronized across all clients
 */
export declare class Pipe extends Schema {
    x: number;
    gapY: number;
    gapSize: number;
    passed: boolean;
}
/**
 * Main game state
 */
export declare class BattleRoyaleState extends Schema {
    phase: string;
    countdown: number;
    startTime: number;
    gameTime: number;
    playersAlive: number;
    totalPlayers: number;
    winnerId: string;
    players: MapSchema<Player, string>;
    pipes: ArraySchema<Pipe>;
    gameSpeed: number;
    gravity: number;
    jumpForce: number;
    pipeDistance: number;
}
//# sourceMappingURL=BattleRoyaleState.d.ts.map