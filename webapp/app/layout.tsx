import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sage Realms - Starknet Token-Gating Platform",
  description: "The first Starknet-native guild management platform with ZK-powered privacy and onchain reputation.",
  icons: {
    icon: [
      { url: '/bitsage-logo.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/bitsage-logo.svg',
    apple: '/bitsage-logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
