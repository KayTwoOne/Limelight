/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Turns stored themes into what a tile, the grid, the stage and chat need.
// Pure: imports only plugin/logic.

import { lightenToContrast, mixHex, normaliseHex, rgba, rgbTriplet } from "./colour";
import { type Background, type DisplaySettings, type LimelightConfig, PRESET_GREY, type Theme } from "./config";

export interface ResolvedTheme { theme: Theme; own: boolean; }

export function themeFor(config: LimelightConfig, userId: string): ResolvedTheme {
    const own = Object.prototype.hasOwnProperty.call(config.people, userId);
    return { theme: own ? config.people[userId] : config.everyone, own };
}

// Image URLs come from URL.createObjectURL, so anything else is refused.
// Quotes, parentheses, backslashes and whitespace could break out of url().
const SAFE_BLOB = /^blob:[^"'()\\\s]+$/;

export function safeImageUrl(url: unknown): string | null {
    return typeof url === "string" && SAFE_BLOB.test(url) ? url : null;
}

export function backgroundCss(bg: Background, imageUrl: string | null): string | null {
    switch (bg.type) {
        case "solid":
            return bg.from;
        case "gradient":
            return `linear-gradient(${bg.angle}deg, ${bg.from} 0%, ${bg.to} 100%)`;
        case "image": {
            const url = safeImageUrl(imageUrl);
            return url ? `center / cover no-repeat url("${url}")` : null;
        }
        default:
            return null;
    }
}

export const SPOTLIGHT_OPACITY = { off: 0, soft: 0.5, bright: 1 } as const;

export interface TileStyle {
    overridesBackground: boolean;
    vars: Record<string, string>;
}

export function tileStyle(theme: Theme, display: DisplaySettings, imageUrl: string | null): TileStyle {
    const ringVars = { "--ll-ring": theme.ring, "--ll-ring-rgb": rgbTriplet(theme.ring) };
    if (display.disableUserThemes) {
        return { overridesBackground: true, vars: { "--ll-bg": PRESET_GREY, "--ll-spot": "0", ...ringVars } };
    }
    const css = backgroundCss(theme.background, imageUrl);
    return {
        overridesBackground: css !== null,
        vars: { "--ll-bg": css ?? "none", "--ll-spot": String(SPOTLIGHT_OPACITY[theme.spotlight]), ...ringVars }
    };
}

export const CORNER_PX = { sharp: 3, soft: 20 } as const;
export const GAP_PX = { tight: 3, airy: 18 } as const;

export function gridVars(display: DisplaySettings): Record<string, string> {
    const vars: Record<string, string> = { "--ll-zoom": String(display.gridZoom / 100) };
    if (display.corners !== "discord") vars["--ll-radius"] = CORNER_PX[display.corners] + "px";
    if (display.spacing !== "normal") vars["--ll-gap"] = GAP_PX[display.spacing] + "px";
    return vars;
}

export const STAGE_BASE = "#0b0c0e";
export const STAGE_TINT_ALPHA = 0.6;
export const STAGE_SPOT_HEX = "#fff6d2";
export const STAGE_SPOT_ALPHA = 0.1;
// What Follow grid lays over the stage under the chat (tokens.md 7.1).
export const FOLLOW_WASH_HEX = "#08090b";
export const FOLLOW_WASH_ALPHA = 0.4;
const STAGE_SPOT = `radial-gradient(42% 50% at 34% -8%, ${rgba(STAGE_SPOT_HEX, STAGE_SPOT_ALPHA)} 0%, ${rgba(STAGE_SPOT_HEX, 0)} 70%)`;

// The colour the stage is tinted with: the Everyone theme's main colour, the
// image's average for an image, and none for Profile.
export function stageTint(everyone: Theme, imageAverage: string | null): string | null {
    const bg = everyone.background;
    return bg.type === "profile" ? null
        : bg.type === "image" ? normaliseHex(imageAverage)
            : bg.from;
}

export function stageCss(everyone: Theme, imageAverage: string | null): string {
    const main = stageTint(everyone, imageAverage);
    if (!main) return STAGE_BASE;
    return `${STAGE_SPOT}, radial-gradient(80% 70% at 30% -10%, ${rgba(main, STAGE_TINT_ALPHA)} 0%, ${rgba(main, 0)} 70%), ${STAGE_BASE}`;
}

// The lightest point of the stage as painted: where the tint is full strength and
// the spotlight overlaps it, with nothing laid over it. Anything that sits straight
// on the stage and has to stay readable (the pre-call screen's scrim) is sized for
// this point, since text only gets harder to read as the surface gets lighter.
// Profile has no tint and no spotlight, so it is the base.
export function stagePeak(everyone: Theme, imageAverage: string | null): string {
    const tint = stageTint(everyone, imageAverage);
    return tint ? mixHex(mixHex(STAGE_BASE, tint, STAGE_TINT_ALPHA), STAGE_SPOT_HEX, STAGE_SPOT_ALPHA) : STAGE_BASE;
}

// The lightest point of what Follow grid paints behind the chat: the stage's peak
// under the wash. A scrim, and the colour a theme dot is lightened against, must
// hold at this point. Only the chat has the wash, so only the chat may be sized
// against this; the pre-call screen paints the stage without it.
export function stageLightest(everyone: Theme, imageAverage: string | null): string {
    return mixHex(stagePeak(everyone, imageAverage), FOLLOW_WASH_HEX, FOLLOW_WASH_ALPHA);
}

export function dotColour(theme: Theme, surface: string, fallbackMain: string | null): string {
    const bg = theme.background;
    const main = bg.type === "solid" || bg.type === "gradient"
        ? bg.from
        : normaliseHex(fallbackMain) ?? theme.ring;
    return lightenToContrast(main, surface, 3, surface);
}
