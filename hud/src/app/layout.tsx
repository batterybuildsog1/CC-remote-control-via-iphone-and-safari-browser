import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent HUD",
  description: "Monitor and control autonomous AI agents",
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
