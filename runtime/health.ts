/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Gathers the facts the health view judges (logic/health.ts): which replacements
// matched (the tracked patches registered in index.tsx), which patches Equicord
// still has waiting for Discord's code, which hooks ran, threw or were missed,
// and what the two probes saw on screen. The view reads one snapshot, replaced
// only when a state changes, so it re-renders only then.

import { gitHashShort } from "@shared/vencordUserAgent";
import { patches as pendingPatches } from "@webpack/patcher";

import { type Health, isClear, newProbe, patchHealth, probeHealth, type ProbeName, type ProbeState, type Row, ROWS, stepProbe, type Versions } from "../logic/health";
import { HOOK_GRACE_MS } from "../logic/hooks";
import { trackPatches } from "../logic/replacement";
import { stagePaint } from "../logic/stage";
import { CALL, CHAT_SIDE, LAYOUT_ROOT, TILE, TILE_BG } from "../logic/styleSheet";
import { patches, pluginName } from "../patches";
import { getConfig } from "../store/configStore";
import { imageAverage, imageLightest, imageUrl } from "../store/imageStore";
import { chipFailure, chipHealth, subscribeChips } from "../tiles/ChipStrip";
import { VERSION as LIMELIGHT_VERSION } from "../version";
import { foldFailure, foldHealth, subscribeFold } from "./channelFoldRuntime";
import { hookFacts, listenToHooks } from "./hookApi";

type PatchDef = (typeof patches)[number] & { hook: string; group?: boolean; };
const defs = patches as readonly PatchDef[];
const count = (p: PatchDef) => (Array.isArray(p.replacement) ? p.replacement.length : 1);
const isGrouped = (p: PatchDef) => Boolean(p.group) && count(p) > 1;

const matched = defs.map(() => new Set<number>());
const groupComplete = defs.map(() => false);

// The copies index.tsx registers. Each replacement reports its match here. Equicord
// patches Discord's modules as they are first required, which can be in the middle
// of a render, so the view is only told on a later turn.
export const trackedPatches = trackPatches(defs, `Vencord.Plugins.plugins[${JSON.stringify(pluginName)}]`, r => {
    if (!r.complete) return;
    if (isGrouped(defs[r.patch])) groupComplete[r.patch] = true;
    else matched[r.patch].add(r.replacement);
    refreshSoon();
});

// The floating user section and chips are judged by themselves, each checking what
// it draws (runtime/channelFoldRuntime.ts, tiles/ChipStrip.tsx); the others are
// probed here.
const probes: Record<Exclude<ProbeName, "foldPanel" | "chipTiles">, ProbeState> = { tileThemes: newProbe(), chatLooks: newProbe(), stagePaint: newProbe() };

// What a failed fold or chip found in Discord's layout, for Copy report
export function healthNotes(): readonly string[] {
    return [...foldFailure(), ...chipFailure()];
}

// Theme colours on the tiles: judged on tiles showing an avatar (not streaming,
// no camera), since only those draw the background every theme paints. Found
// when such a tile holds that background under Limelight's own tile class,
// exactly the pair the theme rules select.
function probeTiles(): { live: boolean; found: boolean; } {
    const tiles = [...document.querySelectorAll<HTMLElement>(`${TILE}:not(.limelight-live)`)].filter(t => t.querySelector("video") === null);
    return { live: tiles.length > 0, found: tiles.some(t => t.querySelector(TILE_BG) !== null) };
}

// Chat looks: judged while a chat shows inside the call chat's layer; found when
// the element every chat look styles is there.
function probeChat(): { live: boolean; found: boolean; } {
    const live = document.querySelector("[class*=\"chatLayerWrapper_\"] section[class*=\"chatContent_\"]") !== null;
    return { live, found: live && document.querySelector(CHAT_SIDE) !== null };
}

// The stage: judged while a stage background is picked and the call is in view;
// found when both of Discord's black layers, the call container and the call
// layout root inside it, are cleared, so the stage shows. (Kaylum, 8 and 9 Nov:
// first one layer, then the other, kept the call black.)
function probeStage(): { live: boolean; found: boolean; } {
    if (!stagePaint(getConfig(), { imageUrl, imageAverage, imageLightest })) return { live: false, found: false };
    const call = document.querySelector(`[class*="wrapper_"] > ${CALL}`);
    if (!call) return { live: false, found: false };
    const root = call.querySelector(LAYOUT_ROOT);
    const clear = (el: Element | null) => el === null || isClear(getComputedStyle(el).backgroundColor);
    return { live: true, found: clear(call) && clear(root) };
}

export type HealthRow = Row & {
    state: Health;
    /** Why it isn't working: Discord changed its code, or Limelight's code threw */
    cause?: "changed" | "error";
};

export interface HealthSnapshot {
    rows: HealthRow[];
    /** False when Limelight runs without its patches: turned on since Discord started */
    registered: boolean;
}

function pending(i: number): boolean {
    return pendingPatches.includes(trackedPatches[i] as never);
}

function compute(): HealthSnapshot {
    const rows = ROWS.map((row): HealthRow => {
        if ("probe" in row) {
            if (row.probe === "foldPanel" || row.probe === "chipTiles") {
                const state = row.probe === "foldPanel" ? foldHealth() : chipHealth();
                return state === "broken" ? { ...row, state, cause: "changed" } : { ...row, state };
            }
            return { ...row, state: probeHealth(probes[row.probe]) };
        }
        const i = defs.findIndex(p => p.hook === row.hook);
        const hook = hookFacts(row.hook);
        const state = patchHealth({
            replacements: count(defs[i]),
            grouped: isGrouped(defs[i]),
            matched: matched[i],
            groupComplete: groupComplete[i],
            pending: pending(i),
            hookSeen: hook.seen,
            hookFailed: hook.failed,
            hookMissing: hook.missing
        });
        return state === "broken" ? { ...row, state, cause: hook.failed ? "error" : "changed" } : { ...row, state };
    });
    const registered = defs.some((_, i) => pending(i) || matched[i].size > 0 || groupComplete[i]);
    return { rows, registered };
}

const key = (s: HealthSnapshot) => `${s.registered}|${s.rows.map(r => `${r.state}:${r.cause ?? ""}`).join(",")}`;

let snapshot: HealthSnapshot | null = null;
const listeners = new Set<() => void>();
let scheduled = false;

// Recomputes, and tells the view only when a state changed
function refresh(): void {
    const next = compute();
    if (snapshot !== null && key(next) === key(snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
}

function refreshSoon(): void {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
        scheduled = false;
        refresh();
    }, 0);
}

function tick(): void {
    const now = Date.now();
    const tiles = probeTiles();
    const chat = probeChat();
    const stage = probeStage();
    stepProbe(probes.tileThemes, tiles.live, tiles.found, now, HOOK_GRACE_MS);
    stepProbe(probes.chatLooks, chat.live, chat.found, now, HOOK_GRACE_MS);
    stepProbe(probes.stagePaint, stage.live, stage.found, now, HOOK_GRACE_MS);
    // Equicord's pending list changes as Discord loads code, with no event, so
    // every tick recomputes; refresh only tells the view when something changed.
    refresh();
}

export function subscribeHealth(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getHealth(): HealthSnapshot {
    snapshot ??= compute();
    return snapshot;
}

export function versions(): Versions {
    const env = (window as any).GLOBAL_ENV ?? {};
    const discord = [env.RELEASE_CHANNEL, env.BUILD_NUMBER].filter(Boolean).join(" ") || "unknown";
    // VERSION is Equicord's, put in by its build (a define, not a runtime global)
    return { limelight: LIMELIGHT_VERSION, discord, equicord: `${VERSION} (${gitHashShort})` };
}

let stopListeners: Array<() => void> = [];

export function startHealth(): void {
    listenToHooks(refreshSoon, tick);
    // A fold or chip that fails its check shows straight away, not on the next tick
    if (!stopListeners.length) stopListeners = [subscribeFold(refreshSoon), subscribeChips(refreshSoon)];
}

export function stopHealth(): void {
    listenToHooks(null, null);
    for (const stop of stopListeners) stop();
    stopListeners = [];
}
