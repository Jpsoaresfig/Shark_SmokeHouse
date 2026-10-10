import type { Metadata } from "next";

/** Metadados da rota (a página é client component e não pode exportá-los). */
export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a Shark SmokeHouse pelo WhatsApp, telefone ou Instagram. Endereço e horário de funcionamento em João Pessoa/PB.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
