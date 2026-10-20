import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grave — Documentation, thoughtfully made",
  description: "A home for your product knowledge. Read, write, and publish with Grave.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
