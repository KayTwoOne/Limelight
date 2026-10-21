/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Notices a Limelight hook that never ran while the call view was showing, so
// the failure can be logged once. Pure: the caller supplies the clock.

export const HOOK_GRACE_MS = 8000;

export interface HookMonitor {
    seen: Set<string>;
    reported: Set<string>;
    surfaceSince: number | null;
}

export function createHookMonitor(): HookMonitor {
    return { seen: new Set(), reported: new Set(), surfaceSince: null };
}

export function markSeen(m: HookMonitor, name: string): void {
    m.seen.add(name);
}

export function checkHooks(m: HookMonitor, surfaceLive: boolean, now: number, expected: readonly string[], graceMs = HOOK_GRACE_MS): string[] {
    if (!surfaceLive) { m.surfaceSince = null; return []; }
    if (m.surfaceSince === null) { m.surfaceSince = now; return []; }
    if (now - m.surfaceSince < graceMs) return [];
    const failed = expected.filter(name => !m.seen.has(name) && !m.reported.has(name));
    for (const name of failed) m.reported.add(name);
    return failed;
}
