/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The stage behind every tile (Stage tab): Discord's own, the stage the Everyone
// theme makes (what Follow grid painted before 1.2), or a background of its own.
// The chat's and the pre-call screen's Follow grid both follow it. Pure: the
// caller supplies the stored images' URL and sampled colours.

import { mixHex, relativeLuminance, rgbTriplet } from "./colour";
import { type Background, type LimelightConfig } from "./config";
import { lightestOf } from "./scrim";
import { backgroundCss, FOLLOW_WASH_ALPHA, FOLLOW_WASH_HEX, stageCss, stageLightest, stagePeak } from "./theme";

export interface ImageLookup {
    imageUrl(imageId: string): string | null;
    imageAverage(imageId: string): string | null;
    imageLightest(imageId: string): string | null;
}

export interface StagePaint {
    /** The CSS background the call wrapper paints */
    paint: string;
    /** Its lightest point, bare: what the pre-call screen's scrim is sized for */
    peak: string;
    /** Its lightest point under Follow grid's wash: what the chat is sized for */
    washedLightest: string;
    /** Its darkest colour, which tints Discord's shading behind the call's controls; null for a profile background */
    deep: string | null;
}

const imageOf = (bg: Background) => (bg.type === "image" && bg.imageId ? bg.imageId : null);

function deepOf(bg: Background, average: string | null): string | null {
    if (bg.type === "solid") return bg.from;
    if (bg.type === "gradient") return relativeLuminance(bg.from) <= relativeLuminance(bg.to) ? bg.from : bg.to;
    if (bg.type === "image") return average;
    return null;
}

// Discord shades the top and bottom 160px of the call so its header and controls
// read over video. The shade keeps Discord's curve, in the stage's darkest colour
// taken 60% of the way to black: white over it reads at 5.7:1 even on a white stage.
export const shadeTint = (deep: string) => mixHex(deep, "#000000", 0.6);

const SHADE_STOPS: [number, number][] = [[1, 0], [0.738, 19], [0.541, 34], [0.382, 47], [0.278, 56.5], [0.194, 65], [0.126, 73], [0.075, 80.2], [0.042, 86.1], [0.021, 91], [0.008, 95.2], [0.002, 98.2]];

export function stageShade(tint: string): string {
    const rgb = rgbTriplet(tint);
    return `linear-gradient(${SHADE_STOPS.map(([a, at]) => `rgba(${rgb}, ${a}) ${at}%`).join(", ")}, transparent 100%)`;
}

// Null for Discord's own stage, and for an Own image still being read, so nothing
// is painted until the picture arrives.
export function stagePaint(config: LimelightConfig, lookup: ImageLookup): StagePaint | null {
    const { stage, everyone } = config;
    if (stage.look === "discord") return null;
    if (stage.look === "everyone") {
        const id = imageOf(everyone.background);
        const average = id ? lookup.imageAverage(id) : null;
        return { paint: stageCss(everyone, average), peak: stagePeak(everyone, average), washedLightest: stageLightest(everyone, average), deep: deepOf(everyone.background, average) };
    }
    const id = imageOf(stage.own);
    const paint = backgroundCss(stage.own, id ? lookup.imageUrl(id) : null);
    if (!paint) return null;
    const lightest = lightestOf(stage.own, id ? lookup.imageLightest(id) : null) ?? "#ffffff";
    return { paint, peak: lightest, washedLightest: mixHex(lightest, FOLLOW_WASH_HEX, FOLLOW_WASH_ALPHA), deep: deepOf(stage.own, id ? lookup.imageAverage(id) : null) };
}
