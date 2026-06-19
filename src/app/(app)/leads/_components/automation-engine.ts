"use client";

import { getNewLeadIdsForAutomation } from "../actions";
import {
  getOutreachAutomationProfiles,
  sendOutreachEmail,
} from "../../settings/actions";

export type AutomationStats = {
  sent: number;
  failed: number;
  skipped: number;
  cycles: number;
};

export type AutomationSnapshot = {
  running: boolean;
  status: string;
  profilesCount: number;
  stats: AutomationStats;
};

export const DEFAULT_BATCH_MIN = 15;
export const DEFAULT_BATCH_MAX = 25;

const PROFILE_SWITCH_DELAY_MS = 3 * 60 * 1000;
const CYCLE_PAUSE_MS = 5 * 60 * 1000;
const SEND_JITTER_MIN_MS = 20 * 1000;
const SEND_JITTER_MAX_MS = 40 * 1000;

const listeners = new Set<(snapshot: AutomationSnapshot) => void>();

let state: AutomationSnapshot = {
  running: false,
  status: "Hazır. Başlatınca status=new ve e-postası olan lead'ler işlenir.",
  profilesCount: 0,
  stats: { sent: 0, failed: 0, skipped: 0, cycles: 0 },
};

let activeRunToken = 0;
let profileCursor = 0;

function notify() {
  for (const listener of listeners) listener(state);
}

function setState(patch: Partial<AutomationSnapshot>) {
  state = { ...state, ...patch };
  notify();
}

function setStats(update: (prev: AutomationStats) => AutomationStats) {
  state = { ...state, stats: update(state.stats) };
  notify();
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function waitWithStop(token: number, ms: number): Promise<boolean> {
  let remaining = ms;
  while (remaining > 0) {
    if (activeRunToken !== token || !state.running) return false;
    const step = Math.min(1000, remaining);
    await waitMs(step);
    remaining -= step;
  }
  return activeRunToken === token && state.running;
}

async function runLoop(token: number, min: number, max: number) {
  while (activeRunToken === token && state.running) {
    const loaded = await getOutreachAutomationProfiles();
    const profiles = loaded.profiles;
    setState({ profilesCount: profiles.length });

    if (!loaded.hasUsableSender) {
      stopAutomation("SMTP ayarı yok. Ayarlar ekranından profil/sender kaydet.");
      return;
    }

    const effectiveProfiles =
      profiles.length > 0
        ? profiles
        : [{ id: "__default__", name: "Varsayılan SMTP", fromEmail: "" }];

    const activeProfile =
      effectiveProfiles[profileCursor % effectiveProfiles.length];

    const queue = await getNewLeadIdsForAutomation(500);
    if (activeRunToken !== token || !state.running) return;

    if (queue.length === 0) {
      setState({
        status: "Gönderilecek yeni lead yok. 5 dk sonra tekrar kontrol edilecek...",
      });
      const keepGoing = await waitWithStop(token, CYCLE_PAUSE_MS);
      if (!keepGoing) return;
      continue;
    }

    const batchSize = Math.min(queue.length, randomInt(min, max));
    const batch = queue.slice(0, batchSize);

    setState({
      status: `${activeProfile.name} ile ${batch.length} lead gönderiliyor (new statüsündekiler).`,
    });

    for (let i = 0; i < batch.length; i++) {
      if (activeRunToken !== token || !state.running) return;
      const leadId = batch[i];
      const result = await sendOutreachEmail({
        leadId,
        smtpProfileId: activeProfile.id === "__default__" ? undefined : activeProfile.id,
      });

      if (result.ok) {
        setStats((prev) => ({ ...prev, sent: prev.sent + 1 }));
      } else if (result.error.includes("e-posta adresi yok")) {
        setStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
      } else {
        setStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }

      if (i < batch.length - 1) {
        const keepGoing = await waitWithStop(
          token,
          randomInt(SEND_JITTER_MIN_MS, SEND_JITTER_MAX_MS),
        );
        if (!keepGoing) return;
      }
    }

    profileCursor += 1;
    const wrapped = profileCursor % effectiveProfiles.length === 0;
    const pauseMs = wrapped ? CYCLE_PAUSE_MS : PROFILE_SWITCH_DELAY_MS;
    const pauseLabel = wrapped ? "5 dk" : "3 dk";

    setStats((prev) => ({ ...prev, cycles: prev.cycles + 1 }));
    setState({
      status: `${activeProfile.name} batch bitti. Sonraki SMTP için ${pauseLabel} bekleniyor...`,
    });

    const keepGoing = await waitWithStop(token, pauseMs);
    if (!keepGoing) return;
  }
}

export function getAutomationSnapshot(): AutomationSnapshot {
  return state;
}

export function subscribeAutomation(
  listener: (snapshot: AutomationSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function startAutomation(params: {
  minBatch: number;
  maxBatch: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (state.running) return { ok: true };

  const min = params.minBatch;
  const max = params.maxBatch;
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return { ok: false, error: "Min/Max değerleri sayı olmalı" };
  }
  if (min < 15 || max > 25 || min > max) {
    return { ok: false, error: "Batch aralığı 15-25 olmalı ve min <= max olmalı" };
  }

  activeRunToken += 1;
  const token = activeRunToken;
  profileCursor = 0;
  state = {
    running: true,
    profilesCount: state.profilesCount,
    status: "Otomasyon başlatıldı. SMTP profilleri yükleniyor...",
    stats: { sent: 0, failed: 0, skipped: 0, cycles: 0 },
  };
  notify();

  void runLoop(token, min, max).catch((error) => {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    stopAutomation(`Otomasyon hata nedeniyle durdu: ${message}`);
  });

  return { ok: true };
}

export function stopAutomation(message?: string) {
  activeRunToken += 1;
  setState({
    running: false,
    status: message ?? "Otomasyon durduruldu.",
  });
}
