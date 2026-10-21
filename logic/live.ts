/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Remembers when each person went live or stopped, so a tile plays the morph
// once, at the moment it happens, and not on every re-render. Pure.

export const MORPH_WINDOW_MS = 900;

export interface LiveTracker {
    initialised: boolean;
    live: Set<string>;
    started: Map<string, number>;
    ended: Map<string, number>;
}

export function createLiveTracker(): LiveTracker {
    return { initialised: false, live: new Set(), started: new Map(), ended: new Map() };
}

function prune(marks: Map<string, number>, now: number) {
    for (const [id, at] of marks) if (now - at > MORPH_WINDOW_MS * 10) marks.delete(id);
}

export function updateLive(t: LiveTracker, liveNow: Iterable<string>, now: number): void {
    const next = new Set(liveNow);
    if (t.initialised) {
        for (const id of next) {
            if (!t.live.has(id)) { t.started.set(id, now); t.ended.delete(id); }
        }
        for (const id of t.live) {
            if (!next.has(id)) { t.ended.set(id, now); t.started.delete(id); }
        }
        prune(t.started, now);
        prune(t.ended, now);
    }
    t.live = next;
    t.initialised = true;
}

function within(marks: Map<string, number>, id: string, now: number, windowMs: number): boolean {
    const at = marks.get(id);
    return at !== undefined && now - at >= 0 && now - at < windowMs;
}

export function recentlyStarted(t: LiveTracker, id: string, now: number, windowMs = MORPH_WINDOW_MS): boolean {
    return within(t.started, id, now, windowMs);
}

export function recentlyEnded(t: LiveTracker, id: string, now: number, windowMs = MORPH_WINDOW_MS): boolean {
    return within(t.ended, id, now, windowMs);
}

export function resetLive(t: LiveTracker): void {
    t.initialised = false;
    t.live.clear();
    t.started.clear();
    t.ended.clear();
}
