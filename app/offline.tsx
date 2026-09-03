'use client';

import { WifiOff, RefreshCcw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#f5f5f4',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      textAlign: 'center',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '20px',
        backgroundColor: '#fff1ee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e05a47',
        marginBottom: '16px',
        boxShadow: '0 10px 25px -5px rgba(224, 90, 71, 0.25)',
      }}>
        <WifiOff style={{ width: '28px', height: '28px' }} />
      </div>

      <h1 style={{
        margin: '0 0 8px 0',
        fontSize: '20px',
        fontWeight: 700,
        color: '#1c1917',
        letterSpacing: '-0.02em',
      }}>
        You're Off the Grid
      </h1>

      <p style={{
        margin: '0 0 24px 0',
        fontSize: '13.5px',
        color: '#78716c',
        maxWidth: '300px',
        lineHeight: 1.5,
      }}>
        Bywayr requires an internet connection to load live map tiles and sync field notes. Check your connection and try again.
      </p>

      <button
        onClick={() => window.location.reload()}
        style={{
          backgroundColor: '#1c1917',
          color: '#fafaf9',
          border: 'none',
          borderRadius: '14px',
          padding: '12px 20px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          boxShadow: '0 4px 14px rgba(28, 25, 23, 0.2)',
        }}
      >
        <RefreshCcw style={{ width: '15px', height: '15px' }} /> Retry Connection
      </button>
    </div>
  );
}