/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Chat tab (spec 8, tokens.md 5.8, 5.14, 7): which look the call's chat wears
// (Discord, Follow grid or Own theme), how it joins the grid, the theme dots, and,
// for Own theme, its background. Every control writes config.chat through
// updateConfig; the stylesheet and the dots follow at once.

import { type ChatJoin, type ChatLook } from "../logic/config";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { useImageUrl } from "../store/imageStore";
import { Segmented, type SegmentOption } from "./Segmented";
import { SwitchRow } from "./SwitchRow";
import { BackgroundEditor, previewBackground, PROFILE_FALLBACK } from "./ThemeEditor";

const LOOK_OPTIONS: ReadonlyArray<SegmentOption<ChatLook>> = [
    { id: "discord", label: "Discord" },
    { id: "follow", label: "Follow grid" },
    { id: "own", label: "Own theme" }
];

const JOIN_OPTIONS: ReadonlyArray<SegmentOption<ChatJoin>> = [
    { id: "seamless", label: "Seamless" },
    { id: "tile", label: "As a tile" },
    { id: "line", label: "Line" }
];

const LOOK_HINT: Record<ChatLook, string> = {
    discord: "Exactly as Discord shows it, untouched.",
    follow: "Shares the grid backdrop and its spotlight, so chat and call read as one room.",
    own: "A background of its own, still joined to the grid."
};

export function ChatTab() {
    const { chat } = useLimelightConfig();
    const ownUrl = useImageUrl(chat.own.type === "image" ? chat.own.imageId : undefined);
    const joinDisabled = chat.look === "discord";

    return (
        <>
            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Chat panel</span>
                <Segmented
                    label="Chat panel"
                    options={LOOK_OPTIONS}
                    value={chat.look}
                    onChange={next => updateConfig(draft => { draft.chat.look = next; })}
                />
                <p className="vc-limelight-caption">{LOOK_HINT[chat.look]}</p>
            </div>

            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Join with the grid</span>
                <Segmented
                    label="Join with the grid"
                    options={JOIN_OPTIONS}
                    value={chat.join}
                    disabled={joinDisabled}
                    onChange={next => updateConfig(draft => { draft.chat.join = next; })}
                />
                {joinDisabled && (
                    <p className="vc-limelight-caption">Applies to Follow grid and Own theme. Discord's own chat is left as it is.</p>
                )}
            </div>

            <div className="vc-limelight-switches">
                <SwitchRow
                    label="Theme dots by names"
                    hint="Each person's tile colour, beside their name in chat"
                    checked={chat.themeDots}
                    onChange={next => updateConfig(draft => { draft.chat.themeDots = next; })}
                />
                <SwitchRow
                    label="Channel picker in the call chat"
                    hint="Open any text channel in the server beside the call"
                    checked={chat.channelPicker}
                    onChange={next => updateConfig(draft => { draft.chat.channelPicker = next; })}
                />
            </div>

            {chat.look === "own" && (
                <>
                    <div className="vc-limelight-preview" aria-hidden="true" style={{ background: previewBackground(chat.own, ownUrl, PROFILE_FALLBACK) }}>
                        <span className="vc-limelight-preview-chip">Chat background</span>
                    </div>
                    <BackgroundEditor
                        background={chat.own}
                        allowProfile={false}
                        onChange={next => updateConfig(draft => { draft.chat.own = next; })}
                    />
                </>
            )}
        </>
    );
}
