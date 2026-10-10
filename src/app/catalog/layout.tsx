import type { Metadata } from "next";

/** Metadados da rota (a página é client component e não pode exportá-los). */
export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Charutos, narguilés, essências, acessórios e bebidas da Shark SmokeHouse em João Pessoa/PB. Compre online com entrega ou retirada na loja.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
