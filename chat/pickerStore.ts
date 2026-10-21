/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Which channel each voice channel's call chat is showing, for this session
// only. A voice channel with no entry shows its own chat. Joining a voice
// channel keeps only that channel's pick, so leaving the call starts the next
// one on its own chat. Also remembers which call chat is on screen, so a
// channel link clicked inside it knows where to open.

import { React } from "@webpack/common";

const targets = new Map<string, string>();
const listeners = new Set<() => void>();
let mounted: string | null = null;

function emit(): void {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** The text channel the call chat of `voiceId` shows, or null for its own chat */
export function getTarget(voiceId: string): string | null {
    return targets.get(voiceId) ?? null;
}

/** Shows `channelId` in the call chat of `voiceId`; null (or the voice channel itself) goes back to its own chat */
export function setTarget(voiceId: string, channelId: string | null): void {
    if (channelId == null || channelId === voiceId) {
        if (!targets.delete(voiceId)) return;
    } else {
        if (targets.get(voiceId) === channelId) return;
        targets.set(voiceId, channelId);
    }
    emit();
}

export function useTargetId(voiceId: string): string | null {
    return React.useSyncExternalStore(subscribe, () => getTarget(voiceId));
}

/** On joining or leaving voice: keep only the joined channel's pick */
export function keepOnly(voiceId: string | null): void {
    let changed = false;
    for (const key of [...targets.keys()]) {
        if (key !== voiceId) {
            targets.delete(key);
            changed = true;
        }
    }
    if (changed) emit();
}

export function resetTargets(): void {
    targets.clear();
    mounted = null;
    emit();
}

/** The voice channel whose call chat is on screen */
export function getMountedCallChat(): string | null {
    return mounted;
}

export function setMountedCallChat(voiceId: string): () => void {
    mounted = voiceId;
    return () => {
        if (mounted === voiceId) mounted = null;
    };
}
