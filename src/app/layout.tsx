import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { AgeGate } from "@/components/AgeGate";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Shark SmokeHouse — Tabacaria Premium",
    template: "%s | Shark SmokeHouse",
  },
  description:
    "A tabacaria premium que une sofisticação, cultura e experiência única. Charutos, narguilés, acessórios e muito mais.",
  keywords: ["tabacaria", "charutos", "narguilé", "lounge", "premium", "shark smokehouse"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Shark SmokeHouse",
  },
  icons: { icon: "/logo_shark_branca.jpeg", apple: "/logo_shark_branca.jpeg" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-bg-base)]">
        <FirebaseAnalytics />
        <AuthProvider>
        <AgeGate />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartDrawer />
        <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
