/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Limelight's stored configuration: types, defaults and the sanitiser that
// rebuilds every load from an allowlist. Pure: imports only plugin/logic.

import { normaliseHex } from "./colour";

export type BackgroundType = "profile" | "solid" | "gradient" | "image";
export type SpotlightLevel = "off" | "soft" | "bright";
export type ChatLook = "discord" | "follow" | "own";
// The screen Discord shows before you join a voice channel takes the same three
// looks as chat: Discord's own, the Everyone stage, or a background of its own.
export type PreCallLook = ChatLook;
export type ChatJoin = "seamless" | "tile" | "line";
export type Corners = "sharp" | "discord" | "soft";
export type Spacing = "tight" | "normal" | "airy";

export interface Background {
    type: BackgroundType;
    from: string;
    to: string;
    angle: number;
    imageId?: string;
}

export interface Theme {
    background: Background;
    spotlight: SpotlightLevel;
    ring: string;
}

export interface ChatSettings {
    look: ChatLook;
    join: ChatJoin;
    themeDots: boolean;
    /** The call chat's title opens a picker of the server's text channels */
    channelPicker: boolean;
    own: Background;
}

export interface PreCallSettings {
    look: PreCallLook;
    own: Background;
}

export interface DisplaySettings {
    gridZoom: number;
    corners: Corners;
    spacing: Spacing;
    disableUserThemes: boolean;
    autoMaximise: boolean;
}

export interface LimelightConfig {
    version: 1;
    everyone: Theme;
    people: Record<string, Theme>;
    chat: ChatSettings;
    preCall: PreCallSettings;
    display: DisplaySettings;
}

export const DISCORD_GREEN = "#23a55a";
export const PRESET_GREY = "#2b2d31";
export const LIME = "#d8f35a";
export const MAX_PEOPLE = 500;

const SNOWFLAKE = /^\d{15,21}$/;
const IMAGE_ID = /^[a-z0-9]{8,32}$/;

export function defaultTheme(): Theme {
    return {
        background: { type: "profile", from: "#0e4d49", to: "#081619", angle: 155 },
        spotlight: "off",
        ring: DISCORD_GREEN
    };
}

export function defaultConfig(): LimelightConfig {
    return {
        version: 1,
        everyone: defaultTheme(),
        people: {},
        chat: {
            look: "discord",
            join: "seamless",
            themeDots: true,
            channelPicker: true,
            own: { type: "gradient", from: "#1d4e89", to: "#0b1a33", angle: 160 }
        },
        preCall: {
            look: "discord",
            own: { type: "gradient", from: "#0f2b24", to: "#13453a", angle: 160 }
        },
        display: { gridZoom: 100, corners: "discord", spacing: "normal", disableUserThemes: false, autoMaximise: false }
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function hexOr(value: unknown, fallback: string): string {
    return normaliseHex(value) ?? fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function steppedIn(value: unknown, min: number, max: number, step: number, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value / step) * step));
}

export function sanitiseBackground(raw: unknown, fallback: Background, allowProfile: boolean): Background {
    const r = isRecord(raw) ? raw : {};
    const types: readonly BackgroundType[] = allowProfile
        ? ["profile", "solid", "gradient", "image"]
        : ["solid", "gradient", "image"];
    const out: Background = {
        type: pick(r.type, types, fallback.type),
        from: hexOr(r.from, fallback.from),
        to: hexOr(r.to, fallback.to),
        angle: steppedIn(r.angle, 0, 360, 5, fallback.angle)
    };
    // A chosen image stays on the background whatever type it shows, so clicking
    // another type and back finds it again. Only Remove clears it. An Image
    // background without a valid id has nothing to show and falls back.
    const hasImage = typeof r.imageId === "string" && IMAGE_ID.test(r.imageId);
    if (hasImage) out.imageId = r.imageId as string;
    else if (out.type === "image") out.type = allowProfile ? "profile" : "gradient";
    return out;
}

export function sanitiseTheme(raw: unknown, fallback: Theme = defaultTheme()): Theme {
    const r = isRecord(raw) ? raw : {};
    return {
        background: sanitiseBackground(r.background, fallback.background, true),
        spotlight: pick(r.spotlight, ["off", "soft", "bright"] as const, fallback.spotlight),
        ring: hexOr(r.ring, fallback.ring)
    };
}

export function sanitiseConfig(raw: unknown): LimelightConfig {
    const d = defaultConfig();
    const r = isRecord(raw) ? raw : {};
    const chat = isRecord(r.chat) ? r.chat : {};
    const preCall = isRecord(r.preCall) ? r.preCall : {};
    const display = isRecord(r.display) ? r.display : {};

    const people: Record<string, Theme> = {};
    if (isRecord(r.people)) {
        let count = 0;
        for (const id of Object.keys(r.people)) {
            if (count >= MAX_PEOPLE) break;
            if (!SNOWFLAKE.test(id)) continue;
            people[id] = sanitiseTheme(r.people[id]);
            count++;
        }
    }

    return {
        version: 1,
        everyone: sanitiseTheme(r.everyone, d.everyone),
        people,
        chat: {
            look: pick(chat.look, ["discord", "follow", "own"] as const, d.chat.look),
            join: pick(chat.join, ["seamless", "tile", "line"] as const, d.chat.join),
            themeDots: boolOr(chat.themeDots, d.chat.themeDots),
            channelPicker: boolOr(chat.channelPicker, d.chat.channelPicker),
            own: sanitiseBackground(chat.own, d.chat.own, false)
        },
        // A config saved before the pre-call screen existed has no preCall and
        // takes the default, which is Discord's own look.
        preCall: {
            look: pick(preCall.look, ["discord", "follow", "own"] as const, d.preCall.look),
            own: sanitiseBackground(preCall.own, d.preCall.own, false)
        },
        display: {
            gridZoom: steppedIn(display.gridZoom, 50, 150, 5, d.display.gridZoom),
            corners: pick(display.corners, ["sharp", "discord", "soft"] as const, d.display.corners),
            spacing: pick(display.spacing, ["tight", "normal", "airy"] as const, d.display.spacing),
            disableUserThemes: boolOr(display.disableUserThemes, d.display.disableUserThemes),
            autoMaximise: boolOr(display.autoMaximise, d.display.autoMaximise)
        }
    };
}
