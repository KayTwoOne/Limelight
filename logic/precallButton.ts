/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Limelight button beside Join Voice wears the theme the pre-call screen
// wears: its fill starts from the theme's own colour and is moved only as far as
// it must be to stand out against everything the button can sit on, and its ink
// is whichever of near-black and white reads better on that fill. Pure: imports
// only plugin/logic.

import { contrastRatio, hexToHsv, mixHex, normaliseHex, searchVivid } from "./colour";
import { type Background, LIME } from "./config";
import { everyoneAverage, type PreCallInput, preCallScrimAlpha } from "./styleSheet";
import { STAGE_BASE, stageTint } from "./theme";

// Discord's own pre-call background near the buttons: the dark field and the blue
// glow. The Discord look paints nothing of ours, so these are what is behind.
export const DISCORD_PRECALL_SURFACES = ["#0b0d1a", "#3b3fa6"];
export const INK_DARK = "#11120d";
export const INK_LIGHT = "#ffffff";

// The fill is held to more than the 3:1 that non-text interface components need:
// hover brightens it by 8 percent and press darkens it by 6, and neither step may
// take it back under 3:1.
export const BUTTON_MIN_RATIO = 3.3;

// The scrim is darkest at the middle of the screen and fades to nothing at its
// edge. The join row sits about a fifth of the scrim's radius below its middle,
// so what is behind the button is shaded by four fifths of the scrim's alpha.
const SCRIM_SHARE_AT_BUTTON = 0.8;

// Join Voice is white, so a white-ish Limelight button beside it is the very
// thing this exists to prevent, however well it would contrast with the stage.
// Two guards, neither of which subsumes the other.
//
// Near white: a colour this bright and this unsaturated reads as white even when
// it is a little off it (a pale rose can be 1.6:1 against white and still be
// white to the eye), so the white-contrast guard below would let it through.
const NEAR_WHITE_MAX_SATURATION = 0.2;
const NEAR_WHITE_MIN_VALUE = 0.9;
// Pastel: a fill this close to white (under 1.5:1) is lost beside it unless its
// hue does the separating, which it does only when it is saturated enough. Strong
// light colours such as the lime (saturation 0.63, 1.24:1 against white) are told
// apart from white by hue alone, so they stay.
const PASTEL_MAX_WHITE_RATIO = 1.5;
const PASTEL_MAX_SATURATION = 0.45;

// Whether a colour may be the fill. It is refused when it is near white, or when
// it is both too close to white and too unsaturated to be told from it by hue.
export function fillAllowed(colour: string): boolean {
    const { s, v } = hexToHsv(colour);
    if (s < NEAR_WHITE_MAX_SATURATION && v > NEAR_WHITE_MIN_VALUE) return false;
    return !(contrastRatio(colour, "#ffffff") < PASTEL_MAX_WHITE_RATIO && s < PASTEL_MAX_SATURATION);
}

export interface PreCallButtonColours { fill: string; ink: string; }

export interface PreCallBackdrop {
    /** The colours directly behind the button, as shaded by the scrim where one is painted */
    surfaces: string[];
    /** The theme colour the fill starts from */
    seed: string;
}

function mostSaturated(colours: string[]): string | null {
    let best: string | null = null;
    let bestSaturation = -1;
    for (const colour of colours) {
        const { s } = hexToHsv(colour);
        if (s > bestSaturation) { best = colour; bestSaturation = s; }
    }
    return best;
}

// The colours an Own background is made of: one for a solid, both ends for a
// gradient, and an image's average and lightest once they have been read. Nothing
// while an image is still being read (or for Profile, which Own never holds).
function ownColours(bg: Background, input: PreCallInput): string[] {
    const known = (colours: Array<string | null>) => colours.map(normaliseHex).filter((c): c is string => c !== null);
    switch (bg.type) {
        case "solid": return known([bg.from]);
        case "gradient": return known([bg.from, bg.to]);
        case "image": return bg.imageId ? known([input.imageAverage(bg.imageId), input.imageLightest(bg.imageId)]) : [];
        default: return [];
    }
}

// What the button sits on, and the colour its fill starts from, for the look the
// screen wears now.
export function preCallBackdrop(input: PreCallInput): PreCallBackdrop {
    const { preCall, everyone } = input.config;
    if (preCall.look === "discord") return { surfaces: [...DISCORD_PRECALL_SURFACES], seed: LIME };

    let base: string[];
    let seed: string;
    if (preCall.look === "follow") {
        // The tint is a radial centred above the top left corner and faded out well
        // before the middle of the screen, so the join row sits on the plain stage
        // base. The tint's peak is not behind the button and is not a surface; it
        // only gives the fill its hue.
        base = [STAGE_BASE];
        seed = stageTint(everyone, everyoneAverage(input)) ?? LIME;
    } else {
        const colours = ownColours(preCall.own, input);
        base = colours.length > 0 ? colours : [STAGE_BASE];
        seed = mostSaturated(colours) ?? LIME;
    }

    // The button is inside the scrim, so what is behind it is the base colours as
    // shaded there, not the bare colours and not the fully shaded ones.
    const alpha = preCallScrimAlpha(input);
    const surfaces = alpha > 0 ? base.map(colour => mixHex(colour, "#000000", SCRIM_SHARE_AT_BUTTON * alpha)) : base;
    return { surfaces, seed };
}

export function preCallButtonColours(backdrop: PreCallBackdrop): PreCallButtonColours {
    const fill = searchVivid(backdrop.seed, backdrop.surfaces, BUTTON_MIN_RATIO, fillAllowed);
    const ink = contrastRatio(INK_DARK, fill) >= contrastRatio(INK_LIGHT, fill) ? INK_DARK : INK_LIGHT;
    return { fill, ink };
}
