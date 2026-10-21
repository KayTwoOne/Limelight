/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The call chat's channel picker, as plain data: which of a server's channels it
// lists, in what order, and what each row signals. Pure: no imports, so the
// rules are tested in node. The component feeds it facts read from Discord's
// stores and draws what comes back.

/** Text (0) and announcement (5) channels: the server channels that are a chat */
export const PICKABLE_TYPES: ReadonlySet<number> = new Set([0, 5]);

/** Discord's UnreadSetting: ALL_MESSAGES. UNSET (0) and ONLY_MENTIONS (2) show no dot. */
const ALL_MESSAGES = 1;

export interface ChannelFacts {
    id: string;
    name: string;
    type: number;
    position: number;
    parentId: string | null;
}

export interface CategoryFacts {
    id: string;
    name: string;
    position: number;
}

/** The questions the channel list asks of each channel, answered from Discord's stores */
export interface PickerRules {
    canView(channel: ChannelFacts): boolean;
    /** The server uses Channels & Roles, so only channels on the channel list show */
    optInEnabled: boolean;
    isOptedIn(channel: ChannelFacts): boolean;
    /** The server's "Hide muted channels" */
    hideMuted: boolean;
    isMuted(channel: ChannelFacts): boolean;
}

export interface PickerRow {
    id: string;
    name: string;
    type: number;
    muted: boolean;
}

export interface PickerSection {
    /** null for the channels above the first category */
    category: CategoryFacts | null;
    rows: PickerRow[];
}

// Discord sorts by position and then by id, so two channels at one position
// keep a stable order
function byPosition(a: { position: number; id: string; }, b: { position: number; id: string; }): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Whether the sidebar would list it: a chat, readable, on the channel list,
// and not hidden as muted
function listed(channel: ChannelFacts, rules: PickerRules): boolean {
    if (!PICKABLE_TYPES.has(channel.type)) return false;
    if (!rules.canView(channel)) return false;
    if (rules.optInEnabled && !rules.isOptedIn(channel)) return false;
    if (rules.hideMuted && rules.isMuted(channel)) return false;
    return true;
}

/**
 * The server's chat channels in sidebar order: those with no category first,
 * then each category by position, with its channels by position. A category
 * with nothing left in it is not shown.
 */
export function buildSections(channels: readonly ChannelFacts[], categories: readonly CategoryFacts[], rules: PickerRules): PickerSection[] {
    const byParent = new Map<string | null, ChannelFacts[]>();
    for (const channel of channels) {
        if (!listed(channel, rules)) continue;
        const key = channel.parentId && categories.some(c => c.id === channel.parentId) ? channel.parentId : null;
        const group = byParent.get(key) ?? [];
        group.push(channel);
        byParent.set(key, group);
    }

    const toRows = (group: ChannelFacts[] | undefined): PickerRow[] =>
        (group ?? []).slice().sort(byPosition).map(c => ({ id: c.id, name: c.name, type: c.type, muted: rules.isMuted(c) }));

    const sections: PickerSection[] = [];
    const loose = toRows(byParent.get(null));
    if (loose.length) sections.push({ category: null, rows: loose });
    for (const category of categories.slice().sort(byPosition)) {
        const rows = toRows(byParent.get(category.id));
        if (rows.length) sections.push({ category, rows });
    }
    return sections;
}

export type RowSignal = { kind: "mentions"; count: number; } | { kind: "unread"; } | { kind: "none"; };

/**
 * What a row shows, by the channel's own notification setting, as the sidebar
 * does: a mention badge whenever there are mentions (muted or not); otherwise a
 * dot only for unread messages in a channel set to All messages and not muted.
 */
export function rowSignal(state: { hasUnread: boolean; mentions: number; muted: boolean; unreadSetting: number; }): RowSignal {
    if (state.mentions > 0) return { kind: "mentions", count: state.mentions };
    if (state.hasUnread && !state.muted && state.unreadSetting === ALL_MESSAGES) return { kind: "unread" };
    return { kind: "none" };
}

/** Only the rows whose name holds the query, ignoring case and outer spaces */
export function filterSections(sections: readonly PickerSection[], query: string): PickerSection[] {
    const q = query.trim().toLowerCase();
    if (!q) return sections.slice();
    return sections
        .map(s => ({ category: s.category, rows: s.rows.filter(r => r.name.toLowerCase().includes(q)) }))
        .filter(s => s.rows.length > 0);
}

/** The rows in display order, for keyboard movement */
export function flatRows(sections: readonly PickerSection[]): PickerRow[] {
    return sections.flatMap(s => s.rows);
}

/** The next focused row, wrapping at both ends; -1 when there are no rows */
export function stepFocus(index: number, delta: number, length: number): number {
    if (length <= 0) return -1;
    if (index < 0 || index >= length) return delta >= 0 ? 0 : length - 1;
    return (index + delta + length) % length;
}

/**
 * Whether a channel may be shown in the call chat of a voice channel in the
 * server `voiceGuildId`: the same server, and listed by the same rules as the
 * picker. Used to accept a pick, a channel link, and to keep a pick valid.
 */
export function isPickable(channel: ChannelFacts & { guildId: string | null; }, voiceGuildId: string | null, rules: PickerRules): boolean {
    if (voiceGuildId == null || channel.guildId !== voiceGuildId) return false;
    return listed(channel, rules);
}

const inputTypeCache = new WeakMap<object, WeakMap<object, object>>();

/**
 * The chat input settings for a text channel shown in the call chat: Discord's
 * sidebar settings, with a normal channel's gift, GIF and sticker buttons and
 * draft autosave. Made once per pair, so React sees one stable object. When
 * Discord's normal settings cannot be read, the sidebar's own object is used.
 */
export function textChannelInputType(sidebar: object, normal: object | undefined): object {
    if (normal == null || typeof normal !== "object") return sidebar;
    let forSidebar = inputTypeCache.get(sidebar);
    const cached = forSidebar?.get(normal);
    if (cached) return cached;

    const s = sidebar as Record<string, any>;
    const n = normal as Record<string, any>;
    const merged: Record<string, unknown> = { ...s };
    if (n.gifs?.button) merged.gifs = { ...s.gifs, button: true };
    if (n.stickers?.button) merged.stickers = { ...s.stickers, button: true };
    if (n.gifts?.button) merged.gifts = { ...s.gifts, button: true };
    if (n.drafts?.autoSave) merged.drafts = { ...s.drafts, autoSave: true };

    if (!forSidebar) {
        forSidebar = new WeakMap();
        inputTypeCache.set(sidebar, forSidebar);
    }
    forSidebar.set(normal, merged);
    return merged;
}
