# Flappy Bird Battle Royale 🐦⚔️

A multiplayer Battle Royale version of Flappy Bird built with Next.js and Colyseus.

## 🎮 Play Online

**Live Game:** [Deploying soon...]

## 🚀 Features

- **Battle Royale Mode**: Last bird flying wins!
- **Real-time Multiplayer**: Up to 20 players per game
- **Auto-start**: Game begins when 2+ players join
- **Server-authoritative**: No cheating possible

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Canvas API
- **Backend**: Colyseus (Node.js WebSocket server)
- **Deployment**: Vercel (frontend) + Render (backend)

## 📦 Local Development

### Prerequisites
- Node.js 18+
- pnpm
- **OR** [devenv.sh](https://devenv.sh/) (recommended for easy setup)

### Quick Start with devenv.sh (Recommended) ⚡

If you have devenv installed:

```bash
# Enter the devenv shell
devenv shell

# Install dependencies
install

# Start both servers with one command!
dev
```

That's it! Both the backend (ws://localhost:2567) and frontend (http://localhost:3000) will start automatically.

**devenv Commands:**
- `install` - Install all dependencies (client + server)
- `build` - Build both projects
- `dev` - Start both servers in foreground
- `devenv up -d` - Start both servers in background
- `devenv stop` - Stop background servers

### Manual Setup (Without devenv)

**Install Dependencies:**
```bash
# Install frontend dependencies
pnpm install

# Install server dependencies
cd server
pnpm install
```

**Run Development Servers:**

Terminal 1 - Backend:
```bash
cd server
pnpm dev
```

Terminal 2 - Frontend:
```bash
pnpm dev
```

Open http://localhost:3000 in multiple browser tabs to test multiplayer!

## 🌐 Deployment

### Backend (Render)
1. Connect your GitHub repo to Render
2. Create a new Web Service pointing to this repo
3. Use these settings:
   - **Build Command**: `cd server && pnpm install && pnpm build`
   - **Start Command**: `cd server && pnpm start`
   - **Environment Variables**: `PORT=2567`, `NODE_ENV=production`

### Frontend (Vercel)
1. Connect your GitHub repo to Vercel
2. Add environment variable:
   - `NEXT_PUBLIC_GAME_SERVER_URL` = `wss://your-render-app.onrender.com`
3. Deploy!

## 🎯 How to Play

1. Enter your name
2. Click "PLAY" to connect
3. Wait for 2+ players to join (5 second countdown)
4. Press **Space** / **Click** / **Tap** to flap
5. Avoid pipes and the ground
6. Last bird flying wins!

## 📝 License

MIT

## 🙏 Credits

Original Flappy Bird game imported from https://github.com/jxmked/Flappybird
