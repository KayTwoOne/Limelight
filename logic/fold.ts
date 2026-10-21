/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// One tile per person: when someone streams, their stream tile takes the slot
// of their avatar tile, and the avatar tile is dropped. Pure: imports nothing.

export const ParticipantType = { STREAM: 0, HIDDEN_STREAM: 1, USER: 2, ACTIVITY: 3 } as const;

export interface ParticipantLike {
    type: number;
    id: string;
    user?: { id: string; } | null;
}

function ownerOf(p: ParticipantLike): string | null {
    return p.user?.id ?? null;
}

// Owners with a visible stream tile. A hidden stream (the viewer's own, hidden
// by them) keeps the owner's avatar tile, so it does not count as live here.
export function streamOwners(list: readonly ParticipantLike[]): Set<string> {
    const owners = new Set<string>();
    for (const p of list) {
        const owner = p.type === ParticipantType.STREAM ? ownerOf(p) : null;
        if (owner) owners.add(owner);
    }
    return owners;
}

export function foldParticipants<T extends ParticipantLike>(list: readonly T[]): T[] {
    const userIndex = new Map<string, number>();
    list.forEach((p, i) => {
        const owner = p.type === ParticipantType.USER ? ownerOf(p) : null;
        if (owner && !userIndex.has(owner)) userIndex.set(owner, i);
    });
    const placed = new Map<number, T>();
    const dropped = new Set<number>();
    list.forEach((p, i) => {
        const owner = ownerOf(p);
        const at = owner ? userIndex.get(owner) : undefined;
        if (at === undefined) return;
        if (p.type === ParticipantType.STREAM && !placed.has(at)) {
            placed.set(at, p);
            dropped.add(i);
        } else if (p.type === ParticipantType.HIDDEN_STREAM) {
            dropped.add(i);
        }
    });
    const out: T[] = [];
    list.forEach((p, i) => {
        if (!dropped.has(i)) out.push(placed.get(i) ?? p);
    });
    return out;
}
