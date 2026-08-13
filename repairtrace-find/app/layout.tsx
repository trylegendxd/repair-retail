import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "./pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RepairTrace Find",
  description: "Check repair prices, post a device problem and compare offers from nearby electronics providers.",
  applicationName: "RepairTrace Find",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable:true, title:"RepairTrace Find", statusBarStyle:"black-translucent" },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon.svg",
  },
};

export const viewport = { themeColor:"#10251d", width:"device-width", initialScale:1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegister/>{children}
      </body>
    </html>
  );
}
