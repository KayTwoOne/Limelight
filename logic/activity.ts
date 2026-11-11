/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// What a name pill or a chip shows of someone's activity: a game's name and icon,
// or, for Spotify (Tier 4), the track playing and its album art. Pure.

export interface ActivityLike {
    type: number;
    name?: string;
    details?: string;
    application_id?: string;
    assets?: { large_image?: string; };
}

export interface ActivityFace {
    /** The game's name, or the track's */
    name: string;
    applicationId: string | null;
    /** The album art, for Spotify */
    art: string | null;
}

const PLAYING = 0;
const LISTENING = 2;
// Discord stores Spotify's album art as spotify:<image id> and loads it from
// Spotify's image host, as its own activity card does. The id is checked before it
// becomes part of a URL, since presences come from other people.
const SPOTIFY_ART = /^spotify:([A-Za-z0-9]+)$/;

export function activityFace(a: ActivityLike | undefined): ActivityFace | null {
    if (!a || typeof a.name !== "string" || a.name.length === 0) return null;
    const art = a.type === LISTENING ? SPOTIFY_ART.exec(a.assets?.large_image ?? "")?.[1] : undefined;
    if (art) return { name: typeof a.details === "string" && a.details.length > 0 ? a.details : a.name, applicationId: null, art: `https://i.scdn.co/image/${art}` };
    return { name: a.name, applicationId: a.application_id ?? null, art: null };
}

// A person's pill shows the game they're playing, or else the song on their Spotify
export function pillActivity(activities: readonly ActivityLike[]): ActivityFace | null {
    const game = activities.find(a => a.type === PLAYING && typeof a.name === "string" && a.name.length > 0);
    return activityFace(game ?? activities.find(a => a.type === LISTENING && SPOTIFY_ART.test(a.assets?.large_image ?? "")));
}
