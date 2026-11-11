/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// A theme as a short code a friend with Limelight can paste (Tier 4):
// ll1.<background>.<from>.<to>.<angle>.<spotlight>.<ring>, e.g.
// ll1.g.b3123e.2a0610.155.s.d8f35a. An image theme has none, since the picture
// lives only on this computer. A pasted code is someone else's text, so it is read
// strictly and then rebuilt by the same sanitiser as every stored theme. Pure.

import { type BackgroundType, sanitiseTheme, type SpotlightLevel, type Theme } from "./config";

const TYPE: Partial<Record<BackgroundType, string>> = { profile: "p", solid: "s", gradient: "g" };
const LEVEL: Record<SpotlightLevel, string> = { off: "o", soft: "s", bright: "b" };
const CODE = /(?:^|[^a-z0-9.])ll1\.([psg])\.([0-9a-f]{6})\.([0-9a-f]{6})\.(0|[1-9]\d{0,2})\.([osb])\.([0-9a-f]{6})(?![a-z0-9]|\.[a-z0-9])/i;

const bare = (hex: string) => hex.replace("#", "").toLowerCase();
const key = <T extends string>(map: Partial<Record<T, string>>, letter: string) => (Object.keys(map) as T[]).find(k => map[k] === letter)!;

export function themeCode(theme: Theme): string | null {
    const type = TYPE[theme.background.type];
    if (!type) return null;
    const { from, to, angle } = theme.background;
    return ["ll1", type, bare(from), bare(to), angle, LEVEL[theme.spotlight], bare(theme.ring)].join(".");
}

export function readThemeCode(text: string): Theme | null {
    const m = CODE.exec(text);
    if (!m) return null;
    const angle = Number(m[4]);
    if (angle > 360 || angle % 5 !== 0) return null;
    return sanitiseTheme({
        background: { type: key(TYPE, m[1].toLowerCase()), from: `#${m[2]}`, to: `#${m[3]}`, angle },
        spotlight: key(LEVEL, m[5].toLowerCase()),
        ring: `#${m[6]}`
    });
}
