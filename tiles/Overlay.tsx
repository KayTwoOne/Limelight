/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The pill and the overlay that carries it. Discord's own tile overlay keeps
// running untouched (its buttons, hover and idle logic): the pill is drawn beside
// it, inside Limelight's own ErrorBoundary, never around it.

import ErrorBoundary from "@components/ErrorBoundary";
import { ApplicationStore, ChannelRTCStore, IconUtils, PresenceStore, React, UserStore, useStateFromStores } from "@webpack/common";
import { type ComponentType } from "react";

import { ParticipantType } from "../logic/fold";
import { MINI_BELOW_PX } from "../logic/scale";
import { ConsoleIcon, DeafenedIcon, GameGlyph, MobileIcon, MutedIcon, ShieldIcon, StreamingIcon } from "./icons";
import { measurePill, observePill } from "./tiers";

// Discord's voice platform numbers (anchors-tiles.md 4). Equicord's own enum is
// out of date, so the numbers are written here.
const PLATFORM_MOBILE = 1;
const PLATFORM_XBOX = 2;
const PLATFORM_PLAYSTATION = 3;
const ACTIVITY_PLAYING = 0;
const AVATAR_SIZE = 40;

// The props Discord gives its tile overlay that the pill reads.
export interface PillProps {
    title?: string;
    participantType?: number;
    participantUserId?: string | null;
    muted?: boolean;
    deafened?: boolean;
    serverMuted?: boolean;
    serverDeafened?: boolean;
    localMuted?: boolean;
    platform?: number | null;
    focused?: boolean;
    idle?: boolean;
    width?: number;
    channel?: { id: string; getGuildId(): string | null | undefined; } | null;
    secureFramesVerified?: boolean;
    [prop: string]: unknown;
}

// The owner's USER participant, which a STREAM participant lacks.
interface OwnerParticipant {
    type: number;
    speaking?: boolean;
    voicePlatform?: number | null;
    voiceState?: { isVoiceMuted?(): boolean; isVoiceDeafened?(): boolean; } | null;
}

interface PlayingActivity {
    type: number;
    name?: string;
    application_id?: string;
}

// The owner's voice state, speaking and platform as one number, so a store
// mapper returns a primitive: bit 0 muted, bit 1 deafened, bit 2 speaking, the
// rest the platform plus one (zero when unknown).
function readOwner(channelId: string | undefined, userId: string | null): number {
    if (!channelId || !userId) return 0;
    const owner = ChannelRTCStore.getParticipant(channelId, userId) as unknown as OwnerParticipant | null;
    if (!owner || owner.type !== ParticipantType.USER) return 0;
    let bits = 0;
    if (owner.voiceState?.isVoiceMuted?.()) bits |= 1;
    if (owner.voiceState?.isVoiceDeafened?.()) bits |= 2;
    if (owner.speaking) bits |= 4;
    if (typeof owner.voicePlatform === "number") bits |= (owner.voicePlatform + 1) << 3;
    return bits;
}

function playing(userId: string | null): PlayingActivity | undefined {
    if (!userId) return undefined;
    return (PresenceStore.getActivities(userId) as unknown as PlayingActivity[]).find(a => a.type === ACTIVITY_PLAYING);
}

export function Pill(props: PillProps) {
    const { title, participantType, participantUserId, channel, focused, idle, secureFramesVerified, width } = props;
    const userId = typeof participantUserId === "string" ? participantUserId : null;
    const channelId = channel?.id;
    const guildId = channel?.getGuildId?.() ?? null;
    const live = participantType === ParticipantType.STREAM;

    // A STREAM participant has no voice state of its own: the owner's is read.
    const owner = useStateFromStores([ChannelRTCStore], () => live ? readOwner(channelId, userId) : 0, [live, channelId, userId]);
    const activityName = useStateFromStores([PresenceStore], () => playing(userId)?.name ?? "", [userId]);
    const applicationId = useStateFromStores([PresenceStore], () => playing(userId)?.application_id ?? "", [userId]);
    const iconHash = useStateFromStores([ApplicationStore], () => applicationId ? ApplicationStore.getApplication(applicationId)?.icon ?? "" : "", [applicationId]);
    const avatarUrl = useStateFromStores([UserStore], () => live && userId ? UserStore.getUser(userId)?.getAvatarURL(guildId, AVATAR_SIZE) ?? "" : "", [live, userId, guildId]);
    const [failedIcon, setFailedIcon] = React.useState<string | null>(null);

    const ownerPlatform = (owner >> 3) - 1;
    const platform = live && ownerPlatform >= 0 ? ownerPlatform : props.platform;
    const isDeafened = props.deafened === true || props.serverDeafened === true || (owner & 2) !== 0;
    // Deafening implies muting, so one icon says it, as Discord's own plate does.
    // Locally muting a person (not their stream) reads as muted too.
    const isMuted = !isDeafened && (props.muted === true || props.serverMuted === true || (!live && props.localMuted === true) || (owner & 1) !== 0);
    const speaking = live && (owner & 4) !== 0;
    // The maximised stream keeps only the avatar chip while the pointer is idle
    // and the streamer is quiet, clear of game HUDs; it reopens when the pointer
    // moves or they speak (spec 5.5, tokens.md 4.1). Discord's idle flag is
    // "the pointer has been still for two seconds".
    const collapsed = live && focused === true && idle === true && !speaking;
    // A tile too narrow for names shows the name as a tooltip instead, in the
    // filmstrip only (spec 5.5).
    const mini = typeof width === "number" && width < MINI_BELOW_PX;
    const isConsole = platform === PLATFORM_XBOX || platform === PLATFORM_PLAYSTATION;
    const hasIcons = live || isMuted || isDeafened || platform === PLATFORM_MOBILE || isConsole;

    const iconUrl = applicationId && iconHash ? IconUtils.getApplicationIconURL({ id: applicationId, icon: iconHash }) as string | undefined : undefined;

    // Everything that changes how wide the pill's parts are, so the tier is
    // measured again after the render that changed it.
    const signature = [live, title, isMuted, isDeafened, platform, secureFramesVerified === true, activityName, iconUrl, avatarUrl].join("|");
    const ref = React.useRef<HTMLDivElement>(null);
    React.useLayoutEffect(() => ref.current ? observePill(ref.current) : undefined, []);
    React.useLayoutEffect(() => {
        if (ref.current) measurePill(ref.current);
    }, [signature]);

    // The name as a tooltip on a filmstrip tile too narrow for names (spec 5.5).
    // Discord's own overlay layer covers the tile and is drawn above the pill, so
    // it takes the pointer first and a title on the pill is never hovered. The
    // tile is an ancestor of that layer, so the browser's tooltip for a title on
    // the tile shows anywhere over it, and nothing is placed over any of
    // Discord's buttons. React never sets a title on the tile, so it leaves this
    // one alone.
    const tooltip = mini && title ? title : "";
    React.useLayoutEffect(() => {
        const tile = ref.current?.closest<HTMLElement>(".limelight-tile");
        if (!tile || !tooltip || tile.hasAttribute("title")) return;
        if (!tile.closest('[class*="participantsWrapperAnimated__"]')) return;
        tile.title = tooltip;
        return () => {
            if (tile.title === tooltip) tile.removeAttribute("title");
        };
    }, [tooltip]);

    return (
        <div
            ref={ref}
            className="ll-pill"
            data-live={live}
            data-speaking={speaking}
            data-focused={focused === true}
            data-idle={idle === true}
            data-collapsed={collapsed}
            title={tooltip || undefined}
        >
            {live && avatarUrl && <img className="ll-pill-avatar" src={avatarUrl} alt="" draggable={false} />}
            {title && <span className="ll-pill-name">{title}</span>}
            {hasIcons && (
                <span className="ll-pill-icons">
                    {live && <StreamingIcon />}
                    {isMuted && <MutedIcon />}
                    {isDeafened && <DeafenedIcon />}
                    {platform === PLATFORM_MOBILE && <MobileIcon />}
                    {isConsole && <ConsoleIcon />}
                </span>
            )}
            {secureFramesVerified === true && <ShieldIcon />}
            {activityName && (
                <span className="ll-pill-more">
                    <span className="ll-pill-sep" aria-hidden="true" />
                    <span className="ll-pill-act">
                        {iconUrl && failedIcon !== iconUrl
                            ? <img className="ll-pill-act-icon" src={iconUrl} alt="" draggable={false} onError={() => setFailedIcon(iconUrl)} />
                            : <GameGlyph />}
                        {activityName}
                    </span>
                </span>
            )}
        </div>
    );
}

// The LIVE badge of a streamer's filmstrip tile (tokens.md 4.3). It is drawn on
// every live tile and shown only in the filmstrip by focus.css, where Discord's
// own badge is hidden so there is never a pair.
export function LiveBadge() {
    return <span className="ll-strip-live" aria-hidden="true">LIVE</span>;
}

// Renders Limelight's pill and live badge, then Discord's overlay with its own props.
export function renderOverlay(Original: ComponentType<any>, props: Record<string, unknown>) {
    return (
        <>
            <ErrorBoundary noop>
                <Pill {...props} />
            </ErrorBoundary>
            {props.participantType === ParticipantType.STREAM && (
                <ErrorBoundary noop>
                    <LiveBadge />
                </ErrorBoundary>
            )}
            <Original {...props} />
        </>
    );
}
