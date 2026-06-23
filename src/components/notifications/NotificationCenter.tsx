"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Package, Megaphone, CheckCheck, Inbox } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  subscribeNotifications, markNotificationRead, markNotificationsRead,
} from "@/lib/firebase/notifications";
import { getActiveAnnouncements } from "@/lib/firebase/announcements";
import { formatDateTime } from "@/lib/utils";
import type { AppNotification, Announcement, NotificationCategory } from "@/types";

type Tab = "all" | "order" | "promo";

interface Item {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
  source: "notif" | "announcement";
}

const TABS: { value: Tab; label: string }[] = [
  { value: "all",   label: "Todas" },
  { value: "order", label: "Pedidos" },
  { value: "promo", label: "Promoções" },
];

function seenKey(uid: string) {
  return `notif:seenPromos:${uid}`;
}
function readSeen(uid: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Centro de notificações in-app: sininho no header com painel em abas que
 * separa atualizações de pedido (Pedidos) das promoções (Promoções), sem
 * interromper o fluxo com pop-ups. Notificações de pedido vêm em tempo real
 * (Firestore por usuário); promoções são avisos globais com leitura marcada
 * localmente por usuário.
 */
export function NotificationCenter() {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid ?? "";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // Leitura das promoções é local por usuário (lazy init lê o localStorage uma vez).
  const [seenPromos, setSeenPromos] = useState<Set<string>>(() => readSeen(uid));

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeNotifications(uid, setNotifs, () => {});
    getActiveAnnouncements().then(setAnnouncements).catch(() => {});
    return () => unsub();
  }, [uid]);

  const items = useMemo<Item[]>(() => {
    const orderItems: Item[] = notifs.map((n) => ({
      id: n.id, category: "order", title: n.title, body: n.body,
      link: n.link, read: n.read, createdAt: n.createdAt, source: "notif",
    }));
    const promoItems: Item[] = announcements.map((a) => ({
      id: a.id, category: "promo", title: a.title, body: a.body,
      link: a.link, read: seenPromos.has(a.id), createdAt: a.createdAt, source: "announcement",
    }));
    return [...orderItems, ...promoItems].sort((x, y) =>
      x.createdAt < y.createdAt ? 1 : x.createdAt > y.createdAt ? -1 : 0,
    );
  }, [notifs, announcements, seenPromos]);

  const unreadTotal = items.filter((i) => !i.read).length;
  const unreadOrder = items.filter((i) => i.category === "order" && !i.read).length;
  const unreadPromo = items.filter((i) => i.category === "promo" && !i.read).length;
  const tabUnread: Record<Tab, number> = { all: unreadTotal, order: unreadOrder, promo: unreadPromo };

  const visible = tab === "all" ? items : items.filter((i) => i.category === tab);

  function persistSeen(next: Set<string>) {
    setSeenPromos(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(seenKey(uid), JSON.stringify([...next]));
    }
  }

  function markRead(item: Item) {
    if (item.read) return;
    if (item.source === "notif") {
      markNotificationRead(item.id).catch(() => {});
    } else {
      persistSeen(new Set(seenPromos).add(item.id));
    }
  }

  function handleClick(item: Item) {
    markRead(item);
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  function markAllRead() {
    const unreadNotifIds = notifs.filter((n) => !n.read).map((n) => n.id);
    if (unreadNotifIds.length) markNotificationsRead(unreadNotifIds).catch(() => {});
    persistSeen(new Set(announcements.map((a) => a.id)));
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className="relative flex items-center justify-center w-10 h-10 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadTotal > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] text-[10px] font-bold flex items-center justify-center shadow-[var(--shadow-neon-sm)]">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 z-[56] w-[calc(100vw-1rem)] sm:w-96 max-w-sm glass-strong rounded-xl border border-[var(--color-border)] shadow-[var(--shadow-elevated)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Notificações</h3>
                {unreadTotal > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-2 pt-2">
                {TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      tab === t.value
                        ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {t.label}
                    {tabUnread[t.value] > 0 && (
                      <span className="min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] text-[10px] font-bold flex items-center justify-center">
                        {tabUnread[t.value] > 9 ? "9+" : tabUnread[t.value]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto py-2">
                {visible.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-6">
                    <Inbox className="w-8 h-8 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {tab === "order"
                        ? "Nenhuma atualização de pedido ainda."
                        : tab === "promo"
                        ? "Nenhuma promoção no momento."
                        : "Você está em dia! Nenhuma notificação."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5 px-1.5">
                    {visible.map((item) => {
                      const Icon = item.category === "order" ? Package : Megaphone;
                      return (
                        <button
                          key={`${item.source}-${item.id}`}
                          onClick={() => handleClick(item)}
                          className={`w-full text-left flex gap-3 p-2.5 rounded-lg transition-colors hover:bg-[var(--color-bg-hover)] ${
                            item.read ? "" : "bg-[var(--color-neon-blue-glow)]/40"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              item.category === "order"
                                ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.title}</p>
                              {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-blue)] shrink-0" />}
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] leading-snug mt-0.5 line-clamp-2">{item.body}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{formatDateTime(item.createdAt)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
