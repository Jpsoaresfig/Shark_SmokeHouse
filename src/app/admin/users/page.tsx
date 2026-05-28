"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, X, Eye, EyeOff, Mail, Lock,
  User, Phone, Shield, Bike, ShoppingBag, Crown,
  Pencil, Trash2, AlertCircle, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import {
  getAllUsers, createUserWithRole, updateUserRole, deleteUserProfile,
} from "@/lib/firebase/users";
import { formatDate } from "@/lib/utils";
import type { UserProfile, UserRole } from "@/types";

/* ── role config ─────────────────────────────────────────── */
const roleConfig: Record<UserRole, { label: string; badge: "default" | "orange" | "purple" | "premium"; icon: React.ElementType }> = {
  admin:    { label: "Admin Master", badge: "premium",  icon: Crown },
  seller:   { label: "Vendedor",     badge: "orange",   icon: ShoppingBag },
  motoboy:  { label: "Motoboy",      badge: "purple",   icon: Bike },
  customer: { label: "Cliente",      badge: "default",  icon: User },
};

const creatableRoles: { value: UserRole; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "customer", label: "Cliente",  desc: "E-commerce e lounge",       icon: User },
  { value: "seller",   label: "Vendedor", desc: "PDV e comissões",            icon: ShoppingBag },
  { value: "motoboy",  label: "Motoboy",  desc: "Painel de entregas",         icon: Bike },
];

/* ── Create modal ────────────────────────────────────────── */
function CreateUserModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (user: UserProfile) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [role, setRole] = useState<UserRole>("customer");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile = await createUserWithRole(form.email, form.password, form.name, form.phone, role);
      toast.success("Usuário criado com sucesso!");
      onCreated(profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 220 }}
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Criar Usuário</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Apenas Admin Master pode criar usuários</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">Perfil de acesso</label>
            <div className="grid grid-cols-3 gap-2">
              {creatableRoles.map((r) => {
                const Icon = r.icon;
                const active = role === r.value;
                return (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                      active
                        ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/50 hover:text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{r.label}</span>
                    <span className="text-[10px] leading-tight opacity-70">{r.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <Input label="Nome completo" placeholder="João Silva"
            icon={<User className="w-4 h-4" />}
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

          <div className="grid grid-cols-2 gap-3">
            <Input type="email" label="E-mail" placeholder="joao@email.com"
              icon={<Mail className="w-4 h-4" />}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input type="tel" label="WhatsApp" placeholder="(11) 99999-9999"
              icon={<Phone className="w-4 h-4" />}
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Senha inicial</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type={showPw ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6} required
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 pl-10 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] focus:shadow-[0_0_0_3px_var(--color-neon-blue-glow)] transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="premium" className="flex-1" disabled={loading}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Plus className="w-4 h-4" /> Criar Usuário</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ── Edit role modal ─────────────────────────────────────── */
function EditRoleModal({ user, onClose, onUpdated }: {
  user: UserProfile;
  onClose: () => void;
  onUpdated: (uid: string, role: UserRole) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (role === user.role) { onClose(); return; }
    setLoading(true);
    try {
      await updateUserRole(user.uid, role);
      toast.success("Perfil do usuário atualizado!");
      onUpdated(user.uid, role);
    } catch {
      toast.error("Erro ao atualizar perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Alterar Perfil</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] mb-5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] flex items-center justify-center text-sm font-bold text-white shrink-0">
            {user.displayName?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{user.displayName}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {creatableRoles.map((r) => {
            const Icon = r.icon;
            const active = role === r.value;
            return (
              <button key={r.value} type="button" onClick={() => setRole(r.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  active
                    ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] hover:border-[var(--color-neon-blue)]/40"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${active ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-primary)]"}`}>{r.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{r.desc}</p>
                </div>
                {active && <CheckCircle className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="premium" className="flex-1" onClick={handleSave} disabled={loading}>
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function AdminUsersPage() {
  const { user: adminUser } = useAuthStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getAllUsers());
    } catch {
      toast.error("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (adminUser?.role !== "admin") {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[var(--color-error)] mx-auto mb-3" />
          <p className="text-[var(--color-text-primary)] font-semibold">Acesso restrito</p>
          <p className="text-sm text-[var(--color-text-muted)]">Apenas Admin Master pode acessar esta área.</p>
        </div>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    all: users.length,
    customer: users.filter(u => u.role === "customer").length,
    seller: users.filter(u => u.role === "seller").length,
    motoboy: users.filter(u => u.role === "motoboy").length,
    admin: users.filter(u => u.role === "admin").length,
  };

  const handleCreated = (profile: UserProfile) => {
    setUsers((prev) => [profile, ...prev]);
    setShowCreate(false);
  };

  const handleRoleUpdated = (uid: string, newRole: UserRole) => {
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role: newRole } : u));
    setEditingUser(null);
  };

  const handleDelete = async (uid: string) => {
    setDeletingUid(uid);
    try {
      await deleteUserProfile(uid);
      toast.success("Usuário removido.");
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch {
      toast.error("Erro ao remover usuário. Tente novamente.");
    } finally {
      setDeletingUid(null);
    }
  };

  const filters: { value: UserRole | "all"; label: string; count: number }[] = [
    { value: "all",      label: "Todos",      count: counts.all },
    { value: "customer", label: "Clientes",   count: counts.customer },
    { value: "seller",   label: "Vendedores", count: counts.seller },
    { value: "motoboy",  label: "Motoboys",   count: counts.motoboy },
    { value: "admin",    label: "Admins",     count: counts.admin },
  ];

  return (
    <>
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-[var(--color-text-primary)]">Usuários</h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}</p>
            </div>
            <Button variant="premium" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Criar Usuário
            </Button>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.map((f) => (
              <button key={f.value} onClick={() => setRoleFilter(f.value)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  roleFilter === f.value
                    ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border-[var(--color-neon-blue)]/40 shadow-[var(--shadow-neon-sm)]"
                    : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-neon-blue)]/40"
                }`}
              >
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  roleFilter === f.value
                    ? "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)]"
                    : "bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                }`}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, e-mail ou telefone..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] pl-10 pr-9 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)] last:border-0">
                      <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-36 rounded" />
                        <div className="skeleton h-3 w-52 rounded" />
                      </div>
                      <div className="skeleton h-6 w-20 rounded-full" />
                      <div className="skeleton h-3 w-20 rounded hidden md:block" />
                      <div className="skeleton h-7 w-16 rounded" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Users className="w-10 h-10 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-secondary)]">Nenhum usuário encontrado</p>
                  {search && <p className="text-xs text-[var(--color-text-muted)]">Tente ajustar o filtro de busca</p>}
                </div>
              ) : (
                <div>
                  {/* Table head */}
                  <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_88px] gap-4 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-overlay)] rounded-t-xl">
                    {["Usuário", "Contato", "Perfil", "Cadastro", "Ações"].map((h) => (
                      <span key={h} className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{h}</span>
                    ))}
                  </div>

                  {filtered.map((u, i) => {
                    const cfg = roleConfig[u.role];
                    const RoleIcon = cfg.icon;
                    return (
                      <motion.div
                        key={u.uid}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_88px] gap-4 items-center px-6 py-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-overlay)] transition-colors"
                      >
                        {/* User */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {u.displayName?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{u.displayName}</p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate md:hidden">{u.email}</p>
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="hidden md:block min-w-0">
                          <p className="text-sm text-[var(--color-text-secondary)] truncate">{u.email}</p>
                          {u.phone && <p className="text-xs text-[var(--color-text-muted)]">{u.phone}</p>}
                        </div>

                        {/* Role badge */}
                        <div>
                          <Badge variant={cfg.badge} className="text-xs">
                            <RoleIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </div>

                        {/* Date */}
                        <p className="hidden md:block text-xs text-[var(--color-text-muted)]">
                          {formatDate(u.createdAt)}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {u.role !== "admin" && (
                            <button onClick={() => setEditingUser(u)}
                              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all"
                              title="Alterar perfil">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {u.uid !== adminUser?.uid && (
                            <button onClick={() => handleDelete(u.uid)} disabled={deletingUid === u.uid}
                              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all disabled:opacity-40"
                              title="Remover usuário">
                              {deletingUid === u.uid
                                ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-error)]/30 border-t-[var(--color-error)] rounded-full animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
        {editingUser && <EditRoleModal user={editingUser} onClose={() => setEditingUser(null)} onUpdated={handleRoleUpdated} />}
      </AnimatePresence>
    </>
  );
}
