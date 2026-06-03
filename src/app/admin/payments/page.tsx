"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { QrCode, Save, RefreshCw, KeyRound, User, Copy, Check, CreditCard, Percent } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase/settings";
import { useSiteSettingsStore } from "@/stores/siteSettingsStore";
import { toast } from "@/stores/toastStore";

export default function AdminPayments() {
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [pixQrPayload, setPixQrPayload] = useState("");
  const [creditFee, setCreditFee] = useState(""); // % no crédito (vazio = sem diferença)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSiteSettings();
      setPixKey(s.payment.pixKey);
      setPixName(s.payment.pixName);
      setPixQrPayload(s.payment.pixQrPayload ?? "");
      setCreditFee(s.payment.creditFeePercent ? String(s.payment.creditFeePercent) : "");
    } catch {
      toast.error("Não foi possível carregar as configurações de pagamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    const key = pixKey.trim();
    if (!key) {
      toast.error("Informe a chave PIX.");
      return;
    }
    const feeNum = creditFee.trim() === "" ? 0 : Number(creditFee.replace(",", "."));
    if (!Number.isFinite(feeNum)) {
      toast.error("Informe um número válido para a % do crédito (ex.: 3,5 ou -2).");
      return;
    }
    setSaving(true);
    try {
      const payment = {
        pixKey: key,
        pixName: pixName.trim(),
        pixQrPayload: pixQrPayload.trim(),
        creditFeePercent: feeNum,
      };
      await updateSiteSettings({ payment });
      /* mantém o store em sincronia para o checkout usar os dados novos na hora */
      useSiteSettingsStore.setState({ payment });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Configurações de pagamento salvas!");
    } catch {
      toast.error("Erro ao salvar as configurações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const copyKey = async () => {
    if (!pixKey.trim()) return;
    await navigator.clipboard.writeText(pixKey.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <AdminPageHeader
          title="Pagamentos"
          subtitle="Configure a chave PIX usada quando o cliente escolhe pagar online no checkout."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Chave PIX
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {loading ? (
                <div className="space-y-4">
                  <div className="h-12 rounded-lg bg-[var(--color-bg-overlay)] animate-pulse" />
                  <div className="h-12 rounded-lg bg-[var(--color-bg-overlay)] animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Input
                      label="Chave PIX *"
                      placeholder="e-mail, telefone, CPF/CNPJ ou chave aleatória"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      icon={<KeyRound className="w-4 h-4" />}
                    />
                    {pixKey.trim() && (
                      <button
                        type="button"
                        onClick={copyKey}
                        title="Copiar chave"
                        className="absolute right-2 top-[2.1rem] p-1.5 rounded-lg bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)] hover:text-[var(--color-bg-base)] transition-all"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <Input
                    label="Titular da chave"
                    placeholder="Nome exibido ao cliente (ex: Shark Smokehouse)"
                    value={pixName}
                    onChange={(e) => setPixName(e.target.value)}
                    icon={<User className="w-4 h-4" />}
                  />

                  {/* PIX Copia e Cola (BR Code) + preview do QR */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                      PIX Copia e Cola (BR Code) — opcional
                    </label>
                    <textarea
                      rows={4}
                      value={pixQrPayload}
                      onChange={(e) => setPixQrPayload(e.target.value)}
                      placeholder="Cole aqui o código PIX copia e cola gerado no seu banco. O QR Code é montado a partir dele."
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] placeholder:font-sans focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none break-all"
                    />
                    {pixQrPayload.trim() && (
                      <div className="mt-2 flex items-center gap-4 p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
                        <div className="p-2 rounded-lg bg-white shrink-0">
                          <QRCodeSVG value={pixQrPayload.trim()} size={96} marginSize={0} />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Pré-visualização do QR Code que o cliente verá no checkout. Confira
                          escaneando com o app do seu banco.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--color-neon-blue-glow)]/30 border border-[var(--color-neon-blue)]/20 text-xs text-[var(--color-text-muted)]">
                    A chave e o QR Code são exibidos na tela de confirmação do pedido quando o
                    cliente escolhe <span className="font-medium text-[var(--color-neon-blue)]">PIX</span> no checkout.
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Cartão de crédito — preço diferenciado (Lei nº 13.455/2017) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Cartão de Crédito
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {loading ? (
                <div className="h-12 rounded-lg bg-[var(--color-bg-overlay)] animate-pulse" />
              ) : (
                <>
                  <div className="relative max-w-xs">
                    <Input
                      label="Diferença de preço no crédito (%)"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex.: 3,5 (deixe vazio se não cobra)"
                      value={creditFee}
                      onChange={(e) => setCreditFee(e.target.value)}
                      icon={<Percent className="w-4 h-4" />}
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-neon-blue-glow)]/30 border border-[var(--color-neon-blue)]/20 text-xs text-[var(--color-text-muted)] space-y-1">
                    <p>
                      Aplicada ao total quando o cliente escolhe <span className="font-medium text-[var(--color-neon-blue)]">Cartão de Crédito</span> no checkout.
                      Use número <strong>positivo</strong> para acréscimo e <strong>negativo</strong> para desconto. Vazio = sem diferença.
                    </p>
                    <p>
                      O valor é informado ao cliente no checkout, conforme a <strong>Lei nº 13.455/2017</strong>
                      {" "}(que permite preço diferente por forma de pagamento, desde que informado).
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex items-center justify-between"
        >
          <Button variant="ghost" size="sm" onClick={load} disabled={loading || saving}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="min-w-32">
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Save className="w-4 h-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar alterações
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
