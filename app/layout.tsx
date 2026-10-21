import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grave — Documentation, thoughtfully made",
  description: "A home for your product knowledge. Read, write, and publish with Grave.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{url: "/favicon-32.png", type: "image/png", sizes: "32x32"}],
    shortcut: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/inter-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
