/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The preset bar above a theme editor (a person's, or Everyone): the preset
// dropdown, Save as preset, and the manage list behind the dropdown's last item.
// Applying a preset copies its theme (logic/presets.ts), so editing the preset
// later never changes anyone it was given to.

import { Alerts, React } from "@webpack/common";
import { type KeyboardEvent } from "react";

import { MAX_PRESETS, type Preset, type Theme } from "../logic/config";
import { addPreset, copyTheme, deletePreset, matchingPreset, type NameProblem, presetNameProblem, renamePreset } from "../logic/presets";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { useImageUrl } from "../store/imageStore";
import { Select, type SelectOption } from "./Select";
import { previewBackground, PROFILE_FALLBACK } from "./ThemeEditor";

const PROBLEM: Record<NameProblem, (name: string) => string> = {
    empty: () => "Give it a name.",
    long: () => "Names are up to 32 characters.",
    taken: name => `You already have a preset called ${name.trim()}.`
};

// A preset's colours as a small round swatch, image included
export function PresetSwatch({ theme }: { theme: Theme; }) {
    const url = useImageUrl(theme.background.type === "image" ? theme.background.imageId : undefined);
    return <span className="vc-limelight-preset-swatch" aria-hidden="true" style={{ background: previewBackground(theme.background, url, PROFILE_FALLBACK) }} />;
}

export function presetOptions(presets: readonly Preset[]): SelectOption[] {
    return presets.map(p => ({ id: p.id, label: p.name, swatch: <PresetSwatch theme={p.theme} /> }));
}

// Enter and Escape in a name field: save or cancel, and keep Escape from closing
// the panel.
function nameKeys(onEnter: () => void, onEscape: () => void) {
    return (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") onEnter();
        else if (event.key === "Escape") onEscape();
        else return;
        event.preventDefault();
        event.stopPropagation();
    };
}

interface PresetBarProps {
    theme: Theme;
    onApply(theme: Theme): void;
}

export function PresetBar({ theme, onApply }: PresetBarProps) {
    const { presets } = useLimelightConfig();
    const [mode, setMode] = React.useState<"idle" | "saving" | "managing">("idle");
    const [name, setName] = React.useState("");
    const [tried, setTried] = React.useState(false);
    const current = matchingPreset(theme, presets);
    const full = presets.length >= MAX_PRESETS;
    const problem = presetNameProblem(name, presets);

    function save(): void {
        setTried(true);
        if (problem !== null || full) return;
        updateConfig(draft => { draft.presets = addPreset(draft.presets, name, theme); });
        setMode("idle");
        setName("");
        setTried(false);
    }

    function cancel(): void {
        setMode("idle");
        setName("");
        setTried(false);
    }

    if (mode === "managing") return <ManagePresets onDone={() => setMode("idle")} />;

    return (
        <div className="vc-limelight-field">
            <span className="vc-limelight-section-label">{mode === "saving" ? "Save as preset" : "Preset"}</span>
            {mode === "saving" ? (
                <>
                    <div className="vc-limelight-preset-save">
                        <input
                            className="vc-limelight-input"
                            value={name}
                            maxLength={40}
                            autoFocus
                            aria-label="Preset name"
                            aria-invalid={tried && problem !== null}
                            placeholder="Name this preset"
                            onChange={event => setName(event.currentTarget.value)}
                            onKeyDown={nameKeys(save, cancel)}
                        />
                        <button type="button" className="vc-limelight-primary" onClick={save}>Save</button>
                        <button type="button" className="vc-limelight-outline" onClick={cancel}>Cancel</button>
                    </div>
                    <p className="vc-limelight-caption" role={tried && problem ? "alert" : undefined}>
                        {tried && problem ? PROBLEM[problem](name) : "Saves the background, spotlight and ring as they are now. Images come along too."}
                    </p>
                </>
            ) : (
                <div className="vc-limelight-preset-bar">
                    <Select
                        label="Preset"
                        placeholder={presets.length ? "Choose a preset" : "No presets yet"}
                        value={current?.id ?? null}
                        options={presetOptions(presets)}
                        disabled={presets.length === 0}
                        onChange={id => {
                            const preset = presets.find(p => p.id === id);
                            if (preset) onApply(copyTheme(preset.theme));
                        }}
                        footer={presets.length ? { label: "Rename or delete presets", onSelect: () => setMode("managing") } : undefined}
                    />
                    <button
                        type="button"
                        className="vc-limelight-outline vc-limelight-preset-add"
                        aria-disabled={full || undefined}
                        title={full ? "You have 20 presets, the most there can be" : undefined}
                        onClick={() => { if (!full) setMode("saving"); }}
                    >
                        Save as preset
                    </button>
                </div>
            )}
        </div>
    );
}

// Every preset with Rename and Delete. Deleting asks first, and leaves everyone's
// theme as it is.
function ManagePresets({ onDone }: { onDone(): void; }) {
    const { presets } = useLimelightConfig();
    const [editing, setEditing] = React.useState<string | null>(null);
    const [name, setName] = React.useState("");
    const [tried, setTried] = React.useState(false);
    const problem = editing ? presetNameProblem(name, presets, editing) : null;

    function startRename(preset: Preset): void {
        setEditing(preset.id);
        setName(preset.name);
        setTried(false);
    }

    function rename(): void {
        setTried(true);
        if (!editing || problem !== null) return;
        const id = editing;
        updateConfig(draft => { draft.presets = renamePreset(draft.presets, id, name); });
        setEditing(null);
    }

    function confirmDelete(preset: Preset): void {
        Alerts.show({
            title: `Delete ${preset.name}?`,
            body: "Anyone you gave it to keeps their theme as it is.",
            confirmColor: "danger",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: () => updateConfig(draft => { draft.presets = deletePreset(draft.presets, preset.id); })
        });
    }

    React.useEffect(() => {
        if (presets.length === 0) onDone();
    }, [presets.length, onDone]);

    return (
        <div className="vc-limelight-field">
            <span className="vc-limelight-section-label">Your presets / {presets.length}</span>
            <ul className="vc-limelight-preset-list">
                {presets.map(preset => (
                    <li key={preset.id} className="vc-limelight-preset-item">
                        <PresetSwatch theme={preset.theme} />
                        {editing === preset.id ? (
                            <input
                                className="vc-limelight-input"
                                value={name}
                                maxLength={40}
                                autoFocus
                                aria-label={`New name for ${preset.name}`}
                                aria-invalid={tried && problem !== null}
                                onChange={event => setName(event.currentTarget.value)}
                                onKeyDown={nameKeys(rename, () => setEditing(null))}
                            />
                        ) : (
                            <span className="vc-limelight-select-text">{preset.name}</span>
                        )}
                        {editing === preset.id ? (
                            <button type="button" className="vc-limelight-primary" onClick={rename}>Save</button>
                        ) : (
                            <>
                                <button type="button" className="vc-limelight-outline" onClick={() => startRename(preset)}>Rename</button>
                                <button type="button" className="vc-limelight-outline vc-limelight-danger" onClick={() => confirmDelete(preset)}>Delete</button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            {editing && tried && problem && <p className="vc-limelight-caption" role="alert">{PROBLEM[problem](name)}</p>}
            <button type="button" className="vc-limelight-outline vc-limelight-preset-done" onClick={onDone}>Done</button>
        </div>
    );
}
