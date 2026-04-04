import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ScreenshotProtection from "@/components/ScreenshotProtection";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "اختبار رخصة القيادة - Test du Permis de Conduire Maroc",
  description: "Application officielle de test du permis de conduire au Maroc - تطبيق اختبار رخصة القيادة بالمغرب",
  keywords: ["Permis conduire", "Maroc", "Test", "رخصة القيادة", "المغرب", "اختبار"],
  authors: [{ name: "Permis Maroc" }],
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          fontFamily: "'Noto Sans Arabic', 'Segoe UI', Arial, sans-serif",
          minHeight: "100vh",
          margin: 0,
          padding: 0,
          background: "#E0E0E0",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          KhtmlUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
        }}
      >
        {children}
        <Toaster />
        <ScreenshotProtection />
      </body>
    </html>
  );
}
