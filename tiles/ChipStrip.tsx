/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Chip small tiles (Small tile size: Chip). Each small person is one 40px line.
// Discord's grid gets its 16:9 shape from its own cell wrapper, not from the tile,
// so the strip skips Discord's grid: it calls each small tile's own render with a
// compact width and stretches Discord's tile across a Limelight chip. The tile
// keeps its theme, its speaking ring, and its click and right-click (with the
// volume slider). Limelight's face (avatar, name, mute and deafen) sits on top
// and lets every click through.
//
// Each strip checks itself once drawn (logic/chips.ts). If Discord's tile doesn't
// fill its chip, chips are switched off for the session, small tiles fall back to
// Third (SplitGrid), and Health says what was found.

import ErrorBoundary from "@components/ErrorBoundary";
import { ApplicationStore, ChannelRTCStore, ChannelStore, IconUtils, MediaEngineStore, PresenceStore, React, SelectedChannelStore, useStateFromStores, VoiceStateStore } from "@webpack/common";

import { CHIP_TILE_WIDTH, chipActivity, chipCheck, chipPads, chipVoice } from "../logic/chips";
import { ConsoleIcon, DeafenedIcon, MobileIcon, MutedIcon } from "./icons";
import { type GridProps } from "./SplitGrid";

export type ChipHealth = "waiting" | "working" | "broken";

let health: ChipHealth = "waiting";
let failure: string[] = [];
const listeners = new Set<() => void>();

function notify(): void {
    for (const listener of listeners) listener();
}

export function chipHealth(): ChipHealth {
    return health;
}

export function chipFailure(): readonly string[] {
    return failure;
}

export function subscribeChips(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function markBroken(reason: string): void {
    if (health === "broken") return;
    health = "broken";
    failure = [`Chip small tiles switched off: ${reason}`];
    notify();
}

function markWorking(): void {
    if (health !== "waiting") return;
    health = "working";
    notify();
}

interface ChipParticipant {
    user?: {
        id?: string;
        username?: string;
        globalName?: string | null;
        getAvatarURL?: (guildId?: string | null, size?: number) => string;
    } | null;
    userNick?: string | null;
}

// Discord's voice platform numbers, as on a person's name pill (tiles/Overlay.tsx)
const PLATFORM_MOBILE = 1;
const PLATFORM_XBOX = 2;
const PLATFORM_PLAYSTATION = 3;

const MUTED = 1;
const DEAFENED = 2;

interface RtcParticipant {
    voicePlatform?: number | null;
}

// The chip's face shows what a person's name pill shows (Kaylum, 9 Nov: "content
// aware" and "always show the bot's stance"): every kind of mute and deafen, the
// platform, and what they're doing, each read from Discord's own stores.
function ChipFace({ participant }: { participant: ChipParticipant; }) {
    const { user } = participant;
    const id = user?.id ?? "";
    const channelId = SelectedChannelStore.getVoiceChannelId() ?? "";
    const voice = useStateFromStores([VoiceStateStore, MediaEngineStore], () => {
        const state = id ? VoiceStateStore.getVoiceStateForUser(id) : null;
        const localMute = id ? (MediaEngineStore as unknown as { isLocalMute?(userId: string): boolean; }).isLocalMute?.(id) === true : false;
        const v = chipVoice({ selfMute: state?.selfMute, mute: state?.mute, selfDeaf: state?.selfDeaf, deaf: state?.deaf, localMute });
        return (v.muted ? MUTED : 0) | (v.deafened ? DEAFENED : 0);
    }, [id]);
    const platform = useStateFromStores([ChannelRTCStore], () => {
        const p = id && channelId ? ChannelRTCStore.getParticipant(channelId, id) as unknown as RtcParticipant | null : null;
        return typeof p?.voicePlatform === "number" ? p.voicePlatform : -1;
    }, [id, channelId]);
    const activityName = useStateFromStores([PresenceStore], () => chipActivity(id ? PresenceStore.getActivities(id) as never : [])?.name ?? "", [id]);
    const applicationId = useStateFromStores([PresenceStore], () => chipActivity(id ? PresenceStore.getActivities(id) as never : [])?.applicationId ?? "", [id]);
    const iconHash = useStateFromStores([ApplicationStore], () => applicationId ? ApplicationStore.getApplication(applicationId)?.icon ?? "" : "", [applicationId]);
    const [failedIcon, setFailedIcon] = React.useState<string | null>(null);

    const guildId = ChannelStore.getChannel(channelId)?.guild_id ?? null;
    const avatar = user?.getAvatarURL?.(guildId, 64);
    const name = participant.userNick || user?.globalName || user?.username || "";
    const iconUrl = applicationId && iconHash ? IconUtils.getApplicationIconURL({ id: applicationId, icon: iconHash }) as string | undefined : undefined;
    const isConsole = platform === PLATFORM_XBOX || platform === PLATFORM_PLAYSTATION;
    const hasIcons = voice !== 0 || platform === PLATFORM_MOBILE || isConsole;

    return (
        <span className="vc-limelight-tilechip-face">
            {avatar && <img className="vc-limelight-tilechip-avatar" src={avatar} alt="" draggable={false} />}
            <span className="vc-limelight-tilechip-name">{name}</span>
            {hasIcons && (
                <span className="vc-limelight-tilechip-icons">
                    {voice & DEAFENED ? <DeafenedIcon /> : voice & MUTED ? <MutedIcon /> : null}
                    {platform === PLATFORM_MOBILE && <MobileIcon />}
                    {isConsole && <ConsoleIcon />}
                </span>
            )}
            {activityName && (
                <>
                    <span className="vc-limelight-tilechip-sep" aria-hidden="true" />
                    <span className="vc-limelight-tilechip-act">
                        {iconUrl && failedIcon !== iconUrl && (
                            <img className="vc-limelight-tilechip-act-icon" src={iconUrl} alt="" draggable={false} onError={() => setFailedIcon(iconUrl)} />
                        )}
                        <span className="vc-limelight-tilechip-act-text">{activityName}</span>
                    </span>
                </>
            )}
        </span>
    );
}

interface ChipStripProps {
    gridProps: GridProps;
    /** The small tiles, as indices into the grid's children */
    indices: readonly number[];
    participants: readonly unknown[];
    place: "below" | "above";
    /** The pad on the side away from the main grid, where the call's controls or header sit */
    outer: number;
}

// How many frames a chip may take to get Discord's tile before it counts as missing
const SETTLE_FRAMES = 20;

export function ChipStrip({ gridProps, indices, participants, place, outer }: ChipStripProps) {
    const ref = React.useRef<HTMLDivElement>(null);
    const children = gridProps.children ?? [];
    const key = gridProps.keyExtractor;

    // After each draw: does Discord's tile fill every chip?
    React.useEffect(() => {
        if (health === "broken") return;
        let frame = 0;
        let tries = 0;
        const check = () => {
            const node = ref.current;
            // Not on screen (the call view hidden): nothing to judge
            if (!node || node.getClientRects().length === 0) return;
            for (const chip of node.querySelectorAll<HTMLElement>(".vc-limelight-tilechip")) {
                const c = chip.getBoundingClientRect();
                const tile = chip.querySelector(".vc-limelight-tilechip-tile")?.firstElementChild?.getBoundingClientRect();
                if (!tile && ++tries < SETTLE_FRAMES) {
                    frame = requestAnimationFrame(check);
                    return;
                }
                const result = chipCheck({ chipWidth: c.width, chipHeight: c.height, tileWidth: tile?.width ?? 0, tileHeight: tile?.height ?? 0 });
                if (!result.ok) {
                    markBroken(result.reason ?? "a chip didn't come out as one line");
                    return;
                }
            }
            markWorking();
        };
        frame = requestAnimationFrame(check);
        return () => cancelAnimationFrame(frame);
    });

    const pads = chipPads(place, outer);
    return (
        <div
            className="vc-limelight-tilechips"
            ref={ref}
            style={{ paddingTop: pads.top, paddingBottom: pads.bottom }}
        >
            {indices.map(i => (
                <div className="vc-limelight-tilechip" key={String(key ? key(i) : i)}>
                    <div className="vc-limelight-tilechip-tile">{children[i]?.(CHIP_TILE_WIDTH)}</div>
                    <ErrorBoundary noop>
                        <ChipFace participant={(participants[i] ?? {}) as ChipParticipant} />
                    </ErrorBoundary>
                </div>
            ))}
        </div>
    );
}
