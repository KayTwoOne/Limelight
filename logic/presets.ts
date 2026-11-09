/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Named presets: a saved theme the person can hand out. Applying one copies its
// theme, so editing a preset later never changes anyone it was given to (a test
// look or a slipped save can't overwrite people). Pure: every change returns a
// new array, and a change that would break a rule returns the list unchanged.

import { cleanPresetName, MAX_PRESETS, type Preset, PRESET_NAME_MAX, type Theme } from "./config";

export type NameProblem = "empty" | "long" | "taken";

export function newPresetId(): string {
    let id = "";
    while (id.length < 12) id += Math.random().toString(36).slice(2);
    return id.slice(0, 12);
}

export function copyTheme(theme: Theme): Theme {
    return { ...theme, background: { ...theme.background } };
}

// Why a name can't be used, or null. A rename may keep the name it already has.
export function presetNameProblem(raw: string, presets: readonly Preset[], exceptId?: string): NameProblem | null {
    const name = cleanPresetName(raw);
    if (name.length === 0) return "empty";
    if (name.length > PRESET_NAME_MAX) return "long";
    const key = name.toLocaleLowerCase();
    return presets.some(p => p.id !== exceptId && p.name.toLocaleLowerCase() === key) ? "taken" : null;
}

export function addPreset(presets: readonly Preset[], name: string, theme: Theme, id = newPresetId()): Preset[] {
    if (presets.length >= MAX_PRESETS || presetNameProblem(name, presets) !== null) return presets as Preset[];
    return [...presets, { id, name: cleanPresetName(name), theme: copyTheme(theme) }];
}

export function renamePreset(presets: readonly Preset[], id: string, name: string): Preset[] {
    if (presetNameProblem(name, presets, id) !== null) return presets as Preset[];
    return presets.map(p => (p.id === id ? { ...p, name: cleanPresetName(name) } : p));
}

export function deletePreset(presets: readonly Preset[], id: string): Preset[] {
    return presets.filter(p => p.id !== id);
}

export function themesEqual(a: Theme, b: Theme): boolean {
    const x = a.background;
    const y = b.background;
    return a.spotlight === b.spotlight && a.ring === b.ring
        && x.type === y.type && x.from === y.from && x.to === y.to && x.angle === y.angle && x.imageId === y.imageId;
}

// The preset a theme still equals, for naming it on a person's row
export function matchingPreset(theme: Theme, presets: readonly Preset[]): Preset | null {
    return presets.find(p => themesEqual(p.theme, theme)) ?? null;
}
