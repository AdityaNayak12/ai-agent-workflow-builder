'use client';

import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { NhostProvider } from '@nhost/react';
import { ApolloProvider } from '@apollo/client/react';
import { nhost, apolloClient } from '@/lib/nhost-client';
import { OrgProvider } from '@/lib/org-context';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#141414] text-[#EDEBE6] font-sans antialiased min-h-screen">
        <NhostProvider nhost={nhost}>
          <ApolloProvider client={apolloClient}>
            <OrgProvider>
              {children}
            </OrgProvider>
          </ApolloProvider>
        </NhostProvider>
      </body>
    </html>
  );
}
