/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Applies the channel list fold (logic/channelFold.ts) to the page, and checks it.
// While your own server call is in view and the list is folded, body carries
// limelight-folded and styles/stage.css narrows Discord's sidebar to the server
// list and stands Discord's own user section in it as a strip (approved mockup,
// 9 Nov 2026): Discord's avatar, buttons and ping icon, re-laid, never redrawn.
//
// The server list's width is measured from Discord's page first, never assumed. A
// moment after folding, the fold checks itself (foldCheck). If Discord's layout did
// not do what it should (the user section spread across the window, Kaylum, 8 Nov
// 2026), the fold is undone at once, stays off for the session, and what was found
// goes into the Health report. Nothing is left behind on stop.

import { ChannelStore, SelectedChannelStore } from "@webpack/common";

import { foldActive, foldCheck, STRIP_BOTTOM, stripGeometry } from "../logic/channelFold";
import { getConfig, subscribe, updateConfig } from "../store/configStore";

const GUILD_VOICE = 2;
const FOLDED = "limelight-folded";
const SIDEBAR = ":is([class^=\"sidebar_\"],[class*=\" sidebar_\"])";
// The server list, the sidebar's first column
const RAIL = `${SIDEBAR} > :is([class^="guilds_"],[class*=" guilds_"])`;
// Discord's user section, the sidebar's own section. Other parts of Discord have
// panels_ classes too (the channel list's, the DM list's), on divs.
const ANY_PANELS = "section:is([class^=\"panels_\"],[class*=\" panels_\"])";
export const PANELS = `${SIDEBAR} > ${ANY_PANELS}`;
// After the sidebar's narrowing (--ll-base, 240ms), which the check measures
const CHECK_MS = 500;

export type FoldHealth = "waiting" | "working" | "broken";

let active = false;
let health: FoldHealth = "waiting";
let failure: string[] = [];
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let stops: Array<() => void> = [];
const listeners = new Set<() => void>();

function notify(): void {
    for (const listener of listeners) listener();
}

function wanted(): boolean {
    const { stage } = getConfig();
    const voiceId = SelectedChannelStore.getVoiceChannelId() ?? null;
    const channel = voiceId ? ChannelStore.getChannel(voiceId) : null;
    return foldActive({
        enabled: stage.foldButton,
        folded: stage.folded,
        selectedId: SelectedChannelStore.getChannelId() ?? null,
        voiceId,
        isGuildVoice: channel?.type === GUILD_VOICE
    });
}

function describe(name: string, el: Element | null): string {
    if (!el) return `${name}: not found`;
    const tag = (node: Element | null) => (node ? `${node.tagName.toLowerCase()}.${(node.getAttribute("class") ?? "").split(" ")[0]}` : "none");
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return `${name}: ${tag(el)} in ${tag(el.parentElement)} in ${tag(el.parentElement?.parentElement ?? null)}; `
        + `position ${cs.position}, left ${Math.round(r.left)}, top ${Math.round(r.top)}, width ${Math.round(r.width)}, height ${Math.round(r.height)}, z ${cs.zIndex}`;
}

function diagnostics(reason: string): string[] {
    const { body } = document;
    return [
        `Channel list fold undone: ${reason}`,
        // Looser than PANELS, so a section that moved out of the sidebar still shows
        describe("User section", document.querySelector(PANELS) ?? document.querySelector(ANY_PANELS)),
        `User sections found: ${document.querySelectorAll(PANELS).length} in the sidebar, ${document.querySelectorAll(ANY_PANELS).length} anywhere`,
        describe("Server list", document.querySelector(RAIL)),
        describe("Sidebar", document.querySelector(SIDEBAR)),
        `Discord sidebar width: ${body.style.getPropertyValue("--custom-guild-sidebar-width").trim() || "unset"}; window ${innerWidth} by ${innerHeight}`
    ];
}

function clear(): void {
    const { body } = document;
    body.classList.remove(FOLDED);
    for (const name of ["--ll-rail-width", "--ll-strip-left"]) body.style.removeProperty(name);
    if (checkTimer !== null) {
        clearTimeout(checkTimer);
        checkTimer = null;
    }
}

function fail(reason: string): void {
    failure = diagnostics(reason);
    clear();
    active = false;
    health = "broken";
    notify();
}

function fold(): void {
    const rail = document.querySelector(RAIL)?.getBoundingClientRect();
    const panel = document.querySelector(PANELS);
    if (!rail?.width || !panel) {
        fail(!panel ? "Discord's user section was not found" : "the server list was not found");
        return;
    }
    const at = stripGeometry(rail.width);
    const expected = { rail: Math.round(rail.width), left: Math.round(rail.left) + at.left, width: at.width, bottom: innerHeight - STRIP_BOTTOM };
    const { body } = document;
    body.style.setProperty("--ll-rail-width", `${expected.rail}px`);
    body.style.setProperty("--ll-strip-left", `${expected.left}px`);
    body.classList.add(FOLDED);
    active = true;
    notify();

    checkTimer = setTimeout(() => {
        checkTimer = null;
        if (!active) return;
        const now = document.querySelector(PANELS);
        const sidebar = document.querySelector(SIDEBAR);
        if (!now || !sidebar) {
            fail("Discord's user section or sidebar went missing");
            return;
        }
        const r = now.getBoundingClientRect();
        const check = foldCheck({
            position: getComputedStyle(now).position,
            left: r.left,
            width: r.width,
            bottom: r.bottom,
            sidebarWidth: sidebar.getBoundingClientRect().width
        }, expected);
        if (check.ok) {
            health = "working";
            failure = [];
            notify();
        } else {
            fail(check.reason ?? "it did not stand in the server list");
        }
    }, CHECK_MS);
}

function apply(): void {
    // A fold that failed its check stays off for the session: retrying would cover
    // the call's controls again
    const next = health !== "broken" && wanted();
    if (next && !active) fold();
    else if (!next && active) {
        clear();
        active = false;
        notify();
    }
}

export function isFoldActive(): boolean {
    return active;
}

export function foldHealth(): FoldHealth {
    return health;
}

export function foldFailure(): readonly string[] {
    return failure;
}

export function subscribeFold(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function toggleFold(): void {
    if (health === "broken") return;
    updateConfig(draft => { draft.stage.folded = !draft.stage.folded; });
}

export function startChannelFold(): void {
    if (stops.length) return;
    SelectedChannelStore.addChangeListener(apply);
    stops = [
        () => SelectedChannelStore.removeChangeListener(apply),
        subscribe(apply)
    ];
    apply();
}

export function stopChannelFold(): void {
    for (const stop of stops) stop();
    stops = [];
    clear();
    const was = active;
    active = false;
    if (was) notify();
}
