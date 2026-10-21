/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Limelight: makes Discord's voice call grid customisable.

import { type MessageDecorationProps } from "@api/MessageDecorations";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";
import { SelectedChannelStore } from "@webpack/common";
import { type ComponentType, type ReactNode } from "react";

import { callChatBody, callChatHeading, callChatUpload, type ChannelRecord, type HeadingProps, openMentionInCallChat, recordClickOrigin } from "./chat/ChannelPicker";
import { getMountedCallChat, getTarget, keepOnly, resetTargets } from "./chat/pickerStore";
import { ThemeDot } from "./chat/ThemeDot";
import { type ParticipantLike } from "./logic/fold";
import { SettingsPage } from "./panel/DisplayControls";
import { paletteElement } from "./panel/PaletteButton";
import { HOOK, patches } from "./patches";
import { preCallBackground, preCallButtons } from "./precall/PreCall";
import { guard, startWatchdog, stopWatchdog } from "./runtime/hookApi";
import { startSheet, stopSheet } from "./runtime/sheet";
import { flushConfig, loadConfig } from "./store/configStore";
import { startImages, stopImages } from "./store/imageStore";
import { badgeGate, foldWithTracking, resetStreams, skipsFocus, togglesSelection } from "./stream/streamHooks";
import chatStyle from "./styles/chat.css?managed";
import focusStyle from "./styles/focus.css?managed";
import morphStyle from "./styles/morph.css?managed";
import panelStyle from "./styles/panel.css?managed";
import pickerStyle from "./styles/picker.css?managed";
import pillStyle from "./styles/pill.css?managed";
import precallStyle from "./styles/precall.css?managed";
import tilesStyle from "./styles/tiles.css?managed";
import managedStyle from "./styles/tokens.css?managed";
import { renderOverlay } from "./tiles/Overlay";
import { slotClasses, tileClasses } from "./tiles/tileHooks";

// Props Discord gives its tile overlay, plus the component this replaces.
interface OverlayProps {
    Original: ComponentType<any>;
    [prop: string]: unknown;
}

// The plugin's settings page (spec 9.6): the same Display controls as the panel's
// Display tab, bound to the same config store, plus Reset all Limelight themes.
const settings = definePluginSettings({
    display: {
        type: OptionType.COMPONENT,
        component: () => <ErrorBoundary noop><SettingsPage /></ErrorBoundary>
    }
});

export default definePlugin({
    name: "Limelight",
    description: "Customise the voice call grid: themes for each person or everyone, one tile per person while they stream, and a chat panel that joins the call.",
    authors: [{ name: "dotkay", id: 0n }],
    dependencies: ["MessageDecorationsAPI"],
    patches,
    managedStyle,
    settings,

    flux: {
        CONNECTION_OPEN() {
            void loadConfig();
        },
        // Joining a voice channel keeps only its call chat's pick; leaving clears them
        VOICE_CHANNEL_SELECT({ channelId }: { channelId?: string | null; }) {
            keepOnly(channelId ?? null);
        }
    },

    // Every method below is called by a patch (patches.ts). Each goes through
    // guard, which marks the hook seen and returns Discord's own value if the
    // body throws.

    // The class on a tile's content (`participant` is the tile's participant).
    tileClass(className: string, participant: unknown) {
        return guard(HOOK.tiles, className, () => tileClasses(className, participant));
    },

    // The class on a tile's slot in the grid.
    slotClass(className: string, participant: unknown) {
        return guard(HOOK.tiles, className, () => slotClasses(className));
    },

    // Stands in for Discord's tile overlay. Limelight's pill sits beside Original
    // in its own ErrorBoundary, never around it, so Discord's overlay can never be
    // hidden by ours. If building the pair throws, Original alone is rendered.
    CallTileOverlay({ Original, ...rest }: OverlayProps) {
        const original = <Original {...rest} />;
        return guard(HOOK.tiles, original, () => renderOverlay(Original, rest));
    },

    // The grid's participant list, one tile per person: a streamer's stream tile
    // takes the slot of their avatar tile. Also records who just went live or
    // stopped, which the morph reads. On error the list is Discord's own.
    foldStreams<T extends ParticipantLike>(filtered: T[], participants: unknown) {
        return guard(HOOK.fold, filtered, () => foldWithTracking(filtered, participants));
    },

    // Whether clicking Watch Stream should keep the grid and skip Discord's focus.
    skipFocus(stream: unknown, selected: unknown) {
        return guard(HOOK.watch, false, () => skipsFocus(selected));
    },

    // Whether Discord's own select-or-toggle handling still runs on a click.
    shouldToggleSelect(stream: unknown, activeStreams: unknown, selected: unknown) {
        return guard(HOOK.watch, true, () => togglesSelection(stream, activeStreams, selected));
    },

    // Discord's gate for the LIVE and quality badge: true hides it. It is true
    // for the maximised tile only while the pointer is idle.
    hideBadge(focused: unknown, idle: unknown) {
        return guard<unknown>(HOOK.badge, focused, () => badgeGate(focused, idle));
    },

    // The palette button before the "more" button in the call controls. It sits
    // in its own ErrorBoundary; if building it throws, the tray shows nothing
    // extra.
    renderPaletteButton(channel: unknown) {
        return guard<ReactNode>(HOOK.tray, null, () => paletteElement(channel));
    },

    // The class on the pre-call screen's root: Discord's own, plus the marker every
    // pre-call rule is scoped under.
    preCallClass(className: string) {
        return guard(HOOK.precall, className, () => className ? `${className} limelight-precall` : "limelight-precall");
    },

    // Stands in for the pre-call screen's animated background: Discord's own, and
    // after it the stage a chosen look paints. If building that throws, the
    // background alone is rendered.
    renderPreCallBackground(Original: ComponentType<any>, disableAnimation: boolean) {
        return guard<ReactNode>(
            HOOK.precall,
            <Original disableAnimation={disableAnimation} />,
            () => preCallBackground(Original, disableAnimation)
        );
    },

    // Stands in for Join Voice: the same Button with the same props, and the
    // Limelight button beside it. If building that throws, Join Voice alone is
    // rendered.
    renderPreCallButtons(Button: ComponentType<any>, props: Record<string, unknown>) {
        return guard<ReactNode>(
            HOOK.precall,
            <Button {...props} />,
            () => preCallButtons(Button, props)
        );
    },

    // The call chat's heading, upload area and chat (chat/ChannelPicker.tsx). Each
    // falls back to Discord's own element if building Limelight's throws.
    renderCallChatHeading(props: HeadingProps) {
        return callChatHeading(props);
    },

    renderCallChatUpload(Upload: ComponentType<any>, props: { channel: ChannelRecord; }) {
        return callChatUpload(Upload, props);
    },

    renderCallChatBody(Chat: ComponentType<any>, props: { channel: ChannelRecord; guild: unknown; }, types: Record<string, object>) {
        return callChatBody(Chat, props, types);
    },

    // True when a channel link clicked inside the call chat was opened there, so
    // Discord's own navigation is skipped. Any failure answers false: Discord's.
    openMentionInCallChat(node: { channelId?: string | null; messageId?: string | null; }) {
        return guard(HOOK.mention, false, () => openMentionInCallChat(node));
    },

    // A theme dot beside each name in the voice channel's chat (spec 8.3). Equicord
    // renders this as a component inside its own error boundary, and the dot is
    // wrapped in another here. The factory only decides where a dot can belong:
    // the channel must be the one the call is in. Whether dots are on, and the Discord
    // look, are read by the dot itself so that toggling them updates messages
    // already on screen. chat.css shows the dot only under the call chat scope root.
    renderMessageDecoration({ message, channel }: MessageDecorationProps) {
        try {
            const userId = message?.author?.id;
            if (!userId || !channel) return null;
            // The call's own chat, or the text channel its call chat is showing
            const mounted = getMountedCallChat();
            const shown = channel.id === SelectedChannelStore.getVoiceChannelId() || (mounted != null && channel.id === getTarget(mounted));
            if (!shown) return null;
            return <ErrorBoundary noop><ThemeDot userId={userId} /></ErrorBoundary>;
        } catch {
            return null;
        }
    },

    start() {
        void loadConfig();
        startImages();
        startSheet();
        startWatchdog();
        enableStyle(tilesStyle);
        enableStyle(pillStyle);
        enableStyle(morphStyle);
        enableStyle(focusStyle);
        enableStyle(panelStyle);
        enableStyle(chatStyle);
        enableStyle(precallStyle);
        enableStyle(pickerStyle);
        document.addEventListener("click", recordClickOrigin, true);
    },

    stop() {
        void flushConfig();
        stopSheet();
        stopImages();
        stopWatchdog();
        resetStreams();
        disableStyle(tilesStyle);
        disableStyle(pillStyle);
        disableStyle(morphStyle);
        disableStyle(focusStyle);
        disableStyle(panelStyle);
        disableStyle(chatStyle);
        disableStyle(precallStyle);
        disableStyle(pickerStyle);
        document.removeEventListener("click", recordClickOrigin, true);
        resetTargets();
    }
});
