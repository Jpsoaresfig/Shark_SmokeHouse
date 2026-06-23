"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, Copy, Check, Gift, TrendingUp, Users,
  Sparkles, ArrowUpRight, ArrowDownLeft, Clock,
  LogIn, ChevronRight, Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import {
  getLoyaltyTransactions, getLoyaltyRewards, redeemReward,
} from "@/lib/firebase/loyalty";
import { getUserProfile } from "@/lib/firebase/users";
import { formatDateTime } from "@/lib/utils";
import { LoyaltyProgramModal } from "@/components/account/LoyaltyProgramModal";
import { getLevel, getNextLevel, getLevelProgress, REFERRAL_BONUS_POINTS } from "@/lib/loyalty/levels";
import type { LoyaltyTransaction, LoyaltyReward } from "@/types";

/* ── Tier helpers (níveis reais do Clube Shark — engine única) ── */
const getTier = getLevel;
const getNextTier = getNextLevel;
const getTierProgress = getLevelProgress;

/* ── Transaction type label ──────────────────────────────── */
const txLabels: Record<string, { label: string; positive: boolean }> = {
  earned:   { label: "Pontos ganhos",   positive: true  },
  referral: { label: "Indicação",        positive: true  },
  bonus:    { label: "Bônus",            positive: true  },
  welcome:  { label: "Boas-vindas",      positive: true  },
  redeemed: { label: "Resgate",          positive: false },
  expired:  { label: "Pontos expirados", positive: false },
};

/* ── Referral link card ──────────────────────────────────── */
function ReferralCard({ referralCode, uid }: { referralCode: string; uid: string }) {
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState<number | null>(null);

  useEffect(() => {
    getLoyaltyTransactions(uid).then((txs) => {
      setReferralCount(txs.filter((t) => t.type === "referral").length);
    });
  }, [uid]);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${appUrl}/register?ref=${referralCode}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-neon-blue-glow)] flex items-center justify-center">
            <Users className="w-4 h-4 text-[var(--color-neon-blue)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Seu Link de Indicação</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Ganhe <strong className="text-[var(--color-neon-blue)]">{REFERRAL_BONUS_POINTS} pts</strong> por amigo que fizer a 1ª compra
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] mb-4">
          <span className="flex-1 text-xs text-[var(--color-text-secondary)] font-mono truncate">
            {link}
          </span>
          <button
            onClick={copy}
            className="shrink-0 p-1.5 rounded-lg bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)] hover:text-[var(--color-bg-base)] transition-all"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied
                ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5" /></motion.span>
                : <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-3.5 h-3.5" /></motion.span>
              }
            </AnimatePresence>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-center">
            <p className="text-lg font-black text-[var(--color-neon-blue)]">{referralCount ?? "—"}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Indicações feitas</p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-center">
            <p className="text-lg font-black text-[var(--color-success)]">
              {referralCount != null ? referralCount * REFERRAL_BONUS_POINTS : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Pts por indicações</p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)]/50">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            <strong className="text-[var(--color-text-secondary)]">Como funciona:</strong> compartilhe seu link, quando alguém se cadastrar e fizer a 1ª compra você ganha <strong className="text-[var(--color-neon-blue)]">{REFERRAL_BONUS_POINTS} pontos</strong> automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Reward card ─────────────────────────────────────────── */
function RewardCard({
  reward, currentPoints, onRedeem,
}: {
  reward: LoyaltyReward;
  currentPoints: number;
  onRedeem: (reward: LoyaltyReward) => void;
}) {
  const canRedeem = currentPoints >= reward.pointsCost && reward.stock > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 transition-all ${
        canRedeem
          ? "border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]/20 hover:border-[var(--color-neon-blue)]/60"
          : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-overlay)] flex items-center justify-center text-2xl shrink-0 overflow-hidden">
          {reward.image && /^https?:\/\//.test(reward.image) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reward.image} alt={reward.name} className="w-full h-full object-cover" />
          ) : (
            reward.image ?? "🎁"
          )}
        </div>
        <Badge variant={reward.stock > 0 ? "default" : "orange"} className="text-xs shrink-0">
          {reward.stock > 0 ? `${reward.stock} disp.` : "Esgotado"}
        </Badge>
      </div>
      <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{reward.name}</h4>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">{reward.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-[var(--color-warning)]" />
          <span className="text-sm font-bold text-[var(--color-warning)]">{reward.pointsCost} pts</span>
        </div>
        <Button
          size="sm"
          variant={canRedeem ? "premium" : "secondary"}
          disabled={!canRedeem}
          onClick={() => onRedeem(reward)}
          className="text-xs"
        >
          {canRedeem ? "Resgatar" : currentPoints < reward.pointsCost ? "Pts insuf." : "Esgotado"}
        </Button>
      </div>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function AccountPage() {
  const { user: storeUser, setUser, firebaseReady } = useAuthStore();
  const [points, setPoints] = useState(storeUser?.loyaltyPoints ?? 0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // Depende só do `uid` (não do objeto storeUser inteiro): senão setUser → muda
  // storeUser → recria load → re-roda o efeito → loop infinito de carregamento
  // ("piscando" sem parar). getUserProfile retorna o perfil completo, então
  // substituímos o usuário direto.
  const uid = storeUser?.uid;

  const load = useCallback(async () => {
    if (!uid) return;
    setLoadingTx(true);
    setLoadingRewards(true);

    // Each fetch is isolated so a single failure (e.g. a missing Firestore
    // index on rewards) can't blank out the whole page, and the `finally`
    // blocks guarantee the loading skeletons always resolve.
    getUserProfile(uid)
      .then((fresh) => {
        if (fresh) {
          setPoints(fresh.loyaltyPoints ?? 0);
          setUser(fresh);
        }
      })
      .catch((err) => console.error("Falha ao carregar perfil:", err));

    getLoyaltyTransactions(uid)
      .then(setTransactions)
      .catch((err) => {
        console.error("Falha ao carregar histórico de pontos:", err);
        toast.error("Não foi possível carregar o histórico de pontos.");
      })
      .finally(() => setLoadingTx(false));

    getLoyaltyRewards()
      .then(setRewards)
      .catch((err) => console.error("Falha ao carregar recompensas:", err))
      .finally(() => setLoadingRewards(false));
  }, [uid, setUser]);

  // Wait for Firebase Auth to be confirmed before querying Firestore
  useEffect(() => { if (firebaseReady) load(); }, [firebaseReady, load]);

  if (!storeUser) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-7 h-7 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Faça login para continuar</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Acesse sua conta para ver seus pontos e indicações.</p>
          <Button variant="premium" asChild>
            <Link href="/login">Entrar <ChevronRight className="w-4 h-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  const tier = getTier(points);
  const nextTier = getNextTier(points);
  const progress = getTierProgress(points);

  // Produtos que o cliente JÁ consegue resgatar agora (pontos suficientes + em
  // estoque). A lista completa aparece logo abaixo para ele não ter que caçar.
  const redeemableRewards = rewards.filter((r) => points >= r.pointsCost && r.stock > 0);

  const handleRedeem = async (reward: LoyaltyReward) => {
    setRedeemingId(reward.id);
    try {
      await redeemReward(storeUser.uid, reward, points, {
        name: storeUser.displayName,
        phone: storeUser.phone,
      });
      setPoints((p) => p - reward.pointsCost);
      setRewards((prev) => prev.map((r) => r.id === reward.id ? { ...r, stock: r.stock - 1 } : r));
      setTransactions((prev) => [{
        id: Date.now().toString(),
        userId: storeUser.uid,
        type: "redeemed",
        points: -reward.pointsCost,
        reason: `Resgate: ${reward.name}`,
        rewardId: reward.id,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      toast.success(`Resgate de "${reward.name}" confirmado! Entre em contato para retirada.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <p className="text-eyebrow text-[var(--color-neon-blue)] mb-2">Clube Fidelidade</p>
            <h1 className="text-3xl font-black text-[var(--color-text-primary)]">Minha Conta</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Olá, {storeUser.displayName?.split(" ")[0]}!</p>
          </div>
          <LoyaltyProgramModal />
        </motion.div>

        {/* Points + tier card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative rounded-2xl overflow-hidden border border-[var(--color-border)] mb-6"
          style={{ background: `radial-gradient(ellipse at top right, ${tier.glow}, transparent 60%), var(--color-bg-elevated)` }}
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              {/* Points */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4" style={{ color: tier.color }} />
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tier.color }}>
                    Tier {tier.name}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black tabular-nums" style={{ color: tier.color }}>
                    {points.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-lg text-[var(--color-text-muted)] mb-1">pontos</span>
                </div>
              </div>

              {/* Tier badge */}
              <div
                className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl border shrink-0"
                style={{ borderColor: `${tier.color}40`, background: `${tier.glow}` }}
              >
                <Sparkles className="w-7 h-7 mb-1" style={{ color: tier.color }} />
                <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.name}</span>
              </div>
            </div>

            {/* Progress to next tier */}
            {nextTier && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Progresso para <strong style={{ color: nextTier.color }}>{nextTier.name}</strong>
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {points.toLocaleString("pt-BR")} / {nextTier.min.toLocaleString("pt-BR")} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-bg-overlay)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    className="h-full rounded-full"
                    style={{ background: tier.color }}
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  Faltam <strong className="text-[var(--color-text-secondary)]">{(nextTier.min - points).toLocaleString("pt-BR")} pts</strong> para o próximo nível
                </p>
              </div>
            )}

            {/* Tier perks */}
            <div className="mt-5 flex flex-wrap gap-2">
              {!nextTier && (
                <span className="text-xs px-3 py-1 rounded-full border border-[var(--color-neon-blue)]/40 text-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]">
                  Nível máximo atingido!
                </span>
              )}
              <span className="text-xs px-3 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]">
                R$ 1 = {tier.earnRate} pts neste nível
              </span>
              {tier.birthdayBonus > 0 && (
                <span className="text-xs px-3 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  +{tier.birthdayBonus} pts no mês do aniversário
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Grid: referral + history */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Referral */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            {storeUser.referralCode
              ? <ReferralCard referralCode={storeUser.referralCode} uid={storeUser.uid} />
              : (
                <Card>
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full py-10 gap-3">
                    <Users className="w-10 h-10 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-secondary)]">Link de indicação não disponível</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Faça logout e entre novamente para ativar.</p>
                  </CardContent>
                </Card>
              )
            }
          </motion.div>

          {/* Transaction history */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Histórico de Pontos</h3>
                </div>

                {loadingTx ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="skeleton h-12 rounded-xl" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                    <Clock className="w-8 h-8 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Nenhuma movimentação ainda</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {transactions.map((tx) => {
                      const meta = txLabels[tx.type] ?? { label: tx.reason, positive: tx.points > 0 };
                      return (
                        <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.positive ? "bg-[var(--color-success)]/10" : "bg-red-500/10"}`}>
                            {meta.positive
                              ? <ArrowUpRight className="w-3.5 h-3.5 text-[var(--color-success)]" />
                              : <ArrowDownLeft className="w-3.5 h-3.5 text-[var(--color-error)]" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{meta.label}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">{formatDateTime(tx.createdAt)}</p>
                          </div>
                          <span className={`text-sm font-bold shrink-0 ${meta.positive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
                            {meta.positive ? "+" : ""}{tx.points}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Rewards */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-[var(--color-warning)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Resgatar Recompensas</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Troque seus pontos por produtos exclusivos</p>
            </div>
          </div>

          {loadingRewards ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-48 rounded-2xl" />
              ))}
            </div>
          ) : rewards.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-overlay)] flex items-center justify-center">
                <Zap className="w-6 h-6 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Em breve, novos resgates</p>
              <p className="text-xs text-[var(--color-text-muted)]">Continue acumulando pontos — em breve você poderá trocá-los por produtos exclusivos.</p>
              <Link href="/catalog" className="text-xs text-[var(--color-neon-blue)] hover:underline flex items-center gap-1 mt-1">
                Ver catálogo <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <>
              {/* 1) O que você JÁ pode resgatar com seus pontos */}
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--color-neon-blue)]" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Você pode resgatar agora</h3>
                {redeemableRewards.length > 0 && (
                  <Badge variant="default" className="text-xs">{redeemableRewards.length}</Badge>
                )}
              </div>

              {redeemableRewards.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {redeemableRewards.map((reward) => (
                    <RewardCard key={reward.id} reward={reward} currentPoints={points} onRedeem={handleRedeem} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-overlay)] flex items-center justify-center shrink-0">
                    <Star className="w-6 h-6 text-[var(--color-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Você não tem pontos para resgatar nenhum produto ainda.
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Continue acumulando pontos a cada compra — veja abaixo tudo o que dá pra resgatar e quanto falta.
                    </p>
                  </div>
                </div>
              )}

              {/* 2) Catálogo completo de resgates, para não ter que caçar */}
              <div className="flex items-center gap-2 mb-3 mt-8">
                <Gift className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Todos os produtos para resgate</h3>
                <Badge variant="secondary" className="text-xs">{rewards.length}</Badge>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.map((reward) => (
                  <RewardCard key={reward.id} reward={reward} currentPoints={points} onRedeem={handleRedeem} />
                ))}
              </div>
            </>
          )}
        </motion.div>

        {redeemingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass rounded-2xl border border-[var(--color-border)] p-8 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[var(--color-neon-blue)]/30 border-t-[var(--color-neon-blue)] rounded-full animate-spin" />
              <p className="text-sm text-[var(--color-text-secondary)]">Processando resgate...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
