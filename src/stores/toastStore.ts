import { create } from "zustand";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast(t: Omit<ToastItem, "id">): void;
  removeToast(id: string): void;
}

export const useToastStore = create<ToastStore>(set => ({
  toasts: [],
  addToast: t =>
    set(s => ({
      toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }],
    })),
  removeToast: id =>
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().addToast({ variant: "success", message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().addToast({ variant: "error", message, title }),
  warning: (message: string, title?: string) =>
    useToastStore.getState().addToast({ variant: "warning", message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().addToast({ variant: "info", message, title }),
};
