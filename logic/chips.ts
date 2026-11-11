/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Chip small tiles (tiles/ChipStrip.tsx): each small person as one 40px line, with
// Discord's own tile stretched behind Limelight's face. Pure.

import { type ActivityFace, activityFace, type ActivityLike } from "./activity";

/** A chip's height, the mockup's one line */
export const CHIP_H = 40;
/** The width Discord's tile is told it has, so it lays itself out compact */
export const CHIP_TILE_WIDTH = 72;

export interface ChipMeasure {
    chipWidth: number;
    chipHeight: number;
    /** Discord's tile inside the chip; 0 by 0 when it isn't there */
    tileWidth: number;
    tileHeight: number;
}

const SLACK = 2;

// Whether a chip came out as it should: one line tall, with Discord's tile filling
// it exactly. If Discord's tile kept a size of its own, its theme, speaking ring
// and clicks wouldn't line up with the chip, so chips are switched off instead.
export function chipCheck(m: ChipMeasure): { ok: boolean; reason?: string; } {
    const problems: string[] = [];
    if (m.chipHeight < CHIP_H - 4 || m.chipHeight > CHIP_H + 8) problems.push(`chip ${Math.round(m.chipHeight)}px tall, expected ${CHIP_H}`);
    if (m.tileWidth <= 0 || m.tileHeight <= 0) problems.push("Discord's tile is missing");
    else if (Math.abs(m.tileWidth - m.chipWidth) > SLACK || Math.abs(m.tileHeight - m.chipHeight) > SLACK) {
        problems.push(`tile ${Math.round(m.tileWidth)} by ${Math.round(m.tileHeight)} in a ${Math.round(m.chipWidth)} by ${Math.round(m.chipHeight)} chip`);
    }
    return problems.length ? { ok: false, reason: problems.join("; ") } : { ok: true };
}

export interface ChipVoiceState {
    selfMute?: boolean;
    mute?: boolean;
    selfDeaf?: boolean;
    deaf?: boolean;
    /** You muted them for yourself */
    localMute?: boolean;
}

// Which icon the chip shows. Deafening implies muting, so one icon says it, as on
// a person's name pill; muted by themselves, the server or you all read as muted.
export function chipVoice(v: ChipVoiceState): { muted: boolean; deafened: boolean; } {
    const deafened = v.selfDeaf === true || v.deaf === true;
    return { deafened, muted: !deafened && (v.selfMute === true || v.mute === true || v.localMute === true) };
}

// Playing, Listening, Watching and Competing: what a bot is doing. A custom status
// (4) is not an activity.
const CHIP_ACTIVITY_TYPES: readonly number[] = [0, 2, 3, 5];

export function chipActivity(activities: readonly ActivityLike[]): ActivityFace | null {
    return activityFace(activities.find(x => CHIP_ACTIVITY_TYPES.includes(x.type) && typeof x.name === "string" && x.name.length > 0));
}

/** Clear space between chips and the call's controls (or header), past Discord's own pad */
export const CHIP_LIFT = 16;
/** The gap on the side facing the main grid, as between Discord's own grids */
const CHIP_INNER = 8;

// The chip strip's paddings. outer is Discord's pad where its controls (below) or
// header (above) overlay the call; the chips keep CHIP_LIFT clear of it. The main
// grid takes whatever the strip leaves, so this holds however many people are in.
export function chipPads(place: "below" | "above", outer: number): { top: number; bottom: number; } {
    const far = outer + CHIP_LIFT;
    return place === "below" ? { top: CHIP_INNER, bottom: far } : { top: far, bottom: CHIP_INNER };
}
