'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Bywayr SW registered:', reg.scope))
        .catch((err) => console.error('Bywayr SW registration failed:', err));
    }
  }, []);

  return null;
}