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
        url: '/icon.svg',
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
    images: ['/icon.svg'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bywayr',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}