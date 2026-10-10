import type { Metadata } from "next";

/** Metadados da rota (a página é client component e não pode exportá-los). */
export const metadata: Metadata = {
  title: "Sobre Nós",
  description:
    "Conheça a Shark SmokeHouse, tabacaria premium e lounge em Mangabeira, João Pessoa/PB.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
