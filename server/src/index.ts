import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { createServer } from "http";
import { BattleRoyaleRoom } from "./rooms/BattleRoyaleRoom";

const port = Number(process.env.PORT) || 2567;

const app = express();

// CORS middleware for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

// Register the Battle Royale room
gameServer.define("battle_royale", BattleRoyaleRoom);

httpServer.listen(port, () => {
  console.log(`🎮 Flappy Royale Server listening on port ${port}`);
  console.log(`   WebSocket: ws://localhost:${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
});
