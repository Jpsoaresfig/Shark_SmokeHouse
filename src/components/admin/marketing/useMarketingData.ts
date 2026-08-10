"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMarketingCampaigns, getMarketingSegments, getMarketingAutomations,
  getMarketingExecutions, getMarketingEvents, getMarketingTemplates,
  getMarketingSettings, getMarketingContacts, getMarketingCartSessions,
  getMarketingCoupons, getCouponRedemptions,
} from "@/lib/firebase/marketing";
import type {
  MarketingAutomation, MarketingCampaign, MarketingCartSession, MarketingContact,
  MarketingEvent, MarketingExecution, MarketingSegment, MarketingSettings,
  MarketingTemplate,
} from "@/types/marketing";
import type { Coupon, CouponRedemption } from "@/types";

export interface MarketingData {
  contacts: MarketingContact[];
  campaigns: MarketingCampaign[];
  segments: MarketingSegment[];
  automations: MarketingAutomation[];
  executions: MarketingExecution[];
  events: MarketingEvent[];
  templates: MarketingTemplate[];
  settings: MarketingSettings;
  coupons: Coupon[];
  redemptions: CouponRedemption[];
  sessions: MarketingCartSession[];
}

const EMPTY: MarketingData = {
  contacts: [],
  campaigns: [],
  segments: [],
  automations: [],
  executions: [],
  events: [],
  templates: [],
  settings: { active: true, maxPerDay: 2, windowHours: 24, minDaysBetweenAuto: 7, bigSpenderThreshold: 400, maxAudiencePerCampaign: 200, updatedAt: "" },
  coupons: [],
  redemptions: [],
  sessions: [],
};

/** Carrega todos os dados do módulo de marketing para as páginas do painel. */
export function useMarketingData() {
  const [data, setData] = useState<MarketingData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [
        contacts, campaigns, segments, automations, executions, events,
        templates, settings, coupons, redemptions, sessions,
      ] = await Promise.all([
        getMarketingContacts(force),
        getMarketingCampaigns(force),
        getMarketingSegments(force),
        getMarketingAutomations(force),
        getMarketingExecutions(force),
        getMarketingEvents(force),
        getMarketingTemplates(force),
        getMarketingSettings(force),
        getMarketingCoupons(force),
        getCouponRedemptions(force),
        getMarketingCartSessions(force),
      ]);
      setData({ contacts, campaigns, segments, automations, executions, events, templates, settings, coupons, redemptions, sessions });
    } catch (err) {
      console.error("[marketing] falha ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => { if (!cancelled) void load(); }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [load]);

  return { data, loading, reload: () => load(true) };
}
