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
 * Hole state - represents a gap in a pipe
 */
export declare class Hole extends Schema {
    y: number;
    size: number;
    hasItem: boolean;
    itemCollected: boolean;
}
/**
 * Pipe state - synchronized across all clients
 */
export declare class Pipe extends Schema {
    x: number;
    holes: ArraySchema<Hole>;
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