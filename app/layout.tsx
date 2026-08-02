import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Navbar } from "@/components/layout/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://economonitor.azurewebsites.net",
  ),
  title: {
    default: "EconoMonitor — US Economic Research",
    template: "%s | EconoMonitor",
  },
  description:
    "Explore, chart, and compare thousands of economic indicators from the Federal Reserve Bank of St. Louis FRED database.",
  applicationName: "EconoMonitor",
  openGraph: {
    type: "website",
    siteName: "EconoMonitor",
    title: "EconoMonitor — US Economic Research",
    description:
      "Explore, chart, and compare US economic indicators from FRED and historical sources from FRASER.",
  },
  twitter: {
    card: "summary",
    title: "EconoMonitor — US Economic Research",
    description:
      "Explore, chart, and compare US economic indicators from FRED and FRASER.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[100] rounded-md px-4 py-2 font-medium focus:not-sr-only"
          style={{ background: "var(--accent)", color: "white" }}
        >
          Skip to content
        </a>
        <Providers>
          <Navbar />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto max-w-7xl px-4 py-6 focus:outline-none"
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
