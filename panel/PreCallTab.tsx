/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Pre-call tab: which look the screen Discord shows before you join a voice
// channel wears (Discord, Follow grid or Own theme) and, for Own theme, its
// background. It is the Chat tab's look section for a second surface. Every
// control writes config.preCall through updateConfig; the stylesheet follows at
// once.

import { type PreCallLook } from "../logic/config";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { useImageUrl } from "../store/imageStore";
import { Segmented, type SegmentOption } from "./Segmented";
import { BackgroundEditor, previewBackground, PROFILE_FALLBACK } from "./ThemeEditor";

const LOOK_OPTIONS: ReadonlyArray<SegmentOption<PreCallLook>> = [
    { id: "discord", label: "Discord" },
    { id: "follow", label: "Follow grid" },
    { id: "own", label: "Own theme" }
];

const LOOK_HINT: Record<PreCallLook, string> = {
    discord: "Discord's own background, as it is now.",
    follow: "Your call's stage, before anyone joins, so joining feels like one place.",
    own: "Its own background. People keep their own tile themes in the preview."
};

export function PreCallTab() {
    const { preCall } = useLimelightConfig();
    const ownUrl = useImageUrl(preCall.own.type === "image" ? preCall.own.imageId : undefined);

    return (
        <>
            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Pre-call screen</span>
                <Segmented
                    label="Pre-call screen"
                    options={LOOK_OPTIONS}
                    value={preCall.look}
                    onChange={next => updateConfig(draft => { draft.preCall.look = next; })}
                />
                <p className="vc-limelight-caption">{LOOK_HINT[preCall.look]}</p>
            </div>

            {preCall.look === "own" && (
                <>
                    <div className="vc-limelight-preview" aria-hidden="true" style={{ background: previewBackground(preCall.own, ownUrl, PROFILE_FALLBACK) }}>
                        <span className="vc-limelight-preview-chip">Pre-call background</span>
                    </div>
                    <BackgroundEditor
                        background={preCall.own}
                        allowProfile={false}
                        onChange={next => updateConfig(draft => { draft.preCall.own = next; })}
                    />
                </>
            )}
        </>
    );
}
