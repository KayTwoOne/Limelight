/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The readability scrim behind chat text on an Own theme background: the
// smallest black overlay that keeps message text at 4.5:1 (spec 8.3).

import { contrastRatio, mixHex, normaliseHex, relativeLuminance } from "./colour";
import { type Background, type ChatSettings, type Theme } from "./config";
import { stageLightest } from "./theme";

export const CHAT_TEXT = "#dbdee1";

export function lightestOf(bg: Background, imageLightest: string | null): string | null {
    switch (bg.type) {
        case "solid": return bg.from;
        case "gradient": return relativeLuminance(bg.from) >= relativeLuminance(bg.to) ? bg.from : bg.to;
        case "image": return normaliseHex(imageLightest);
        default: return null;
    }
}

export function scrimAlpha(lightest: string | null, text = CHAT_TEXT, minRatio = 4.5): number {
    const base = normaliseHex(lightest) ?? "#ffffff";
    for (let i = 0; i <= 100; i++) {
        if (contrastRatio(text, mixHex(base, "#000000", i / 100)) >= minRatio) return i / 100;
    }
    return 1;
}

// The chat's lightest surface colour, which a theme dot is lightened against: under
// Follow grid the stage's lightest point (tint and spotlight under the wash), and
// under Own theme the background's lightest colour after its scrim. Worst case, so
// a dot reads everywhere in chat; the colour is only ever lightened, so the
// lightest surface is the one that decides.
export function chatSurface(chat: ChatSettings, everyone: Theme, imageLightest: string | null, imageAverage: string | null): string {
    if (chat.look === "follow") return stageLightest(everyone, imageAverage);
    const lightest = lightestOf(chat.own, imageLightest) ?? "#ffffff";
    return mixHex(lightest, "#000000", scrimAlpha(lightest));
}
