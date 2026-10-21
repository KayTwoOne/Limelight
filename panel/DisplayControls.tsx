/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Display settings (spec 6.7, tokens.md 5.10, 5.11): grid zoom, tile corners,
// tile spacing and the two switches. Every control writes config.display through
// updateConfig, so the call grid follows at once and the change is saved a moment
// later. The Display tab and the plugin's settings page (spec 9.6) both render
// DisplayControls, so there is one set of controls and one source of truth: the
// config store. The settings page adds Reset all Limelight themes.

import { Alerts, Button, React } from "@webpack/common";

import { type Corners, defaultConfig, type Spacing } from "../logic/config";
import { flushConfig, updateConfig, useLimelightConfig } from "../store/configStore";
import { Segmented, type SegmentOption } from "./Segmented";
import { SwitchRow } from "./SwitchRow";

const CORNER_OPTIONS: ReadonlyArray<SegmentOption<Corners>> = [
    { id: "sharp", label: "Sharp" },
    { id: "discord", label: "Discord" },
    { id: "soft", label: "Soft" }
];

const SPACING_OPTIONS: ReadonlyArray<SegmentOption<Spacing>> = [
    { id: "tight", label: "Tight" },
    { id: "normal", label: "Normal" },
    { id: "airy", label: "Airy" }
];

export function DisplayControls() {
    const { display } = useLimelightConfig();
    const zoomLabel = React.useId();

    return (
        <>
            <label className="vc-limelight-zoom">
                <span className="vc-limelight-zoom-head">
                    <span id={zoomLabel} className="vc-limelight-section-label">Grid zoom</span>
                    <span className="vc-limelight-zoom-value">{display.gridZoom}%</span>
                </span>
                <input
                    type="range"
                    min={50}
                    max={150}
                    step={5}
                    value={display.gridZoom}
                    aria-labelledby={zoomLabel}
                    aria-valuetext={`${display.gridZoom} percent`}
                    onChange={event => {
                        const next = event.currentTarget.valueAsNumber;
                        updateConfig(draft => { draft.display.gridZoom = next; });
                    }}
                />
            </label>

            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Tile corners</span>
                <Segmented
                    label="Tile corners"
                    options={CORNER_OPTIONS}
                    value={display.corners}
                    onChange={next => updateConfig(draft => { draft.display.corners = next; })}
                />
            </div>

            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Tile spacing</span>
                <Segmented
                    label="Tile spacing"
                    options={SPACING_OPTIONS}
                    value={display.spacing}
                    onChange={next => updateConfig(draft => { draft.display.spacing = next; })}
                />
            </div>

            <div className="vc-limelight-switches">
                <SwitchRow
                    label="Disable all user themes"
                    hint="One calm dark grey for every tile"
                    checked={display.disableUserThemes}
                    onChange={next => updateConfig(draft => { draft.display.disableUserThemes = next; })}
                />
                <SwitchRow
                    label="Auto maximise livestream upon joining"
                    hint="Watch Stream goes straight to fullscreen"
                    checked={display.autoMaximise}
                    onChange={next => updateConfig(draft => { draft.display.autoMaximise = next; })}
                />
            </div>
        </>
    );
}

// Replaces the whole config with the defaults, keeping nothing. The store runs
// the result through the allowlist like every other edit. The image tidy that
// follows every config change then finds no theme pointing at any image and
// deletes them all (imageStore.ts); saving now, not after the usual delay, means
// the saved copy it also checks is already the reset one.
function resetEverything(): void {
    updateConfig(draft => { Object.assign(draft, defaultConfig()); });
    void flushConfig();
}

function confirmReset(): void {
    Alerts.show({
        title: "Reset all Limelight themes?",
        body: "Every person's theme, Everyone, the chat look and your Display settings go back to Discord's own, and the background images Limelight stored are deleted. This cannot be undone.",
        confirmColor: Button.Colors.RED,
        confirmText: "Reset",
        cancelText: "Cancel",
        onConfirm: resetEverything
    });
}

// The one setting on the plugin's settings page (index.tsx). The popover's own
// classes give it the same surface, so the controls look as they do in the call.
export function SettingsPage() {
    return (
        <div className="vc-limelight-popover vc-limelight-settings">
            <div className="vc-limelight-settings-body">
                <DisplayControls />
                <div className="vc-limelight-field">
                    <span className="vc-limelight-section-label">Reset</span>
                    <p className="vc-limelight-caption">
                        Puts every theme, the chat look and the Display settings back to Discord's own, and deletes the saved images.
                    </p>
                    <button type="button" className="vc-limelight-outline vc-limelight-danger" onClick={confirmReset}>
                        Reset all Limelight themes
                    </button>
                </div>
            </div>
        </div>
    );
}
