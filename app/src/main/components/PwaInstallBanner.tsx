'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const hasDismissed = localStorage.getItem('bywayr_dismiss_install');

    if (isStandalone || hasDismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('bywayr_dismiss_install', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="animate-slide-up" style={{
      position: 'fixed',
      bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
      left: '16px',
      right: '16px',
      maxWidth: '410px',
      margin: '0 auto',
      backgroundColor: '#1c1917',
      color: '#fafaf9',
      borderRadius: '20px',
      padding: '14px 18px',
      boxShadow: '0 20px 40px -10px rgba(28, 25, 23, 0.4)',
      zIndex: 100006,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      border: '1px solid #292524',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: '#e05a47',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#ffffff',
        }}>
          <Download style={{ width: '18px', height: '18px' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Install Bywayr App</div>
          <div style={{ fontSize: '11px', color: '#a8a29e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Add to home screen for full-screen mode</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleInstallClick}
          style={{
            backgroundColor: '#e05a47',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '7px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#78716c',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
          }}
          title="Dismiss"
        >
          <X style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </div>
  );
}