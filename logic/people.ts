/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The People tab lists only who is in the call now. Discord's store hands out
// one mutable array, so the tab subscribes to a string key instead, which only
// changes when someone joins, leaves, is renamed, or starts or stops streaming.

export interface PersonLike {
    type: number;
    id: string;
    ringing?: boolean;
    userNick?: string | null;
    user?: { id: string; username?: string; } | null;
    voiceState?: { selfStream?: boolean; } | null;
}

export interface PersonEntry {
    id: string;
    name: string;
    live: boolean;
}

const FIELD = "\u0001";
const ROW = "\u0002";
const CONTROL = /[\u0000-\u001f]/g;

export function peopleKey(list: readonly PersonLike[]): string {
    return list
        .filter(p => p.type === 2 && !p.ringing && p.user?.id)
        .map(p => [p.user!.id, (p.userNick ?? p.user?.username ?? "").replace(CONTROL, ""), p.voiceState?.selfStream ? "1" : "0"].join(FIELD))
        .join(ROW);
}

export function decodePeople(key: string): PersonEntry[] {
    if (!key) return [];
    return key.split(ROW).map(row => {
        const [id, name, live] = row.split(FIELD);
        return { id, name, live: live === "1" };
    });
}
