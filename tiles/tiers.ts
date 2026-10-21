/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Decides, for each pill, how much of it fits its tile: Full, Compact or Mini
// (spec 7). One shared ResizeObserver watches every pill and its tile; each time
// either changes (and when the grid zoom changes) the pill's natural Full width
// and its width without the activity block are measured, logic/scale.ts picks the
// tier, and the result is written to the pill as data-tier.
//
// The measure does not depend on the current tier: tier CSS only takes a part out
// of the flow (absolute, clipped), so every part keeps its natural width. The
// observer is created with the first pill and disconnected after the last.

import { chromeScale, pickTier } from "../logic/scale";
import { getConfig, subscribe } from "../store/configStore";

const TILE = ".limelight-tile";
const PILL = "ll-pill";
const MORE = "ll-pill-more";
// The pill's height at chrome scale 1 (tokens.md 2.1), so height / 40 is --ll-s.
const PILL_HEIGHT_PX = 40;

const tiles = new Map<Element, Set<HTMLElement>>();
let observer: ResizeObserver | null = null;
let stopConfig: (() => void) | null = null;
let frame = 0;
let nativeScale: boolean | null = null;

// Chrome scale is computed by CSS (--ll-s from cqw and sqrt). If this Chromium
// cannot, tiers.ts writes --ll-s from chromeScale() as a plain number instead.
function supportsNativeScale(): boolean {
    nativeScale ??= CSS.supports("width", "calc(1px * sqrt(100cqw / 720px))");
    return nativeScale;
}

function px(value: string): number {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

// Layout width, not the painted one: the tile can be scaled for spacing and a
// pill can be mid-animation, and neither changes the room the pill has.
function layoutWidth(el: HTMLElement): number {
    const w = parseFloat(getComputedStyle(el).width);
    return Number.isFinite(w) ? w : el.offsetWidth;
}

function outerWidth(el: HTMLElement): number {
    const style = getComputedStyle(el);
    const w = parseFloat(style.width);
    return (Number.isFinite(w) ? w : el.offsetWidth) + px(style.marginLeft) + px(style.marginRight);
}

function scaleOf(pill: HTMLElement, tileWidth: number): number {
    const zoom = getConfig().display.gridZoom;
    if (!supportsNativeScale()) {
        const s = chromeScale(tileWidth, zoom);
        pill.style.setProperty("--ll-s", String(Math.round(s * 1000) / 1000));
        return s;
    }
    const s = parseFloat(getComputedStyle(pill).height) / PILL_HEIGHT_PX;
    return s > 0 ? s : chromeScale(tileWidth, zoom);
}

function naturalWidths(pill: HTMLElement): { full: number; compact: number; } {
    const style = getComputedStyle(pill);
    const gap = px(style.columnGap);
    let compact = px(style.paddingLeft) + px(style.paddingRight);
    let parts = 0;
    let more = 0;
    for (const child of Array.from(pill.children)) {
        const el = child as HTMLElement;
        if (el.classList.contains(MORE)) {
            more = outerWidth(el);
        } else {
            compact += outerWidth(el);
            parts++;
        }
    }
    if (parts > 1) compact += gap * (parts - 1);
    const full = more > 0 ? compact + (parts > 0 ? gap : 0) + more : compact;
    return { full, compact };
}

export function measurePill(pill: HTMLElement): void {
    const tile = pill.closest<HTMLElement>(TILE);
    if (!tile) return;
    const tileWidth = layoutWidth(tile);
    const scale = scaleOf(pill, tileWidth);
    const { full, compact } = naturalWidths(pill);
    const tier = pickTier(tileWidth, scale, full, compact);
    if (pill.dataset.tier !== tier) pill.dataset.tier = tier;
}

function measureAll(): void {
    frame = 0;
    for (const pills of tiles.values()) for (const pill of pills) measurePill(pill);
}

// The grid zoom is a config value: it scales the pill without resizing a tile,
// so the observer alone would never hear about it. Runs after the sheet's own
// frame, which was scheduled first by the same store change.
function scheduleAll(): void {
    if (frame === 0) frame = requestAnimationFrame(measureAll);
}

function onResize(entries: ResizeObserverEntry[]): void {
    const due = new Set<HTMLElement>();
    for (const { target } of entries) {
        if (target.classList.contains(PILL)) due.add(target as HTMLElement);
        else for (const pill of tiles.get(target) ?? []) due.add(pill);
    }
    for (const pill of due) measurePill(pill);
}

// Starts tracking a mounted pill. Returns the function that stops it.
export function observePill(pill: HTMLElement): () => void {
    const tile = pill.closest(TILE);
    if (!tile) return () => { };

    const watcher = observer ??= new ResizeObserver(onResize);
    const pills = tiles.get(tile) ?? new Set<HTMLElement>();
    if (!tiles.has(tile)) {
        tiles.set(tile, pills);
        watcher.observe(tile);
    }
    pills.add(pill);
    watcher.observe(pill);
    stopConfig ??= subscribe(scheduleAll);

    return () => {
        watcher.unobserve(pill);
        pills.delete(pill);
        if (pills.size === 0) {
            watcher.unobserve(tile);
            tiles.delete(tile);
        }
        if (tiles.size === 0) {
            watcher.disconnect();
            observer = null;
            stopConfig?.();
            stopConfig = null;
            if (frame !== 0) cancelAnimationFrame(frame);
            frame = 0;
        }
    };
}
