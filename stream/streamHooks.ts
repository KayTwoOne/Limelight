/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// What a stream changes about a call: one tile per person, when each person went
// live or stopped (so a tile plays the morph once), whether Watch Stream stays in
// the grid, and when Discord's LIVE badge shows on the maximised tile. Every
// function here is called by a patch through guard() in index.tsx, which returns
// Discord's own value if one of them throws.

import { SelectedChannelStore } from "@webpack/common";

import { foldParticipants, type ParticipantLike, ParticipantType, streamOwners } from "../logic/fold";
import { createLiveTracker, recentlyEnded, recentlyStarted, resetLive, updateLive } from "../logic/live";
import { getConfig } from "../store/configStore";

const tracker = createLiveTracker();
let trackedChannel: string | null = null;

// One entry of Discord's allActiveStreams: the streams the viewer has opened.
interface ActiveStream {
    guildId?: string | null;
    channelId?: string;
    ownerId?: string;
    state?: string;
}

// Updates who is live from the unfiltered list, then folds the filtered one.
// The tracker starts again whenever the voice channel changes, so joining a call
// where people are already streaming does not play a morph for each of them.
export function foldWithTracking<T extends ParticipantLike>(filtered: readonly T[], all: unknown): T[] {
    const channelId = SelectedChannelStore.getVoiceChannelId() ?? null;
    if (channelId !== trackedChannel) {
        resetLive(tracker);
        trackedChannel = channelId;
    }
    updateLive(tracker, streamOwners(Array.isArray(all) ? all as ParticipantLike[] : []), Date.now());
    return foldParticipants(filtered);
}

export function startedRecently(ownerId: string): boolean {
    return recentlyStarted(tracker, ownerId, Date.now());
}

export function endedRecently(ownerId: string): boolean {
    return recentlyEnded(tracker, ownerId, Date.now());
}

export function resetStreams(): void {
    resetLive(tracker);
    trackedChannel = null;
}

// Whether Watch Stream should keep the grid: with auto maximise off and nothing
// maximised, Discord's own "select this tile" step is skipped (noFocus).
export function skipsFocus(selectedParticipant: unknown): boolean {
    return selectedParticipant == null && !getConfig().display.autoMaximise;
}

// Discord's stream key for an entry of allActiveStreams: the id its STREAM
// participant carries (anchors.md, participant model).
function streamKeyOf(stream: ActiveStream): string | null {
    const { guildId, channelId, ownerId } = stream;
    if (!channelId || !ownerId) return null;
    return guildId ? `guild:${guildId}:${channelId}:${ownerId}` : `call:${channelId}:${ownerId}`;
}

function isWatched(participantId: unknown, activeStreams: unknown): boolean {
    if (typeof participantId !== "string" || !Array.isArray(activeStreams)) return false;
    return (activeStreams as ActiveStream[]).some(stream => stream.state !== "ENDED" && streamKeyOf(stream) === participantId);
}

// Whether Discord's trailing select-or-toggle still runs for a click. It is
// skipped only for the first click on a stream that is not yet watched, in the
// grid, with auto maximise off: that click starts watching and nothing else.
// activeStreams is the list from before the click, so it still lacks the stream
// the click just opened; a second click finds it and toggles the selection.
export function togglesSelection(participant: unknown, activeStreams: unknown, selectedParticipant: unknown): boolean {
    if (getConfig().display.autoMaximise || selectedParticipant != null) return true;
    const { type, id } = (participant ?? {}) as { type?: number; id?: unknown; };
    const isStream = type === ParticipantType.STREAM || type === ParticipantType.HIDDEN_STREAM;
    return !isStream || isWatched(id, activeStreams);
}

// Discord's gate for the LIVE and quality badge is "the tile is maximised",
// which hides it. Here it hides it only while the pointer is idle too, so the
// badge shows while the pointer is over the call (spec 5.5).
export function badgeGate(focused: unknown, idle: unknown): boolean {
    return Boolean(focused) && Boolean(idle);
}
