import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { THEME_BOOT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'tecla*',
  description: 'Práctica de tipeo con fantasma, heatmap, carreras, juegos arcade y modos de estudio con tu propio material.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" data-accent="celeste" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* el canvas del arcade dibuja con estos nombres de fuente, por eso van por link y no por next/font */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Martian+Mono:wght@400;600;800&display=swap" />
      </head>
      <body>
        <div className="pat tr" aria-hidden="true" />
        <div className="pat bl" aria-hidden="true" />
        <div className="app">
          <Header />
          <div className="deco" data-n="220" aria-hidden="true" />
          <main>{children}</main>
        </div>
        <AppShell />
      </body>
    </html>
  );
}
