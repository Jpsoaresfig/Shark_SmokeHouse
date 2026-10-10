import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { ReportButton } from "@/components/ReportButton";
import { PromoPopup } from "@/components/PromoPopup";
import { AgeGate } from "@/components/AgeGate";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { MarketingCartTracker } from "@/components/MarketingCartTracker";

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

/** URL pública do site (OG/canonical). Vercel expõe o domínio de produção no build. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const SITE_DESCRIPTION =
  "A tabacaria premium que une sofisticação, cultura e experiência única. Charutos, narguilés, acessórios e muito mais.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Shark SmokeHouse — Tabacaria Premium",
    template: "%s | Shark SmokeHouse",
  },
  description: SITE_DESCRIPTION,
  keywords: ["tabacaria", "charutos", "narguilé", "lounge", "premium", "shark smokehouse", "joão pessoa"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Shark SmokeHouse",
    title: "Shark SmokeHouse — Tabacaria Premium",
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo_nova_preta_sq.jpeg", alt: "Shark SmokeHouse" }],
  },
  twitter: {
    card: "summary",
    title: "Shark SmokeHouse — Tabacaria Premium",
    description: SITE_DESCRIPTION,
    images: ["/logo_nova_preta_sq.jpeg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Necessário para env(safe-area-inset-*) funcionar no iOS (notch / barra home).
  viewportFit: "cover",
  themeColor: "#08080f",
  colorScheme: "dark",
};

/** Roda antes da pintura: se a idade já foi confirmada nesta sessão, marca o
 *  <html> para o CSS esconder o AgeGate renderizado no servidor (sem "piscar"). */
const AGE_GATE_SCRIPT = `try{if(sessionStorage.getItem("age_confirmed"))document.documentElement.setAttribute("data-age-ok","")}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${bodoniModa.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // O script do AgeGate adiciona `data-age-ok` ao <html> antes da hidratação.
      suppressHydrationWarning
    >
      {/* pb: reserva o espaço da MobileNav fixa (inclui a barra home do iOS) — também para o rodapé. */}
      <body className="min-h-full flex flex-col bg-[var(--color-bg-base)] pb-[var(--mobile-nav-h)] md:pb-0">
        <script dangerouslySetInnerHTML={{ __html: AGE_GATE_SCRIPT }} />
        <FirebaseAnalytics />
        <AuthProvider>
          <AgeGate />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileNav />
          <CartDrawer />
          <ReportButton />
          <PromoPopup />
          <Toaster />
          <MarketingCartTracker />
        </AuthProvider>
      </body>
    </html>
  );
}
