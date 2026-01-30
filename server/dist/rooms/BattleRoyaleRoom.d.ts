import { Room, Client } from "@colyseus/core";
import { BattleRoyaleState } from "../schema/BattleRoyaleState";
export declare class BattleRoyaleRoom extends Room<BattleRoyaleState> {
    maxClients: number;
    private gameLoopInterval;
    private countdownInterval;
    private lastPipeX;
    onCreate(options: any): void;
    onJoin(client: Client, options: any): void;
    onLeave(client: Client, consented: boolean): void;
    onDispose(): void;
    private checkStartConditions;
    private startCountdown;
    private startGame;
    private startGameLoop;
    private stopGameLoop;
    private update;
    private updatePipes;
    private generatePipe;
    private updatePlayer;
    private checkCollisions;
    private eliminatePlayer;
    private handleFlap;
    private countAlivePlayers;
    private checkWinCondition;
    private endGame;
    private resetRoom;
}
//# sourceMappingURL=BattleRoyaleRoom.d.ts.map