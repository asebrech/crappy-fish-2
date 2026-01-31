import { Client, Room } from "colyseus.js";

// Types matching server schema
export interface PlayerState {
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
  vision: number;
  lives: number;
  lastHitTime: number;
  isSpectating: boolean;
}

export interface HoleState {
  y: number;
  size: number;
  hasItem: boolean;
  itemCollectedBy: string[]; // Array of player IDs who collected this item
}

export interface PipeState {
  x: number;
  holes: HoleState[];
  passed: boolean;
}

export interface GameState {
  phase: "waiting" | "countdown" | "playing" | "finished";
  countdown: number;
  startTime: number;
  gameTime: number;
  playersAlive: number;
  totalPlayers: number;
  winnerId: string;
  players: Map<string, PlayerState>;
  pipes: PipeState[];
  gameSpeed: number;
  gravity: number;
  jumpForce: number;
  pipeDistance: number;
}

export type GameEventCallback = (state: GameState) => void;
export type PlayerEventCallback = (player: PlayerState, sessionId: string) => void;

export class MultiplayerClient {
  private client: Client;
  private room: Room | null = null;
  private serverUrl: string;
  
  // Event callbacks
  private onStateChange: GameEventCallback | null = null;
  private onPlayerJoin: PlayerEventCallback | null = null;
  private onPlayerLeave: PlayerEventCallback | null = null;
  private onPlayerDied: PlayerEventCallback | null = null;
  private onConnected: (() => void) | null = null;
  private onDisconnected: (() => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  // Track previous alive state for death detection
  private playerAliveStates = new Map<string, boolean>();

  // Local state cache
  private _state: GameState | null = null;
  private _sessionId: string = "";

  constructor(serverUrl: string = "ws://localhost:2567") {
    this.serverUrl = serverUrl;
    this.client = new Client(serverUrl);
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get state(): GameState | null {
    return this._state;
  }

  get connected(): boolean {
    return this.room !== null;
  }

  async connect(playerName: string): Promise<void> {
    try {
      this.room = await this.client.joinOrCreate("battle_royale", {
        name: playerName
      });

      this._sessionId = this.room.sessionId;
      console.log(`Connected to room ${this.room.roomId} as ${this._sessionId}`);

      this.setupRoomListeners();
      this.onConnected?.();
    } catch (error) {
      console.error("Failed to connect:", error);
      this.onError?.(error as Error);
      throw error;
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    // Initialize local state
    this._state = {
      phase: "waiting",
      countdown: 0,
      startTime: 0,
      gameTime: 0,
      playersAlive: 0,
      totalPlayers: 0,
      winnerId: "",
      players: new Map(),
      pipes: [],
      gameSpeed: 0.005,
      gravity: 0.0004,
      jumpForce: -0.008,
      pipeDistance: 0.4
    };

    // Wait for initial state to be ready
    this.room.onStateChange.once((state: any) => {
      this.updateLocalState(state);
      
      // Now set up listeners for players
      if (state.players) {
        state.players.onAdd((player: any, sessionId: string) => {
          const playerState = this.playerToState(player);
          this._state!.players.set(sessionId, playerState);
          this.playerAliveStates.set(sessionId, playerState.alive);
          this.onPlayerJoin?.(playerState, sessionId);

          // Listen to player changes
          player.onChange(() => {
            const updatedState = this.playerToState(player);
            const wasAlive = this.playerAliveStates.get(sessionId);
            
            // Debug log for all player state changes
            if (sessionId === this._sessionId) {
              console.log('[MultiplayerClient] Local player state change - alive:', updatedState.alive, 'wasAlive:', wasAlive);
            }
            
            // Detect death transition (was alive, now dead)
            if (wasAlive === true && updatedState.alive === false) {
              console.log('[MultiplayerClient] ☠️ Player died detected:', sessionId, sessionId === this._sessionId ? '(LOCAL PLAYER)' : '(other)');
              console.log('[MultiplayerClient] onPlayerDied callback exists:', !!this.onPlayerDied);
              this.onPlayerDied?.(updatedState, sessionId);
            }
            
            this.playerAliveStates.set(sessionId, updatedState.alive);
            this._state!.players.set(sessionId, updatedState);
          });
        });

        state.players.onRemove((player: any, sessionId: string) => {
          const playerState = this._state!.players.get(sessionId);
          if (playerState) {
            this._state!.players.delete(sessionId);
            this.onPlayerLeave?.(playerState, sessionId);
          }
        });
      }

      // Set up listeners for pipes
      if (state.pipes) {
        // Helper to rebuild pipes array
        const rebuildPipes = () => {
          this._state!.pipes = [];
          state.pipes.forEach((p: any) => {
            this._state!.pipes.push(this.pipeToState(p));
          });
        };

        state.pipes.onAdd((pipe: any, index: number) => {
          // Listen to pipe property changes
          pipe.onChange(() => {
            rebuildPipes();
          });

          // Listen to holes array changes
          if (pipe.holes) {
            pipe.holes.onAdd((hole: any, holeIndex: number) => {
              // Listen to individual hole changes (including itemCollectedBy)
              hole.onChange(() => {
                rebuildPipes();
              });
              
              // Listen to itemCollectedBy array changes
              if (hole.itemCollectedBy) {
                hole.itemCollectedBy.onAdd(() => {
                  rebuildPipes();
                });
              }
            });
          }
        });

        state.pipes.onRemove(() => {
          rebuildPipes();
        });
      }

      this.onStateChange?.(this._state!);
    });

    // Listen to subsequent state changes
    this.room.onStateChange((state: any) => {
      this.updateLocalState(state);
      this.onStateChange?.(this._state!);
    });

    // Listen to disconnect
    this.room.onLeave((code: number) => {
      console.log(`Left room with code ${code}`);
      this.room = null;
      this.onDisconnected?.();
    });

    // Listen to errors
    this.room.onError((code: number, message?: string) => {
      console.error(`Room error ${code}: ${message}`);
      this.onError?.(new Error(message || `Room error ${code}`));
    });
  }

  private updateLocalState(serverState: any): void {
    if (!this._state) return;

    this._state.phase = serverState.phase;
    this._state.countdown = serverState.countdown;
    this._state.startTime = serverState.startTime;
    this._state.gameTime = serverState.gameTime;
    this._state.playersAlive = serverState.playersAlive;
    this._state.totalPlayers = serverState.totalPlayers;
    this._state.winnerId = serverState.winnerId;
    this._state.gameSpeed = serverState.gameSpeed;
    this._state.gravity = serverState.gravity;
    this._state.jumpForce = serverState.jumpForce;
    this._state.pipeDistance = serverState.pipeDistance;
  }

  private playerToState(player: any): PlayerState {
    return {
      id: player.id,
      name: player.name,
      color: player.color,
      y: player.y,
      velocityY: player.velocityY,
      rotation: player.rotation,
      score: player.score,
      alive: player.alive,
      rank: player.rank,
      eliminatedAt: player.eliminatedAt,
      vision: player.vision,
      lives: player.lives,
      lastHitTime: player.lastHitTime,
      isSpectating: player.isSpectating
    };
  }

  private pipeToState(pipe: any): PipeState {
    return {
      x: pipe.x,
      holes: Array.from(pipe.holes || []).map((hole: any) => ({
        y: hole.y,
        size: hole.size,
        hasItem: hole.hasItem,
        itemCollectedBy: Array.from(hole.itemCollectedBy || [])
      })),
      passed: pipe.passed
    };
  }

  // Game actions
  flap(): void {
    if (!this.room) return;
    this.room.send("flap");
  }

  setName(name: string): void {
    if (!this.room) return;
    this.room.send("setName", name);
  }

  ready(): void {
    if (!this.room) return;
    this.room.send("ready");
  }

  disconnect(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }

  // Event handlers
  setOnStateChange(callback: GameEventCallback): void {
    this.onStateChange = callback;
  }

  setOnPlayerJoin(callback: PlayerEventCallback): void {
    this.onPlayerJoin = callback;
  }

  setOnPlayerLeave(callback: PlayerEventCallback): void {
    this.onPlayerLeave = callback;
  }

  setOnPlayerDied(callback: PlayerEventCallback): void {
    this.onPlayerDied = callback;
  }

  setOnConnected(callback: () => void): void {
    this.onConnected = callback;
  }

  setOnDisconnected(callback: () => void): void {
    this.onDisconnected = callback;
  }

  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  // Helper methods
  getMyPlayer(): PlayerState | undefined {
    return this._state?.players.get(this._sessionId);
  }

  getOtherPlayers(): PlayerState[] {
    if (!this._state) return [];
    const others: PlayerState[] = [];
    this._state.players.forEach((player, sessionId) => {
      if (sessionId !== this._sessionId) {
        others.push(player);
      }
    });
    return others;
  }

  isWinner(): boolean {
    return this._state?.winnerId === this._sessionId;
  }
}

// Singleton instance
let clientInstance: MultiplayerClient | null = null;

export function getMultiplayerClient(serverUrl?: string): MultiplayerClient {
  if (!clientInstance) {
    clientInstance = new MultiplayerClient(serverUrl);
  }
  return clientInstance;
}
