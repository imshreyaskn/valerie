import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Valerie Red Team",
  description: "LLM Red Teaming Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header>
          <div className="container header-content">
            <Link href="/" className="logo">Valerie<span style={{color: "var(--primary-color)"}}>.</span></Link>
            <nav>
              <Link href="/runs/new" className="btn">New Run</Link>
            </nav>
          </div>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
