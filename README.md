# Crappy Fish 2

**The Flappy Bird Battle Royale where your vision is your worst enemy.**

Survive the pipes. Outlast your opponents. Fart your way to victory.

```
   Version: 0.5.5  |  Players: Up to 20  |  Mode: Battle Royale
```

---

## Play Now

> **Live Game:** https://crappy-fish-2.vercel.app/

---

## What Is This Madness?

Crappy Fish 2 takes the classic Flappy Bird formula and cranks it up to chaos:

- **20 players** flapping through pipes at the same time
- **Your vision degrades** the longer you survive (you're underwater, after all)
- **Collect diving masks** to restore your sight... but they're addictive - each one makes your vision degrade faster next time
- **2 lives** to prove you're not just another fish in the sea
- **Fart-powered jumps** because why not

It's not about being the best. It's about being the last fish swimming.

---

## Features

### Battle Royale Chaos
Up to 20 players compete in real-time. No teams. No mercy. Just you, your farts, and a whole lot of pipes.

### The Vision Curse
Your screen progressively blurs as your fish struggles underwater. The edges go first, then everything becomes a murky mess. Can you navigate when you can barely see?

### Diving Mask Power-ups
Glowing masks appear inside pipes. Grab one and your vision is restored! But here's the catch: each mask increases how fast your vision degrades. It's a deal with the devil. You'll keep grabbing them anyway.

### The Lives System
You get 2 lives. Lose one and you'll respawn with a golden glow of invulnerability (2 seconds to get your bearings). Lose both and it's game over - time to spectate and judge everyone else's skills.

### Multi-Hole Pipes
Pipes have 1 to 3 holes of varying sizes. Choose your path wisely. Or panic. Panicking works too.

### Immersive Audio Experience
- 7 unique fart sounds for jumping (yes, really)
- Death sounds that capture the drama of your demise
- Screams when you lose a life
- Mask collection sounds
- An actual main theme (it slaps)

### Server-Authoritative
All game logic runs on the server. No cheating. No hacks. Just pure skill and luck.

---

## How to Play

### Controls

| Platform | Action |
|----------|--------|
| Desktop  | `Space` or `Click` to flap |
| Mobile   | `Tap` anywhere to flap |

### Gameplay Loop

1. Enter your name (make it memorable)
2. Click **PLAY** to join the lobby
3. Wait for at least 2 players (5-second countdown)
4. Flap through pipes, avoid the ground and ceiling
5. Watch your vision fade - grab masks to restore it
6. Be the last fish swimming

### Strategy Tips

- **Mask dilemma**: Early masks are worth it. Late-game masks might kill you faster than they save you.
- **Stay centered**: When your vision goes, muscle memory is all you have.
- **Watch the edges**: The blur effect is strongest at the screen edges.
- **Use your lives wisely**: That 2-second invulnerability after respawning can save you from a tricky pipe.

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│    Next.js 16  •  React 19  •  TypeScript  •  Canvas 2D    │
│                    WebGL (blur shader)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                    WebSocket (Colyseus)
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                         BACKEND                             │
│         Colyseus  •  Node.js  •  TypeScript                │
│              Server-authoritative game logic                │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, SASS |
| Rendering | Canvas 2D + WebGL post-processing (radial blur shader) |
| Backend | Colyseus, Express, Node.js |
| Real-time | WebSocket with schema-based state sync |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- OR [devenv.sh](https://devenv.sh/) (recommended)

### Quick Start with devenv (Recommended)

The fastest way to get everything running:

```bash
# Enter the devenv shell
devenv shell

# Install all dependencies (client + server)
install

# Start both servers with one command
dev
```

Done. Frontend at `http://localhost:3000`, backend at `ws://localhost:2567`.

### Manual Setup

**Step 1: Install dependencies**

```bash
# Frontend (from project root)
pnpm install

# Backend
cd server
pnpm install
```

**Step 2: Start the servers (two terminals)**

Terminal 1 - Backend:
```bash
cd server
pnpm dev
```

Terminal 2 - Frontend:
```bash
pnpm dev
```

**Step 3: Test multiplayer**

Open `http://localhost:3000` in multiple browser tabs. You are now your own worst enemy.

---

## Environment Variables

### Frontend (`.env` in project root)

```env
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
```

For production, use your deployed WebSocket URL:
```env
NEXT_PUBLIC_GAME_SERVER_URL=wss://your-server.onrender.com
```

### Backend (`server/.env`)

```env
DEBUG_MODE=true      # true = game starts with 1 player (testing)
NODE_ENV=development
PORT=2567
```

For production:
```env
DEBUG_MODE=false     # Requires 2+ players to start
NODE_ENV=production
PORT=2567
```

---

## Project Structure

```
crappy-fish-2/
├── app/                        # Next.js frontend
│   ├── page.tsx                # Main entry (Battle Royale)
│   └── game/
│       ├── multiplayer/        # Multiplayer components
│       │   ├── BattleRoyaleGame.tsx      # React wrapper
│       │   ├── BattleRoyaleRenderer.ts   # Canvas rendering
│       │   └── MultiplayerClient.ts      # Colyseus client
│       ├── rendering/
│       │   └── WebGLPostProcessor.ts     # Vision blur shader
│       └── core/               # Single-player game engine
├── server/                     # Colyseus backend
│   └── src/
│       ├── index.ts            # Server entry
│       ├── rooms/
│       │   └── BattleRoyaleRoom.ts   # Game logic
│       └── schema/
│           └── BattleRoyaleState.ts  # Shared state
├── public/
│   └── game-assets/            # Sprites, audio, fonts
└── Configuration files...
```

---

## Available Scripts

### Frontend

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Run production build |
| `pnpm lint` | Run ESLint |

### Backend (from `/server`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start with hot reload (DEBUG_MODE=true) |
| `pnpm dev:prod` | Start with hot reload (production settings) |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled server |

### devenv

| Command | Description |
|---------|-------------|
| `install` | Install all dependencies |
| `build` | Build both projects |
| `dev` | Start both servers |
| `devenv up -d` | Start in background |
| `devenv stop` | Stop background servers |

---

## Deployment

### Frontend on Vercel

1. Connect your GitHub repo to Vercel
2. Add environment variable:
   - `NEXT_PUBLIC_GAME_SERVER_URL` = `wss://your-server.onrender.com`
3. Deploy

Vercel will auto-detect Next.js and handle the rest.

### Backend on Render

1. Connect your GitHub repo to Render
2. Create a **Web Service** with these settings:

| Setting | Value |
|---------|-------|
| Build Command | `cd server && pnpm install && pnpm build` |
| Start Command | `cd server && pnpm start` |
| Environment | `NODE_ENV=production`, `PORT=2567` |

3. Deploy and grab your WebSocket URL

---

## Architecture Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Player 1   │         │   Player 2   │         │   Player N   │
│   Browser    │         │   Browser    │         │   Browser    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │    "flap" messages     │                        │
       └────────────────────────┼────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    Colyseus Server    │
                    │  (Server-Authoritative)│
                    │                       │
                    │  • Physics @ 60 FPS   │
                    │  • Collision detection│
                    │  • State management   │
                    │  • Win conditions     │
                    └───────────┬───────────┘
                                │
                    State sync (Schema)
                                │
                                ▼
                    ┌───────────────────────┐
                    │   All Players Receive │
                    │   Synchronized State  │
                    └───────────────────────┘
```

**Key Points:**
- Players only send "flap" commands
- Server runs all physics and collision detection
- State is automatically synchronized to all clients
- 60 FPS tick rate for smooth gameplay

---

## Credits

- Original Flappy Bird game engine adapted from [jxmked/Flappybird](https://github.com/jxmked/Flappybird)
- Multiplayer framework powered by [Colyseus](https://colyseus.io/)
- Built with love, fart sounds, and questionable life choices

---

## License

MIT License - Do whatever you want with it. Make it weirder.

---

**Now go flap, you beautiful fish.**
