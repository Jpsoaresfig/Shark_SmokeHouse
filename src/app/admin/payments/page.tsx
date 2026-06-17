"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { QrCode, Save, RefreshCw, KeyRound, User, Copy, Check, CreditCard, Percent, Layers, Plus, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase/settings";
import { useSiteSettingsStore } from "@/stores/siteSettingsStore";
import { normalizeInstallmentFees } from "@/lib/payments/installments";
import { toast } from "@/stores/toastStore";

export default function AdminPayments() {
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [pixQrPayload, setPixQrPayload] = useState("");
  const [creditFee, setCreditFee] = useState(""); // % no crédito (vazio = sem diferença)
  const [debitFee, setDebitFee] = useState("");   // % no débito (vazio = sem diferença)
  /* Taxas de parcelamento: índice 0 = 2x, índice 1 = 3x, … (string p/ edição livre). */
  const [installmentFees, setInstallmentFees] = useState<string[]>([]);
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
      setDebitFee(s.payment.debitFeePercent ? String(s.payment.debitFeePercent) : "");
      // Ordena por nº de parcelas e mapeia para 2x, 3x, … (a posição vira o nº de parcelas).
      setInstallmentFees(
        normalizeInstallmentFees(s.payment.creditInstallmentFees).map((f) =>
          String(f.feePercent).replace(".", ","),
        ),
      );
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
    const debitNum = debitFee.trim() === "" ? 0 : Number(debitFee.replace(",", "."));
    if (!Number.isFinite(debitNum)) {
      toast.error("Informe um número válido para a % do débito (ex.: 1,5 ou -2).");
      return;
    }
    // Parcelas: posição i → (i + 2)x. Campo vazio = 0% (sem taxa naquela parcela).
    const creditInstallmentFees = installmentFees.map((v, i) => ({
      installments: i + 2,
      feePercent: v.trim() === "" ? 0 : Number(v.replace(",", ".")),
    }));
    const badInstallment = creditInstallmentFees.find((f) => !Number.isFinite(f.feePercent));
    if (badInstallment) {
      toast.error(`Taxa de parcelamento inválida em ${badInstallment.installments}x. Use números (ex.: 6,91).`);
      return;
    }
    setSaving(true);
    try {
      const payment = {
        pixKey: key,
        pixName: pixName.trim(),
        pixQrPayload: pixQrPayload.trim(),
        creditFeePercent: feeNum,
        debitFeePercent: debitNum,
        creditInstallmentFees,
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
                Cartão (Crédito e Débito)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {loading ? (
                <div className="h-12 rounded-lg bg-[var(--color-bg-overlay)] animate-pulse" />
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-3 max-w-md">
                    <div className="relative">
                      <Input
                        label="Diferença no crédito (%)"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex.: 3,5 (vazio = não cobra)"
                        value={creditFee}
                        onChange={(e) => setCreditFee(e.target.value)}
                        icon={<Percent className="w-4 h-4" />}
                      />
                    </div>
                    <div className="relative">
                      <Input
                        label="Diferença no débito (%)"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex.: 1,5 (vazio = não cobra)"
                        value={debitFee}
                        onChange={(e) => setDebitFee(e.target.value)}
                        icon={<Percent className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-neon-blue-glow)]/30 border border-[var(--color-neon-blue)]/20 text-xs text-[var(--color-text-muted)] space-y-1">
                    <p>
                      Aplicada ao total quando o cliente escolhe <span className="font-medium text-[var(--color-neon-blue)]">Cartão de Crédito</span> ou <span className="font-medium text-[var(--color-neon-blue)]">Débito</span> no checkout.
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

        {/* Parcelamento no crédito — tabela de taxas por nº de parcelas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Parcelamento no crédito
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {loading ? (
                <div className="h-24 rounded-lg bg-[var(--color-bg-overlay)] animate-pulse" />
              ) : (
                <>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Quanto mais parcelas, maior a taxa da maquininha. Defina a taxa (%) de cada parcela —
                    ela é somada ao total e <strong>informada ao cliente</strong> no checkout e no pedido.
                    1x (à vista) não tem taxa de parcelamento.
                  </p>

                  {installmentFees.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] rounded-lg border border-dashed border-[var(--color-border)] px-3 py-4 text-center">
                      Nenhuma parcela cadastrada — só haverá pagamento à vista no crédito.
                    </p>
                  ) : (
                    <div className="space-y-2 max-w-md">
                      <div className="grid grid-cols-[80px_1fr_40px] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        <span>Parcelas</span>
                        <span>Taxa (%)</span>
                        <span />
                      </div>
                      {installmentFees.map((fee, i) => (
                        <div key={i} className="grid grid-cols-[80px_1fr_40px] gap-3 items-center">
                          <span className="text-sm font-semibold text-[var(--color-text-primary)] px-1">{i + 2}x</span>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Ex.: 6,91"
                              value={fee}
                              onChange={(e) => {
                                const next = [...installmentFees];
                                next[i] = e.target.value;
                                setInstallmentFees(next);
                              }}
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] pl-3 pr-9 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
                            />
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                          </div>
                          {/* Só a última parcela pode ser removida (mantém a sequência 2x, 3x, …) */}
                          {i === installmentFees.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => setInstallmentFees(installmentFees.slice(0, -1))}
                              title="Remover esta parcela"
                              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setInstallmentFees([...installmentFees, ""])}
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar {installmentFees.length + 2}x
                  </Button>
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
