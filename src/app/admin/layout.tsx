"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

const ADMIN_EMAIL = "admin@shark.com";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = user?.role === "admin" && user?.email === ADMIN_EMAIL;
  const isSeller = user?.role === "seller";
  const isAllowed = isAdmin || isSeller;

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isAllowed) { router.replace("/"); return; }
    // Vendedor não acessa o dashboard do admin — leva ao próprio painel.
    if (isSeller && pathname === "/admin") { router.replace("/admin/seller"); }
    // Área "Produtos Ocultos" é exclusiva do admin — vendedor não entra nem por URL.
    if (isSeller && pathname.startsWith("/admin/internal")) { router.replace("/admin/seller"); }
  }, [user, loading, isAllowed, isSeller, pathname, router]);

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || !isAllowed) return null;

  return (
    <>
      {/* Extra bottom padding on mobile so content doesn't hide behind the tab bar */}
      <div className="md:pb-0 pb-16" style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}>
        {children}
      </div>
      <AdminMobileNav />
    </>
  );
}
