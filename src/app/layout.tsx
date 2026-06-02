import type { Metadata } from "next";
import { Bodoni_Moda, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { ReportButton } from "@/components/ReportButton";
import { AgeGate } from "@/components/AgeGate";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/toaster";

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
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
      className={`${bodoniModa.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-bg-base)]">
        <FirebaseAnalytics />
        <AuthProvider>
          <AgeGate />
          <Header />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
          <CartDrawer />
          <ReportButton />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
