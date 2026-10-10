import type { Metadata } from "next";

/** Metadados da rota (a página é client component e não pode exportá-los). */
export const metadata: Metadata = {
  title: "Narguilé Lounge — Reservas",
  description:
    "Reserve sua mesa no Narguilé Lounge da Shark SmokeHouse em João Pessoa/PB: essências nacionais e importadas, drinks e música ao vivo.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
