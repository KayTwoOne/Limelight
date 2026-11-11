/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Match avatar (Tier 4): a theme from someone's avatar. Its two main colours make
// the gradient, lighter first and the far end darkened, as Limelight's own presets
// run; its most vivid colour, made to stand out from both ends, makes the ring.
// The spotlight is kept. Pure: the caller samples the pixels.

import { hexToHsv, mixHex, relativeLuminance, rgbToHex, searchVivid } from "./colour";
import { type Theme } from "./config";

const OPAQUE = 128;
// Colours closer than this (RGB distance) count as one
const DISTINCT = 60;

function mainColours(rgba: ArrayLike<number>): string[] {
    const buckets = new Map<number, [number, number, number, number]>();
    for (let i = 0; i + 3 < rgba.length; i += 4) {
        if (rgba[i + 3] < OPAQUE) continue;
        const key = (rgba[i] >> 5) << 6 | (rgba[i + 1] >> 5) << 3 | rgba[i + 2] >> 5;
        const b = buckets.get(key) ?? [0, 0, 0, 0];
        b[0]++; b[1] += rgba[i]; b[2] += rgba[i + 1]; b[3] += rgba[i + 2];
        buckets.set(key, b);
    }
    return [...buckets.values()].sort((a, b) => b[0] - a[0]).map(([n, r, g, b]) => rgbToHex(r / n, g / n, b / n));
}

function distance(a: string, b: string): number {
    const [x, y] = [a, b].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const vividness = (hex: string) => { const { s, v } = hexToHsv(hex); return s * v; };

export function avatarTheme(rgba: ArrayLike<number>, base: Theme): Theme | null {
    const colours = mainColours(rgba);
    if (colours.length === 0) return null;
    const main = colours[0];
    const other = colours.find(c => distance(c, main) >= DISTINCT) ?? mixHex(main, "#000000", 0.5);
    const [from, far] = relativeLuminance(main) >= relativeLuminance(other) ? [main, other] : [other, main];
    const to = mixHex(far, "#000000", 0.35);
    const ring = searchVivid(vividness(main) >= vividness(other) ? main : other, [from, to], 3);
    return { background: { type: "gradient", from, to, angle: 155 }, spotlight: base.spotlight, ring };
}
