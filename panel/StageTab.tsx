/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Stage tab: the background of a call screen. In the call, what sits behind
// every tile (Discord's own, the Everyone theme's stage, or a background of its
// own), the « » button that folds the channel list away, and how Discord's user
// section is drawn while it floats over the stage. Before you join is the
// pre-call screen's look, which was its own tab before 1.2. Every control writes
// config through updateConfig; the stylesheet and the fold follow at once.

import { React } from "@webpack/common";
import { type CSSProperties } from "react";

import { type StageLook } from "../logic/config";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { useImageUrl } from "../store/imageStore";
import { PreCallTab } from "./PreCallTab";
import { Segmented, type SegmentOption } from "./Segmented";
import { SwitchRow } from "./SwitchRow";
import { BackgroundEditor, previewBackground, PROFILE_FALLBACK } from "./ThemeEditor";

export type StageView = "call" | "before";

const VIEW_OPTIONS: ReadonlyArray<SegmentOption<StageView>> = [
    { id: "call", label: "In the call" },
    { id: "before", label: "Before you join" }
];

const LOOK_OPTIONS: ReadonlyArray<SegmentOption<StageLook>> = [
    { id: "discord", label: "Discord" },
    { id: "everyone", label: "Everyone" },
    { id: "own", label: "Own" }
];

const LOOK_HINT: Record<StageLook, string> = {
    discord: "Discord's own black behind the tiles.",
    everyone: "A stage made from the Everyone theme: its colour and a soft spotlight.",
    own: "A background of its own, behind every tile."
};

function InTheCall() {
    const { stage, everyone } = useLimelightConfig();
    const ownUrl = useImageUrl(stage.own.type === "image" ? stage.own.imageId : undefined);
    const tileUrl = useImageUrl(everyone.background.type === "image" ? everyone.background.imageId : undefined);

    return (
        <>
            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Behind the tiles</span>
                <Segmented
                    label="Behind the tiles"
                    options={LOOK_OPTIONS}
                    value={stage.look}
                    onChange={next => updateConfig(draft => { draft.stage.look = next; })}
                />
                <p className="vc-limelight-caption">{LOOK_HINT[stage.look]}</p>
            </div>

            {stage.look === "own" && (
                <>
                    <div className="vc-limelight-preview" aria-hidden="true" style={{ background: previewBackground(stage.own, ownUrl, PROFILE_FALLBACK) }}>
                        <span className="vc-limelight-preview-chip">Stage background</span>
                        {/* Two tiles in the Everyone theme and a chip, so the stage is judged against what sits on it */}
                        <span className="vc-limelight-stage-tiles" style={{ "--ll-tile": previewBackground(everyone.background, tileUrl, PROFILE_FALLBACK) } as CSSProperties}>
                            <span /><span /><span />
                        </span>
                    </div>
                    <BackgroundEditor
                        background={stage.own}
                        allowProfile={false}
                        onChange={next => updateConfig(draft => { draft.stage.own = next; })}
                    />
                </>
            )}

            <div className="vc-limelight-switches">
                <SwitchRow
                    label="Channel list button"
                    hint="« and » in the call's controls, bottom left"
                    tag="New"
                    checked={stage.foldButton}
                    // Off brings the channel list back, so it can't stay folded
                    // with no button to unfold it
                    onChange={next => updateConfig(draft => {
                        draft.stage.foldButton = next;
                        if (!next) draft.stage.folded = false;
                    })}
                />
            </div>
        </>
    );
}

export function StageTab({ initialView = "call" }: { initialView?: StageView; }) {
    const [view, setView] = React.useState<StageView>(initialView);

    return (
        <>
            <Segmented label="Stage" options={VIEW_OPTIONS} value={view} onChange={next => setView(next)} />
            {view === "call" ? <InTheCall /> : <PreCallTab />}
        </>
    );
}
