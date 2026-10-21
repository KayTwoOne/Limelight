/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// How big a tile's chrome is, and how much of the pill it can show.
// Pure: imports nothing.

export const SCALE_REFERENCE_PX = 720;
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.25;
export const MINI_BELOW_PX = 240;

export function chromeScale(tileWidth: number, gridZoom: number): number {
    const w = Number.isFinite(tileWidth) && tileWidth > 0 ? tileWidth : SCALE_REFERENCE_PX;
    const zoom = Number.isFinite(gridZoom) ? Math.max(50, Math.min(150, gridZoom)) : 100;
    const auto = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.sqrt(w / SCALE_REFERENCE_PX)));
    return auto * (zoom / 100);
}

export type Tier = "full" | "compact" | "mini";

// Comparisons are written as !(a <= b) so NaN measurements fall through to
// the smaller tier instead of claiming room they cannot prove.
export function pickTier(tileWidth: number, scale: number, fullPx: number, compactPx: number): Tier {
    if (!(tileWidth >= MINI_BELOW_PX)) return "mini";
    const room = tileWidth - 20 * scale;
    if (!(compactPx <= room)) return "mini";
    if (!(fullPx <= room)) return "compact";
    return "full";
}
