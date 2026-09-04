import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from './ServiceWorkerRegister';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bywayr.com'),
  applicationName: 'Bywayr',
  title: 'Bywayr — Curate & Discover Hidden Spots',
  description: 'A minimalist field guide for travelers and city wanderers to map, vouch for, and share hidden gems, alley eats, and local viewpoints.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Bywayr — Curate & Discover Hidden Spots',
    description: 'A minimalist field guide for travelers and city wanderers to map, vouch for, and share hidden gems, alley eats, and local viewpoints.',
    url: 'https://bywayr.com',
    siteName: 'Bywayr',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Bywayr Field Guide',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Bywayr — Curate & Discover Hidden Spots',
    description: 'Map, search, and curate secret spots, scenic viewpoints, and local gems.',
    images: ['/icon-512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: [
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bywayr',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-touch-fullscreen': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className} style={{ height: '100dvh', overflow: 'hidden' }}>
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', height: '100dvh', width: '100vw', overscrollBehavior: 'none' }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}