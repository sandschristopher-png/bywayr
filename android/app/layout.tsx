import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Bywayr',
  description: 'Curate and discover unmapped local spots',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ margin: 0, fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}