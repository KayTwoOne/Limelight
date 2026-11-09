/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The channel list fold (Stage tab): when it applies, where Discord's user section
// stands while it does, and the check that it did. Pure. (logic/fold.ts is the
// other fold: a streamer's tiles folded into one.)

export interface FoldState {
    /** The « » button is on (Stage tab) */
    enabled: boolean;
    /** The person folded the list */
    folded: boolean;
    /** The channel in view */
    selectedId: string | null;
    /** The voice channel you're connected to */
    voiceId: string | null;
    /** That channel is a server voice channel (not a DM call, not a Stage) */
    isGuildVoice: boolean;
}

// Folded only while your own server call is the page: open a text channel and the
// list is back, return to the call and it folds again.
export function foldActive(s: FoldState): boolean {
    return s.enabled && s.folded && s.voiceId !== null && s.selectedId === s.voiceId && s.isGuildVoice;
}

/** The strip's width: the server list's 72, less 8 either side */
export const STRIP_WIDTH = 56;
/** Its distance from the window's bottom: Discord's own panel spacing */
export const STRIP_BOTTOM = 8;

// Folded, Discord's user section stands in the server list as a strip (approved
// mockup, 9 Nov 2026), centred in it whatever its width.
export function stripGeometry(railWidth: number): { left: number; width: number; } {
    return { left: Math.round((railWidth - STRIP_WIDTH) / 2), width: STRIP_WIDTH };
}

export interface FoldMeasure {
    /** The user section's computed position */
    position: string;
    left: number;
    width: number;
    bottom: number;
    /** The sidebar's width once folded */
    sidebarWidth: number;
}

export interface FoldExpect {
    left: number;
    width: number;
    bottom: number;
    /** The server list's width, which the sidebar should narrow to */
    rail: number;
}

const SLACK = 4;

// Whether a fold did what it should: the section fixed as the strip, and the sidebar
// narrowed to the server list. Anything else is undone at once
// (runtime/channelFoldRuntime.ts), so a change in Discord's layout can never leave
// the section spread over the call.
export function foldCheck(m: FoldMeasure, e: FoldExpect): { ok: boolean; reason?: string; } {
    const problems: string[] = [];
    if (m.position !== "fixed") problems.push(`position ${m.position}, expected fixed`);
    if (Math.abs(m.left - e.left) > SLACK) problems.push(`left ${Math.round(m.left)}, expected ${e.left}`);
    if (Math.abs(m.width - e.width) > SLACK) problems.push(`width ${Math.round(m.width)}, expected ${e.width}`);
    if (Math.abs(m.bottom - e.bottom) > SLACK) problems.push(`bottom ${Math.round(m.bottom)}, expected ${e.bottom}`);
    if (Math.abs(m.sidebarWidth - e.rail) > SLACK) problems.push(`sidebar ${Math.round(m.sidebarWidth)}, expected ${e.rail}`);
    return problems.length ? { ok: false, reason: problems.join("; ") } : { ok: true };
}
