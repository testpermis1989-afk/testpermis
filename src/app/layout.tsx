import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
    icon: "/logo.svg",
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
          background: "#E0E0E0"
        }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
