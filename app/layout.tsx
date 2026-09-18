import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bywayr — Pocket Field Notes',
  description: 'Discover and curate unmapped local spots.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        style={{
          fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          /* Android 14 / Material 3 Fluid Easing Primitives */
          :root {
            --ease-emphasized: cubic-bezier(0.2, 0.0, 0, 1.0);
            --ease-emphasized-decel: cubic-bezier(0.05, 0.7, 0.1, 1.0);
            --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
          }

          /* Fluid Fade-In & Pop */
          .animate-fade-in {
            animation: fluidFadeIn 280ms var(--ease-emphasized-decel) forwards !important;
            will-change: opacity, transform;
          }

          @keyframes fluidFadeIn {
            0% {
              opacity: 0;
              transform: translate3d(0, 8px, 0) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
            }
          }

          /* Hardware acceleration & fluid curves for drawers & sheets */
          [role="dialog"],
          .drawer,
          .modal-content,
          div[style*="transition"] {
            transition-timing-function: var(--ease-emphasized) !important;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }

          /* Smooth active touch reaction without rubbery lag */
          button:active, a:active {
            transform: scale(0.975);
            transition: transform 120ms var(--ease-spring);
          }
        `}} />
        {children}
      </body>
    </html>
  );
}
