"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { QrCode, Save, RefreshCw, KeyRound, User, Copy, Check } from "lucide-react";
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
    setSaving(true);
    try {
      const payment = { pixKey: key, pixName: pixName.trim() };
      await updateSiteSettings({ payment });
      /* mantém o store em sincronia para o checkout usar a chave nova na hora */
      useSiteSettingsStore.setState({ payment });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Chave PIX salva com sucesso!");
    } catch {
      toast.error("Erro ao salvar a chave PIX. Tente novamente.");
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

                  <div className="p-3 rounded-xl bg-[var(--color-neon-blue-glow)]/30 border border-[var(--color-neon-blue)]/20 text-xs text-[var(--color-text-muted)]">
                    Essa chave é exibida na tela de confirmação do pedido quando o cliente
                    seleciona <span className="font-medium text-[var(--color-neon-blue)]">Pagar Online (PIX)</span> no checkout.
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
