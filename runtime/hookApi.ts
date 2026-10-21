/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The runtime side of every patch. A patch calls a $self method; the method runs
// through guard(), which records that the hook ran and keeps an exception out of
// Discord's render by returning Discord's own value instead. The watchdog tells
// the log, once, when a hook that must run while the call view shows never did.

import { Logger } from "@utils/Logger";
import { SelectedChannelStore } from "@webpack/common";

import { checkHooks, createHookMonitor, markSeen } from "../logic/hooks";
import { CALL } from "../logic/styleSheet";
import { HOOK } from "../patches";

const logger = new Logger("Limelight");
const monitor = createHookMonitor();
const WATCH_MS = 2000;

// The hooks every call view must run, and what each one switches off when it
// does not. The others only run on interaction (watch, badge, tray) or on a screen
// the call view's surface is never on (precall, the screen before joining), so
// they cannot be expected here; tools/verify-patches.mjs checks them offline.
const EXPECTED: readonly string[] = [HOOK.tiles, HOOK.fold];
const FEATURE_OFF: Record<string, string> = {
    [HOOK.tiles]: "per-person themes, name pills and tile spacing are off",
    [HOOK.fold]: "one tile per person while streaming is off"
};

const failed = new Set<string>();
let timer: ReturnType<typeof setInterval> | null = null;

export function markHook(name: string): void {
    markSeen(monitor, name);
}

// Marks the hook seen, runs fn, and on any error logs it once per hook and
// returns fallback, which callers set to Discord's original value.
export function guard<T>(name: string, fallback: T, fn: () => T): T {
    markHook(name);
    try {
        return fn();
    } catch (error) {
        if (!failed.has(name)) {
            failed.add(name);
            logger.error(`Hook "${name}" threw, so Discord's own behaviour is used there.`, error);
        }
        return fallback;
    }
}

// The surface that must run both expected hooks: a call container holding at
// least one of Discord's tile wrappers. That attribute is on every tile whether
// or not Limelight's patch applied, so a real failure is still caught. The bare
// container is not enough: with "Show Non-Video Participants" off and nobody on
// video, Discord shows voice-only avatars or an empty state with no tile at all.
const TILE_SURFACE = `${CALL} [data-selenium-video-tile]`;

function tick(): void {
    try {
        const surfaceLive = Boolean(SelectedChannelStore.getVoiceChannelId()) && document.querySelector(TILE_SURFACE) !== null;
        for (const name of checkHooks(monitor, surfaceLive, Date.now(), EXPECTED)) {
            logger.error(`Hook "${name}" never ran while the call view was showing, so ${FEATURE_OFF[name] ?? "part of Limelight is off"}. Discord may have changed this part of its code.`);
        }
    } catch (error) {
        // Log once and stop: a check that throws will throw on every tick.
        logger.error("The hook watchdog failed and has stopped.", error);
        stopWatchdog();
    }
}

export function startWatchdog(): void {
    if (timer !== null) return;
    timer = setInterval(tick, WATCH_MS);
}

export function stopWatchdog(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
}
