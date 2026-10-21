/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Limelight colour maths. Pure: imports nothing outside plugin/logic.

export interface Rgb { r: number; g: number; b: number; }
export interface Hsv { h: number; s: number; v: number; }

const HEX6 = /^#?([0-9a-fA-F]{6})$/;
const HEX3 = /^#?([0-9a-fA-F]{3})$/;

export function normaliseHex(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    const six = HEX6.exec(trimmed);
    if (six) return "#" + six[1].toLowerCase();
    const three = HEX3.exec(trimmed);
    if (three) {
        const s = three[1].toLowerCase();
        return "#" + s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    return null;
}

export function hexToRgb(hex: string): Rgb {
    const n = normaliseHex(hex) ?? "#000000";
    return {
        r: parseInt(n.slice(1, 3), 16),
        g: parseInt(n.slice(3, 5), 16),
        b: parseInt(n.slice(5, 7), 16)
    };
}

function channel(n: number): string {
    const value = Number.isFinite(n) ? Math.round(n) : 0;
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + channel(r) + channel(g) + channel(b);
}

export function rgbTriplet(hex: string): string {
    const { r, g, b } = hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
}

export function hexToHsv(hex: string): Hsv {
    const { r, g, b } = hexToRgb(hex);
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === rf) h = ((gf - bf) / d) % 6;
        else if (max === gf) h = (bf - rf) / d + 2;
        else h = (rf - gf) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
    const hh = ((h % 360) + 360) % 360;
    const ss = Math.max(0, Math.min(1, s));
    const vv = Math.max(0, Math.min(1, v));
    const c = vv * ss;
    const x = c * (1 - Math.abs((hh / 60) % 2 - 1));
    const m = vv - c;
    let r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; }
    else if (hh < 120) { r = x; g = c; }
    else if (hh < 180) { g = c; b = x; }
    else if (hh < 240) { g = x; b = c; }
    else if (hh < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function linear(c: number): number {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}

export function mixHex(a: string, b: string, t: number): string {
    const k = Math.max(0, Math.min(1, t));
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return rgbToHex(x.r + (y.r - x.r) * k, x.g + (y.g - x.g) * k, x.b + (y.b - x.b) * k);
}

// Steps towards white in twentieths until the ratio is met. Integer steps
// avoid the floating point drift a 0.05 accumulator would pick up. With
// `notDarker`, a candidate must also be at least as light as that colour, so a
// colour that passes by being darker than the surface keeps lightening.
export function lightenToContrast(hex: string, against: string, minRatio: number, notDarker?: string): string {
    const floor = notDarker ? relativeLuminance(notDarker) : 0;
    for (let i = 0; i <= 20; i++) {
        const candidate = mixHex(hex, "#ffffff", i / 20);
        if (contrastRatio(candidate, against) >= minRatio && relativeLuminance(candidate) >= floor) return candidate;
    }
    return "#ffffff";
}

export function rgba(hex: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgbTriplet(hex)}, ${a})`;
}

// A colour that keeps its hue and saturation while reaching minRatio against
// every surface: brightness is walked first (in twentieths of the way to full
// or none), and only if that is not enough is the brightest or darkest version
// mixed towards white or black. Mixing with white first would grey a vivid
// colour out. Lighter is tried first on dark surfaces (mean relative luminance
// at most 0.18), darker first on light ones. If nothing passes, the candidate
// with the best worst-case ratio wins. `accept`, when given, is a test every
// candidate must also pass, to be returned and to be the fallback: a colour it
// refuses is skipped, the starting colour included. If nothing passes it, the
// starting colour comes back.
export function searchVivid(hex: string, surfaces: string[], minRatio: number, accept?: (c: string) => boolean): string {
    const worst = (c: string) => Math.min(...surfaces.map(s => contrastRatio(c, s)));
    const allowed = (c: string) => accept === undefined || accept(c);
    const start = normaliseHex(hex) ?? "#000000";
    let best = start;
    let bestScore = allowed(start) ? worst(start) : -Infinity;
    if (bestScore >= minRatio) return start;
    const mean = surfaces.reduce((sum, s) => sum + relativeLuminance(s), 0) / surfaces.length;
    const lighterFirst = mean <= 0.18;
    const { h, s, v } = hexToHsv(start);
    const consider = (c: string): boolean => {
        if (!allowed(c)) return false;
        const score = worst(c);
        if (score >= minRatio) return true;
        if (score > bestScore) { best = c; bestScore = score; }
        return false;
    };
    for (const up of [lighterFirst, !lighterFirst]) {
        for (let i = 1; i <= 20; i++) {
            const c = hsvToHex(h, s, up ? v + (1 - v) * i / 20 : v * (1 - i / 20));
            if (consider(c)) return c;
        }
        const edge = hsvToHex(h, s, up ? 1 : 0);
        for (let i = 1; i <= 20; i++) {
            const c = mixHex(edge, up ? "#ffffff" : "#000000", i / 20);
            if (consider(c)) return c;
        }
    }
    return best;
}
