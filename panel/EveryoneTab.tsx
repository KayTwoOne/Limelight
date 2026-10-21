/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Everyone tab (spec 6.5, tokens.md 5.6): the theme anyone in a call without
// a theme of their own wears. The same editor as a person's, bound to
// config.everyone. Its default (Profile, spotlight off, Discord green) is what
// keeps Discord's own look until something is changed.

import { type Theme } from "../logic/config";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { PeopleIcon } from "./panelIcons";
import { ThemeEditor } from "./ThemeEditor";

export function EveryoneTab() {
    const { everyone } = useLimelightConfig();

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
            <ThemeEditor theme={everyone} onChange={save} profile={null} />
        </>
    );
}
