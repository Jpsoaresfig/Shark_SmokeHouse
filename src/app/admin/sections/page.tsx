"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Eye, EyeOff, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase/settings";
import { toast } from "@/stores/toastStore";
import type { SiteSettings } from "@/types";

const SECTION_META: {
  key: keyof SiteSettings["sections"];
  label: string;
  description: string;
}[] = [
  {
    key: "hero",
    label: "Banner Principal",
    description: "Seção de destaque no topo da página com chamada para ação.",
  },
  {
    key: "featuredProducts",
    label: "Produtos em Destaque",
    description: "Grelha de produtos selecionados exibidos na página inicial.",
  },
  {
    key: "lounge",
    label: "Lounge / Agendamento",
    description: "Seção de reserva de espaço no lounge premium.",
  },
  {
    key: "events",
    label: "Próximos Eventos",
    description: "Exibe os próximos eventos cadastrados na página inicial.",
  },
  {
    key: "loyalty",
    label: "Programa de Fidelidade",
    description: "Apresentação dos níveis do programa de pontos (Smoke, Ember, Inferno).",
  },
];

export default function AdminSections() {
  const [sections, setSections] = useState<SiteSettings["sections"]>({
    hero: true,
    featuredProducts: true,
    lounge: true,
    events: true,
    loyalty: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSiteSettings();
      setSections(s.sections);
    } catch {
      toast.error("Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSiteSettings({ sections });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Configurações de seções salvas!");
    } catch {
      toast.error("Erro ao salvar configurações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof SiteSettings["sections"]) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const activeCount = Object.values(sections).filter(Boolean).length;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-[var(--color-neon-blue)]" />
              </div>
              <h1 className="text-3xl font-black text-[var(--color-text-primary)]">
                Seções da Página
              </h1>
            </div>
            <p className="text-[var(--color-text-muted)] text-sm ml-[52px]">
              Ative ou desative as seções exibidas na página principal.
            </p>
          </div>
          <Badge variant="default" className="mt-1">
            {activeCount}/{SECTION_META.length} ativas
          </Badge>
        </motion.div>

        {/* Sections list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Visibilidade das Seções</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-0 divide-y divide-[var(--color-border)]">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-5 animate-pulse">
                      <div className="space-y-2">
                        <div className="h-4 w-40 rounded bg-[var(--color-bg-overlay)]" />
                        <div className="h-3 w-64 rounded bg-[var(--color-bg-overlay)]" />
                      </div>
                      <div className="h-6 w-11 rounded-full bg-[var(--color-bg-overlay)]" />
                    </div>
                  ))
                : SECTION_META.map((meta, i) => {
                    const active = sections[meta.key];
                    return (
                      <motion.div
                        key={meta.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between py-5 gap-4"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              active
                                ? "bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20"
                                : "bg-[var(--color-bg-overlay)] border border-[var(--color-border)]"
                            }`}
                          >
                            {active ? (
                              <Eye className="w-4 h-4 text-[var(--color-neon-blue)]" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-[var(--color-text-muted)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold transition-colors ${
                                active
                                  ? "text-[var(--color-text-primary)]"
                                  : "text-[var(--color-text-muted)]"
                              }`}
                            >
                              {meta.label}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                              {meta.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs font-medium transition-colors ${
                              active
                                ? "text-[var(--color-neon-blue)]"
                                : "text-[var(--color-text-muted)]"
                            }`}
                          >
                            {active ? "Ativa" : "Oculta"}
                          </span>
                          <Switch
                            checked={active}
                            onCheckedChange={() => toggle(meta.key)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Save button */}
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
