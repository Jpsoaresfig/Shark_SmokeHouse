"use client";

import { useEffect } from "react";
import { getAnalytics } from "@/lib/firebase";

export function FirebaseAnalytics() {
  useEffect(() => {
    getAnalytics().catch(() => {});
  }, []);

  return null;
}
