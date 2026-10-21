/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The classes Limelight adds to a tile and to the tile's slot. They are the only
// markers its stylesheets key on: per-person themes, the spotlight, the ring and
// spacing all select `.limelight-tile` or `.limelight-slot`, so a patch that
// failed to apply leaves nothing of Limelight's styling on Discord's tiles. The
// theme itself is never set here: it comes from the generated stylesheet.

import { ApplicationStreamingStore } from "@webpack/common";

import { ParticipantType } from "../logic/fold";
import { endedRecently, startedRecently } from "../stream/streamHooks";

// The ids in `ll-u-<id>` reach CSS selectors, so only digits are accepted.
const DIGITS = /^\d+$/;

// The fields of a participant this file reads (anchors.md, participant model).
interface TileParticipant {
    id?: string;
    type?: number;
    user?: { id?: string; } | null;
}

function classes(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(" ");
}

function ownerOf(participant: TileParticipant | null | undefined): string | null {
    const id = participant?.user?.id;
    return typeof id === "string" && DIGITS.test(id) ? id : null;
}

// The viewer is watching when the store holds a stream for this key that has
// neither ended nor failed (the state names are Discord's own strings).
function isWatching(participant: TileParticipant): boolean {
    if (participant.type !== ParticipantType.STREAM || typeof participant.id !== "string") return false;
    const stream = ApplicationStreamingStore.getActiveStreamForStreamKey(participant.id) as { state?: string; } | null;
    return stream != null && stream.state !== "ENDED" && stream.state !== "FAILED";
}

// Called from the CallTile patch with Discord's class string for the tile and the
// tile's participant. Throws are caught by guard() in the caller.
//
// The morph classes mark the one tile that plays it, for as long as the live
// tracker says the change is recent (logic/live.ts): the new stream tile plays
// the morph in, and the avatar tile that comes back when a stream ends plays it
// out. morph.css animates from them, once, when the tile mounts.
export function tileClasses(original: string, participant: unknown): string {
    const p = (participant ?? null) as TileParticipant | null;
    if (p === null) return classes(original, "limelight-tile");
    const owner = ownerOf(p);
    return classes(
        original,
        "limelight-tile",
        owner && `ll-u-${owner}`,
        p.type === ParticipantType.STREAM && "limelight-live",
        isWatching(p) && "limelight-watching",
        owner && p.type === ParticipantType.STREAM && startedRecently(owner) && "ll-morph-in",
        owner && p.type === ParticipantType.USER && endedRecently(owner) && "ll-morph-out"
    );
}

// The root of a tile's slot, the box Discord's layout sizes.
export function slotClasses(original: string): string {
    return classes(original, "limelight-slot");
}
