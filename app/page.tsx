'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Battle Royale game component with SSR disabled
const BattleRoyaleGame = dynamic(() => import('./game/multiplayer/BattleRoyaleGame'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(28, 28, 30, 1)',
      color: 'white'
    }}>
      Loading game...
    </div>
  )
});

export default function Home() {
  // Use environment variable for server URL in production
  const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'ws://localhost:2567';

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <BattleRoyaleGame serverUrl={serverUrl} />
    </main>
  );
}
