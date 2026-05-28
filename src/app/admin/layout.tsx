"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

const ADMIN_EMAIL = "admin@shark.com";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const isAdmin = user.role === "admin" && user.email === ADMIN_EMAIL;
    const isSeller = user.role === "seller";
    if (!isAdmin && !isSeller) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === "admin" && user.email === ADMIN_EMAIL;
  const isSeller = user.role === "seller";
  if (!isAdmin && !isSeller) return null;

  return <>{children}</>;
}
