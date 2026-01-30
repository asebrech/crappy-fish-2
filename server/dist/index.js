"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@colyseus/core");
const ws_transport_1 = require("@colyseus/ws-transport");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const BattleRoyaleRoom_1 = require("./rooms/BattleRoyaleRoom");
const port = Number(process.env.PORT) || 2567;
const app = (0, express_1.default)();
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
const httpServer = (0, http_1.createServer)(app);
const gameServer = new core_1.Server({
    transport: new ws_transport_1.WebSocketTransport({
        server: httpServer,
    }),
});
// Register the Battle Royale room
gameServer.define("battle_royale", BattleRoyaleRoom_1.BattleRoyaleRoom);
httpServer.listen(port, () => {
    console.log(`🎮 Flappy Royale Server listening on port ${port}`);
    console.log(`   WebSocket: ws://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/health`);
});
