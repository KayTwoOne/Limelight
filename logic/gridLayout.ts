/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Small tiles: who goes in the strip, and how tall the strip is. Discord's grid
// (module 511205) gives every tile the same 16:9 width from the count and the box
// it measures, so Limelight lays out two of Discord's grids and solves the
// strip's height for the size wanted. discordTileWidth is a direct port of that
// module's maths (tools/tests/gridLayout.test.ts checks it against a brute-force
// reading). Pure.

import { type TileSettings } from "./config";

const TILE = 16 / 9;
const GAP = 8;
// What Discord takes off the measured box before laying tiles out: 16 across, and
// the grid's top and bottom padding (64 each by default) down
export const GRID_INSET_X = 16;
// Paddings when split: 64 where the call's header or controls overlay the grid,
// 8 on the side facing the other grid
export const OUTER_PAD = 64;
export const INNER_PAD = 8;
export const STRIP_MIN = OUTER_PAD + INNER_PAD + 36;

function columns(tileWidth: number, width: number): number {
    return Math.max(1, Math.floor((width - tileWidth) / (GAP + tileWidth)) + 1);
}

// The first value in [lo, hi) for which pred is false (pred holds on a prefix)
function firstFalse(lo: number, hi: number, pred: (value: number) => boolean): number {
    let count = hi - lo;
    while (count > 0) {
        const step = Math.floor(count / 2);
        const at = lo + step;
        if (pred(at)) {
            lo = at + 1;
            count -= step + 1;
        } else {
            count = step;
        }
    }
    return lo;
}

// The tile width Discord's grid picks for count tiles in a width by height box
// (already less its insets and paddings)
export function discordTileWidth(count: number, width: number, height: number): number {
    const lo = Math.floor(width / 25);
    if (count > 25) {
        return firstFalse(lo, width, e => {
            const h = e / TILE;
            return columns(e, width) * (Math.ceil((height - h) / (GAP + h)) + 1) > 25;
        });
    }
    return firstFalse(lo, width, e => {
        const h = e / TILE;
        return columns(e, width) * (Math.floor((height - h) / (GAP + h)) + 1) >= count;
    }) - 1;
}

export interface StripInput {
    width: number;
    height: number;
    mainCount: number;
    smallCount: number;
    /** Small tile width as a share of a main tile's: 0.5 for Half, 1/3 for Third */
    ratio: number;
}

// The strip's height in pixels: the least that makes small tiles at least ratio
// times a main tile's width, between STRIP_MIN and half the height. 0 when there
// is nothing to split.
export function solveStrip({ width, height, mainCount, smallCount, ratio }: StripInput): number {
    if (mainCount === 0 || smallCount === 0 || width <= 0 || height <= 0) return 0;
    const max = Math.floor(height / 2);
    if (max <= STRIP_MIN) return max;
    const inner = width - GRID_INSET_X;
    const pads = OUTER_PAD + INNER_PAD;
    const enough = (strip: number) =>
        discordTileWidth(smallCount, inner, strip - pads) >= ratio * discordTileWidth(mainCount, inner, height - strip - pads);
    // firstFalse finds the first height where "not enough" is false
    return Math.min(max, firstFalse(STRIP_MIN, max + 1, strip => !enough(strip)));
}

interface ParticipantLike {
    user?: { id?: unknown; bot?: unknown; } | null;
}

// A participant with a user (a person's tile or their stream) is small when a size
// is set for them, or when they are a bot and Bots get small tiles is on.
// Anything without a user (an activity) stays in the main grid.
export function isSmall(participant: ParticipantLike | null | undefined, tiles: Pick<TileSettings, "smallBots" | "people">): boolean {
    const user = participant?.user;
    if (!user || typeof user.id !== "string") return false;
    const size = tiles.people[user.id];
    if (size) return size === "small";
    return tiles.smallBots && user.bot === true;
}
