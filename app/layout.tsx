import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dillard AI Short Content Engine",
  description: "Research → Script → Clone + AI B-roll → QC → Publish everywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur z-50">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <h1 className="font-bold tracking-tight">
              Dillard <span className="text-brand">AI</span> Short Content Engine
            </h1>
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white">Queue</Link>
            <Link href="/settings" className="hover:text-white">Settings</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
