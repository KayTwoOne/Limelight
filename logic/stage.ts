/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The stage behind every tile (Stage tab): Discord's own, the stage the Everyone
// theme makes (what Follow grid painted before 1.2), or a background of its own.
// The chat's and the pre-call screen's Follow grid both follow it. Pure: the
// caller supplies the stored images' URL and sampled colours.

import { mixHex } from "./colour";
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
}

const imageOf = (bg: Background) => (bg.type === "image" && bg.imageId ? bg.imageId : null);

// Null for Discord's own stage, and for an Own image still being read, so nothing
// is painted until the picture arrives.
export function stagePaint(config: LimelightConfig, lookup: ImageLookup): StagePaint | null {
    const { stage, everyone } = config;
    if (stage.look === "discord") return null;
    if (stage.look === "everyone") {
        const id = imageOf(everyone.background);
        const average = id ? lookup.imageAverage(id) : null;
        return { paint: stageCss(everyone, average), peak: stagePeak(everyone, average), washedLightest: stageLightest(everyone, average) };
    }
    const id = imageOf(stage.own);
    const paint = backgroundCss(stage.own, id ? lookup.imageUrl(id) : null);
    if (!paint) return null;
    const lightest = lightestOf(stage.own, id ? lookup.imageLightest(id) : null) ?? "#ffffff";
    return { paint, peak: lightest, washedLightest: mixHex(lightest, FOLLOW_WASH_HEX, FOLLOW_WASH_ALPHA) };
}
