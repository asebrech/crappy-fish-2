'use client';

import dynamic from 'next/dynamic';

// Dynamically import the game component with SSR disabled
// Canvas-based games require the browser environment
const FlappyBirdGame = dynamic(() => import('./FlappyBirdGame'), {
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

export default function GamePage() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <FlappyBirdGame />
    </main>
  );
}
