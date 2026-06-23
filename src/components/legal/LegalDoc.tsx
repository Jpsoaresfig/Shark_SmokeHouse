import { AlertTriangle } from "lucide-react";

/* Documento jurídico (Termos / Privacidade) — layout único reaproveitado pelas
   duas páginas. É um componente de servidor (conteúdo estático), então não
   carrega JS no cliente. As páginas só fornecem os dados das seções. */

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/* Primitivos de tipografia — mantêm o texto legível e consistente entre as
   páginas sem depender do plugin de typography. */
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm sm:text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
      {children}
    </p>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm sm:text-[15px] leading-relaxed text-[var(--color-text-secondary)] marker:text-[var(--color-neon-blue)]">
      {children}
    </ul>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>;
}

export function LegalDoc({
  eyebrow,
  title,
  updatedAt,
  lead,
  highlight,
  sections,
}: {
  eyebrow: string;
  title: string;
  updatedAt: string;
  lead: React.ReactNode;
  highlight: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen pt-24 sm:pt-28 pb-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Cabeçalho */}
        <p className="text-eyebrow text-[var(--color-neon-blue)] mb-3">{eyebrow}</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-3 leading-tight">
          {title}
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mb-8">
          Última atualização: {updatedAt}
        </p>

        <div className="space-y-3 mb-8">{lead}</div>

        {/* Caixa de destaque (18+ / produtos controlados) */}
        <div className="mb-10 rounded-2xl border border-[var(--color-warning)]/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
            <span className="text-sm font-bold text-[var(--color-warning)]">Aviso importante</span>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {highlight}
          </div>
        </div>

        {/* Índice */}
        <nav className="mb-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
            Índice
          </p>
          <ol className="space-y-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] transition-colors"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Seções */}
        <div className="space-y-9">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] mb-3">
                <span className="text-[var(--color-neon-blue)]">{i + 1}.</span> {s.title}
              </h2>
              <div className="space-y-3">{s.body}</div>
            </section>
          ))}
        </div>

        {/* Rodapé legal */}
        <div className="mt-12 pt-6 border-t border-[var(--color-border)] text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            ⚠️&nbsp; Venda e consumo proibidos para menores de 18 anos. Fumar faz mal à saúde.
          </p>
        </div>
      </div>
    </div>
  );
}
