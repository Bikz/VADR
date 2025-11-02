import type { Metadata } from "next";
import "./globals.css";
import ClientBody from "./ClientBody";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "VADR - Voice Agent Deep Research",
  description: "Parallel voice research at scale. Type a prompt, VADR finds numbers and calls in parallel with live transcripts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="font-sans">
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
