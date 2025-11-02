import type { Metadata } from "next";
import { Inter, Kodchasan } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const kodchasan = Kodchasan({ 
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-kodchasan",
});

export const metadata: Metadata = {
  title: "TARA - Voice Agent Deep Research",
  description: "Parallel voice research at scale. Type a prompt, TARA finds numbers and calls in parallel with live transcripts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`font-sans ${inter.variable} ${kodchasan.variable}`}>
      <head>
        <Script
          crossOrigin="anonymous"
          src="//unpkg.com/same-runtime/dist/index.global.js"
        />
      </head>
      <body suppressHydrationWarning className="antialiased">
        <ClientBody>{children}</ClientBody>
        <Analytics />
      </body>
    </html>
  );
}
