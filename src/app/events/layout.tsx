import type { Metadata } from "next";

/** Metadados da rota (a página é client component e não pode exportá-los). */
export const metadata: Metadata = {
  title: "Eventos",
  description:
    "Agenda de eventos da Shark SmokeHouse em João Pessoa/PB: noites exclusivas, música ao vivo e experiências no lounge.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
