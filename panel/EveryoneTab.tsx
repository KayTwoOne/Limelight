/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Everyone tab (spec 6.5, tokens.md 5.6): the theme anyone in a call without
// a theme of their own wears. The same editor as a person's, bound to
// config.everyone, with the same preset bar. Its default (Profile, spotlight off,
// Discord green) is what keeps Discord's own look until something is changed.

import { React } from "@webpack/common";

import { type Theme } from "../logic/config";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { PeopleIcon } from "./panelIcons";
import { PresetBar } from "./PresetBar";
import { ThemeEditor } from "./ThemeEditor";

export function EveryoneTab() {
    const { everyone } = useLimelightConfig();
    // A preset replaces the whole theme, so the editor starts afresh on it
    const [resets, setResets] = React.useState(0);

    function save(next: Theme): void {
        updateConfig(draft => { draft.everyone = next; });
    }

    return (
        <>
            <div className="vc-limelight-identity">
                <span className="vc-limelight-everyone-icon" aria-hidden="true"><PeopleIcon /></span>
                <div className="vc-limelight-identity-text">
                    <span className="vc-limelight-title">Everyone</span>
                    <span className="vc-limelight-caption">Anyone in a call without their own theme</span>
                </div>
            </div>
            <PresetBar theme={everyone} onApply={next => { save(next); setResets(count => count + 1); }} />
            <ThemeEditor key={resets} theme={everyone} onChange={save} profile={null} />
        </>
    );
}
