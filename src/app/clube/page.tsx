import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, UserPlus, ShoppingBag, Users, Gift, Star, Crown, CalendarHeart, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import {
  LOYALTY_LEVELS, WELCOME_BONUS_POINTS, POINTS_VALIDITY_DAYS,
} from "@/lib/loyalty/levels";
import { REDEMPTION_POINTS_PER_REAL, MIN_REDEMPTION_MARGIN } from "@/lib/loyalty/redemption";

export const metadata: Metadata = {
  title: "Clube Shark — Programa de Fidelidade | Shark Smokehouse",
  description:
    "Conheça o Clube Shark: ganhe pontos a cada compra, suba de nível (Baby, Hunter, Predatory, Megalodon) e troque por recompensas exclusivas.",
};

/* Faixa de pontos formatada para exibição (ex.: "0 – 2.999", "10.000+"). */
function range(min: number, max: number): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  return max === Infinity ? `${fmt(min)}+ pts` : `${fmt(min)} – ${fmt(max)} pts`;
}

const HOW_IT_WORKS = [
  { icon: UserPlus, title: "Cadastre-se", desc: `Ganhe ${WELCOME_BONUS_POINTS} pontos de boas-vindas assim que criar sua conta.` },
  { icon: ShoppingBag, title: "Acumule comprando", desc: "Cada real gasto vira pontos — e quanto maior o seu nível, mais pontos por real." },
  { icon: Users, title: "Indique amigos", desc: "Seu indicado fez a 1ª compra? Você ganha +50 pontos de bônus." },
  { icon: Gift, title: "Resgate recompensas", desc: "Troque seus pontos por produtos selecionados, direto na sua conta." },
];

export default function ClubePage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative px-4 pt-28 pb-16 sm:pt-32 sm:pb-20 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-warning)] opacity-[0.05] blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="flex justify-center mb-6"><Logo variant="black" size="md" asLink={false} /></div>
          <p className="text-eyebrow text-[var(--color-warning)] mb-4">
            <Crown className="w-3 h-3 inline mr-1.5 align-middle" />
            Programa de Fidelidade
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-black text-[var(--color-text-primary)] leading-tight mb-5">
            Clube <span className="text-neon">Shark</span>
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed mb-8">
            Quanto mais você curte a Shark, mais você ganha. Junte pontos a cada compra, suba de
            nível e desbloqueie recompensas e bônus exclusivos. 🦈
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="premium" size="lg" asChild>
              <Link href="/register"><Sparkles className="w-4 h-4" /> Criar conta grátis</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/catalog">Ver catálogo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ────────────────────────────────── */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow text-[var(--color-text-muted)] mb-3">Como funciona</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
              Simples assim
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass rounded-2xl border border-[var(--color-border)] p-6 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-[var(--color-neon-blue)]" />
                </div>
                <h3 className="font-bold text-[var(--color-text-primary)]">{title}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAPA DE NÍVEIS ───────────────────────────────── */}
      <section className="px-4 py-16 sm:py-20 bg-[var(--color-bg-surface)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-eyebrow text-[var(--color-warning)] mb-3">
              <Star className="w-3 h-3 inline mr-1 align-middle" /> Mapa de níveis
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
              Suba na cadeia alimentar
            </h2>
            <p className="text-[var(--color-text-muted)] mt-3 max-w-xl mx-auto">
              Seu nível é definido pelo seu saldo de pontos — e cada nível ganha mais por real gasto.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LOYALTY_LEVELS.map((level, i) => (
              <div
                key={level.name}
                className="relative rounded-2xl border p-6 flex flex-col"
                style={{
                  borderColor: `${level.color}40`,
                  background: `radial-gradient(ellipse at top right, ${level.glow}, transparent 70%), var(--color-bg-elevated)`,
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${level.color}1f`, border: `1px solid ${level.color}40` }}>
                    <Sparkles className="w-5 h-5" style={{ color: level.color }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                      Nível {i + 1}
                    </p>
                    <h3 className="text-lg font-black" style={{ color: level.color }}>{level.name}</h3>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] mb-4">{range(level.min, level.max)}</p>

                <div className="mt-auto space-y-2.5">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Star className="w-3.5 h-3.5 shrink-0" style={{ color: level.color }} />
                    <span>R$ 1,00 = <strong className="text-[var(--color-text-primary)]">{level.earnRate} pontos</strong></span>
                  </div>
                  {level.birthdayBonus > 0 && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <CalendarHeart className="w-3.5 h-3.5 shrink-0" style={{ color: level.color }} />
                      <span>+{level.birthdayBonus} pts no mês do aniversário</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REGULAMENTO ──────────────────────────────────── */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-eyebrow text-[var(--color-text-muted)] mb-3">
              <ShieldCheck className="w-3 h-3 inline mr-1 align-middle" /> Regulamento
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
              Regras do Clube
            </h2>
          </div>

          <ul className="space-y-3">
            {[
              `Bônus de boas-vindas: ${WELCOME_BONUS_POINTS} pontos creditados ao concluir o cadastro.`,
              "Acúmulo por compra: cada R$ 1,00 gasto rende pontos conforme o seu nível (de 10 a 15 pontos por real).",
              "Indicação: você ganha +50 pontos quando o amigo indicado conclui a primeira compra paga.",
              `Resgate: o custo em pontos de um produto é o valor dele × ${REDEMPTION_POINTS_PER_REAL}, disponível para itens com margem de lucro igual ou superior a ${MIN_REDEMPTION_MARGIN * 100}%.`,
              "Identificação: o CPF precisa estar cadastrado para acumular e resgatar pontos.",
              `Validade: os pontos expiram ${POINTS_VALIDITY_DAYS} dias após a data em que foram gerados.`,
              "Pontos em dobro: produtos e categorias em campanha pontuam em dobro durante a vigência.",
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-3 glass rounded-xl border border-[var(--color-border)] px-4 py-3">
                <Clock className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 text-center">
            <Button variant="premium" size="lg" asChild>
              <Link href="/register"><Sparkles className="w-4 h-4" /> Entrar para o Clube</Link>
            </Button>
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              Já tem conta? Acompanhe seus pontos em <Link href="/account" className="text-[var(--color-neon-blue)] hover:underline">Minha Conta</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ── BOTTOM BAR ───────────────────────────────────── */}
      <div className="py-6 px-4 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]">
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          ⚠️&nbsp; Venda e consumo proibidos para menores de 18 anos. Fumar faz mal à saúde.
        </p>
      </div>
    </div>
  );
}
