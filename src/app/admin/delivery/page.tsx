"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Bike, Plus, Trash2, Search, Check, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { formatCurrency } from "@/lib/utils";
import {
  ensureDeliveryAreasSeeded, getDeliveryAreas,
  createDeliveryArea, updateDeliveryArea, deleteDeliveryArea, normalizeArea,
} from "@/lib/firebase/delivery";
import { toast } from "@/stores/toastStore";
import type { DeliveryArea } from "@/types";

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

export default function AdminDelivery() {
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Novo bairro
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [region, setRegion] = useState("João Pessoa");

  // Edição inline da taxa
  const [editId, setEditId] = useState<string | null>(null);
  const [editFee, setEditFee] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Garante que a tabela padrão exista como documentos editáveis.
      setAreas(await ensureDeliveryAreasSeeded());
    } catch {
      // Sem permissão/erro: mostra ao menos a tabela padrão (somente leitura).
      try { setAreas(await getDeliveryAreas()); } catch { /* ignore */ }
      toast.error("Não foi possível carregar/salvar os bairros. Verifique as permissões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeArea(search);
    return areas.filter(a => !q || normalizeArea(a.name).includes(q) || normalizeArea(a.region ?? "").includes(q));
  }, [areas, search]);

  // Agrupa por região mantendo a ordem de inserção das regiões.
  const grouped = useMemo(() => {
    const map = new Map<string, DeliveryArea[]>();
    for (const a of filtered) {
      const key = a.region ?? "Outros";
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  async function handleAdd() {
    const n = name.trim();
    if (!n || fee === "") {
      toast.error("Informe o bairro e o valor do frete.");
      return;
    }
    if (areas.some(a => normalizeArea(a.name) === normalizeArea(n))) {
      toast.error("Esse bairro já está na lista.");
      return;
    }
    setSaving(true);
    try {
      await createDeliveryArea(n, Number(fee), region.trim() || undefined);
      setName(""); setFee("");
      setAreas(await getDeliveryAreas(true));
      toast.success("Bairro adicionado!");
    } catch {
      toast.error("Erro ao adicionar o bairro.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFee(area: DeliveryArea) {
    try {
      await updateDeliveryArea(area.id, { fee: Number(editFee) || 0 });
      setEditId(null);
      setAreas(await getDeliveryAreas(true));
    } catch {
      toast.error("Erro ao atualizar a taxa.");
    }
  }

  async function handleDelete(area: DeliveryArea) {
    try {
      await deleteDeliveryArea(area.id);
      setAreas(await getDeliveryAreas(true));
      toast.success("Bairro removido.");
    } catch {
      toast.error("Erro ao remover o bairro.");
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <AdminPageHeader
          title="Frete por bairro"
          subtitle={`${areas.length} bairro${areas.length !== 1 ? "s" : ""} cadastrado${areas.length !== 1 ? "s" : ""}`}
        />

        {/* Adicionar bairro */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_10rem_auto] gap-2 items-end">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Bairro</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                  placeholder="Ex: Manaíra" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Frete (R$)</label>
                <input value={fee} onChange={e => setFee(e.target.value)} type="number" min="0" step="0.01"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                  placeholder="15" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Região</label>
                <select value={region} onChange={e => setRegion(e.target.value)} className={inputCls}>
                  <option>João Pessoa</option>
                  <option>Região Metropolitana</option>
                  <option>Outros</option>
                </select>
              </div>
              <Button variant="premium" onClick={handleAdd} disabled={saving || !name.trim() || fee === ""}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <div className="mb-4">
          <Input placeholder="Buscar bairro…" icon={<Search className="w-4 h-4" />}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Bike className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-muted)]">Nenhum bairro encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([reg, list]) => (
              <div key={reg}>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{reg}</p>
                <Card>
                  <CardContent className="p-2">
                    {list.map((area, i) => (
                      <div key={area.id}>
                        <div className="flex items-center gap-3 py-2.5 px-2">
                          <span className="flex-1 text-sm text-[var(--color-text-primary)]">{area.name}</span>
                          {editId === area.id ? (
                            <div className="flex items-center gap-1.5">
                              <input type="number" min="0" step="0.01" value={editFee}
                                onChange={e => setEditFee(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveFee(area); }}
                                autoFocus
                                className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-2 py-1.5 text-sm text-center text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)]" />
                              <button onClick={() => saveFee(area)} className="p-1.5 rounded-lg text-[var(--color-success)] hover:bg-emerald-500/10" aria-label="Salvar">
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditId(area.id); setEditFee(String(area.fee)); }}
                              className="flex items-center gap-1.5 group">
                              <Badge variant="secondary" className="font-bold">{formatCurrency(area.fee)}</Badge>
                              <Pencil className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(area)}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
                            aria-label={`Remover ${area.name}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {i < list.length - 1 && <div className="border-t border-[var(--color-border)]" />}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
