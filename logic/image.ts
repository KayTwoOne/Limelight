/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Image background maths: sizing, colour sampling and ids. Pure.

import { relativeLuminance, rgbToHex } from "./colour";
import { type Background, type LimelightConfig } from "./config";

export const MAX_EDGE = 1280;
export const MAX_BYTES = 2 * 1024 * 1024;
export const WEBP_QUALITY = 0.85;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const OPAQUE = 16;

export function isAcceptedType(mime: unknown): boolean {
    return typeof mime === "string" && ACCEPTED.has(mime);
}

export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number; } | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function averageColour(rgba: ArrayLike<number>): string | null {
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i + 3 < rgba.length; i += 4) {
        if (rgba[i + 3] < OPAQUE) continue;
        r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
    }
    return n === 0 ? null : rgbToHex(r / n, g / n, b / n);
}

export function lightestColour(rgba: ArrayLike<number>): string | null {
    let best: string | null = null;
    let bestL = -1;
    for (let i = 0; i + 3 < rgba.length; i += 4) {
        if (rgba[i + 3] < OPAQUE) continue;
        const hex = rgbToHex(rgba[i], rgba[i + 1], rgba[i + 2]);
        const l = relativeLuminance(hex);
        if (l > bestL) { bestL = l; best = hex; }
    }
    return best;
}

export function newImageId(random: () => number = Math.random): string {
    let id = "";
    for (let i = 0; i < 16; i++) id += ID_CHARS[Math.min(ID_CHARS.length - 1, Math.floor(random() * ID_CHARS.length))];
    return id;
}

// Every image a config holds: Everyone, each person, the chat's Own look and the
// pre-call screen's Own look. A background keeps its image while it shows another
// type (only Remove lets go), so the id counts whatever the type is.
export function referencedImageIds(config: LimelightConfig): Set<string> {
    const ids = new Set<string>();
    const note = (background: Background) => {
        if (background.imageId) ids.add(background.imageId);
    };
    note(config.everyone.background);
    for (const theme of Object.values(config.people)) note(theme.background);
    note(config.chat.own);
    note(config.preCall.own);
    return ids;
}

// The stored images that can be deleted: those no config references and that are
// not held (an image being added is stored a moment before the config points at
// it). Keys that are not text are never touched.
export function orphanImageIds(stored: readonly unknown[], referenced: ReadonlySet<string>, held: ReadonlySet<string> = new Set()): string[] {
    return stored.filter((key): key is string => typeof key === "string" && !referenced.has(key) && !held.has(key));
}
