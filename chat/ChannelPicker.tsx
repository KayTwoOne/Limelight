/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The call chat's channel picker (plans/2026-10-21-call-chat-picker.md). Three
// parts of Discord's call chat are swapped for these, and all three read the
// same pick, so the title, the drop target and the chat always agree:
// - the heading: Discord's own icon and title, made into the picker's button
// - the upload area: Discord's, for the channel on show
// - the body: Discord's own chat, for the channel on show
// The chat is Discord's component, so everything in it is native. A text
// channel gets a normal channel's composer buttons; the call's own chat keeps
// the sidebar composer exactly as Discord draws it.

import ErrorBoundary from "@components/ErrorBoundary";
import { findByPropsLazy } from "@webpack";
import {
    ChannelStore,
    GuildChannelStore,
    MessageStore,
    PermissionsBits,
    PermissionStore,
    Popout,
    React,
    ReadStateStore,
    UserGuildSettingsStore,
    useStateFromStores
} from "@webpack/common";
import { type ComponentType, type KeyboardEvent, type ReactNode } from "react";

import {
    buildSections,
    type CategoryFacts,
    type ChannelFacts,
    filterSections,
    flatRows,
    isPickable,
    type PickerRules,
    type PickerSection,
    type RowSignal,
    rowSignal,
    stepFocus,
    textChannelInputType
} from "../logic/channelPicker";
import { chatSurface } from "../logic/scrim";
import { CHAT_ROOT } from "../logic/styleSheet";
import { finders, HOOK } from "../patches";
import { guard } from "../runtime/hookApi";
import { getConfig, useLimelightConfig } from "../store/configStore";
import { imageAverage, imageLightest, useImageUrl } from "../store/imageStore";
import { AnnouncementIcon, ChevronIcon, HashIcon, ReturnIcon, SearchIcon, TickIcon } from "./pickerIcons";
import { getMountedCallChat, setMountedCallChat, setTarget, useTargetId } from "./pickerStore";

const MessageFetch = findByPropsLazy(...finders.messageFetch.props);

/** The parts of a channel record the picker reads */
export interface ChannelRecord {
    id: string;
    name: string;
    type: number;
    position?: number;
    parent_id?: string | null;
    guild_id?: string | null;
}

const ANNOUNCEMENT = 5;
const CATEGORY = 4;

function facts(channel: ChannelRecord): ChannelFacts & { guildId: string | null; } {
    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position ?? 0,
        parentId: channel.parent_id ?? null,
        guildId: channel.guild_id ?? null
    };
}

// The channel list's rules for one server, answered by Discord's stores. Where
// Discord no longer has a method, the rule opens rather than hides: a missing
// opt-in check must not empty the list.
function rulesFor(guildId: string): PickerRules {
    const settings = UserGuildSettingsStore as any;
    const optInReadable = typeof settings.isChannelRecordOrParentOptedIn === "function";
    const record = (c: ChannelFacts) => ChannelStore.getChannel(c.id);
    return {
        canView: c => {
            const channel = record(c);
            return channel != null && PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel);
        },
        optInEnabled: optInReadable && Boolean(settings.isOptInEnabled?.(guildId)),
        isOptedIn: c => {
            const channel = record(c);
            return channel != null && Boolean(settings.isChannelRecordOrParentOptedIn(channel));
        },
        hideMuted: Boolean(settings.isGuildCollapsed?.(guildId)),
        isMuted: c => Boolean(settings.isGuildOrCategoryOrChannelMuted?.(guildId, c.id))
    };
}

/**
 * The text channel the call chat of `voice` should show, or null for its own
 * chat. A pick that stops being valid (deleted, no longer readable, taken off
 * the channel list, or the picker switched off) falls back to null at once.
 */
export function useCallChatTarget(voice: ChannelRecord): ChannelRecord | null {
    const { chat } = useLimelightConfig();
    const targetId = useTargetId(voice.id);
    const guildId = voice.guild_id ?? null;
    // The stores are read here, at render, never at module scope: they load later
    return useStateFromStores([ChannelStore, PermissionStore, UserGuildSettingsStore], () => {
        if (!chat.channelPicker || targetId == null || guildId == null) return null;
        const channel = ChannelStore.getChannel(targetId) as ChannelRecord | undefined;
        if (channel == null) return null;
        return isPickable(facts(channel), guildId, rulesFor(guildId)) ? channel : null;
    }, [chat.channelPicker, targetId, guildId]);
}

// --- the list -----------------------------------------------------------------

interface PickerData {
    sections: PickerSection[];
    signals: Map<string, RowSignal>;
    key: string;
}

function readPickerData(guildId: string): PickerData {
    const all = (GuildChannelStore as any).getChannels?.(guildId) ?? {};
    const channels: ChannelFacts[] = (all.SELECTABLE ?? []).map((entry: { channel: ChannelRecord; }) => facts(entry.channel));
    // Discord's list holds a stand-in "Uncategorized" category with no real id
    const categories: CategoryFacts[] = (all[CATEGORY] ?? [])
        .map((entry: { channel: ChannelRecord; }) => entry.channel)
        .filter((c: ChannelRecord) => c?.type === CATEGORY && /^\d+$/.test(c.id))
        .map((c: ChannelRecord) => ({ id: c.id, name: c.name, position: c.position ?? 0 }));

    const rules = rulesFor(guildId);
    const sections = buildSections(channels, categories, rules);
    const settings = UserGuildSettingsStore as any;
    const signals = new Map<string, RowSignal>();
    for (const row of flatRows(sections)) {
        const record = ChannelStore.getChannel(row.id);
        signals.set(row.id, rowSignal({
            hasUnread: Boolean(ReadStateStore.hasUnread(row.id)),
            mentions: ReadStateStore.getMentionCount(row.id) ?? 0,
            muted: row.muted,
            unreadSetting: record != null ? Number(settings.resolveUnreadSetting?.(record) ?? 1) : 1
        }));
    }
    const key = sections.map(s => `${s.category?.id ?? "-"}:${s.rows.map(r => {
        const signal = signals.get(r.id);
        return `${r.id}|${r.name}|${r.muted ? 1 : 0}|${signal?.kind === "mentions" ? signal.count : signal?.kind ?? ""}`;
    }).join(",")}`).join(";");
    return { sections, signals, key };
}

function usePickerData(guildId: string): PickerData {
    return useStateFromStores(
        [GuildChannelStore, ChannelStore, PermissionStore, UserGuildSettingsStore, ReadStateStore],
        () => readPickerData(guildId),
        [guildId],
        (a: PickerData, b: PickerData) => a.key === b.key
    );
}

// The chat's own surface under Follow grid and Own theme, so the picker reads
// as part of it; null under Discord's look, which keeps Discord's colours (G5)
function useChatSurface(): string | null {
    const config = useLimelightConfig();
    const ownImage = config.chat.own.type === "image" ? config.chat.own.imageId : undefined;
    const everyoneImage = config.everyone.background.type === "image" ? config.everyone.background.imageId : undefined;
    useImageUrl(ownImage);
    useImageUrl(everyoneImage);
    if (config.chat.look === "discord") return null;
    return chatSurface(
        config.chat,
        config.everyone,
        ownImage ? imageLightest(ownImage) : null,
        everyoneImage ? imageAverage(everyoneImage) : null
    );
}

function channelIcon(type: number): ComponentType<any> {
    return type === ANNOUNCEMENT ? AnnouncementIcon : HashIcon;
}

interface ListRow {
    id: string;
    name: string;
    type: number | null;
    muted: boolean;
    signal: RowSignal;
}

interface PickerListProps {
    voice: ChannelRecord;
    voiceIcon: ComponentType<any>;
    voiceName: ReactNode;
    current: string;
    onPick(channelId: string): void;
}

function PickerList({ voice, voiceIcon: VoiceIcon, voiceName, current, onPick }: PickerListProps) {
    const data = usePickerData(voice.guild_id!);
    const surface = useChatSurface();
    const [query, setQuery] = React.useState("");
    const [focus, setFocus] = React.useState(-1);
    const listRef = React.useRef<HTMLDivElement>(null);

    const shown = React.useMemo(() => filterSections(data.sections, query), [data.sections, query]);
    const callMatches = !query.trim() || voice.name.toLowerCase().includes(query.trim().toLowerCase());
    const order: string[] = React.useMemo(
        () => [...(callMatches ? [voice.id] : []), ...flatRows(shown).map(r => r.id)],
        [callMatches, voice.id, shown]
    );

    React.useEffect(() => setFocus(-1), [query]);
    React.useEffect(() => {
        if (focus < 0) return;
        listRef.current?.querySelector(`[data-row="${order[focus]}"]`)?.scrollIntoView({ block: "nearest" });
    }, [focus, order]);

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocus(i => stepFocus(i, e.key === "ArrowDown" ? 1 : -1, order.length));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const id = order[focus >= 0 ? focus : 0];
            if (id) onPick(id);
        }
    };

    const row = (item: ListRow, index: number, Icon: ComponentType<any>, sub?: string) => {
        const selected = item.id === current;
        return (
            <div
                key={item.id}
                id={`vc-limelight-picker-${item.id}`}
                data-row={item.id}
                role="option"
                aria-selected={selected}
                className="vc-limelight-picker-row"
                data-focused={index === focus || undefined}
                data-unread={item.signal.kind !== "none" || undefined}
                data-muted={item.muted || undefined}
                onMouseMove={() => index !== focus && setFocus(index)}
                onClick={() => onPick(item.id)}
            >
                <Icon size="sm" className="vc-limelight-picker-row-icon" />
                <span className="vc-limelight-picker-name">{item.name}</span>
                {sub && <span className="vc-limelight-picker-sub">{sub}</span>}
                <span className="vc-limelight-picker-end">
                    {item.signal.kind === "mentions" && <span className="vc-limelight-picker-badge">{item.signal.count > 99 ? "99+" : item.signal.count}</span>}
                    {item.signal.kind === "unread" && <span className="vc-limelight-picker-dot" />}
                    {selected && <TickIcon />}
                </span>
            </div>
        );
    };

    let index = 0;
    const style = surface ? ({ "--vc-ll-picker-surface": surface } as React.CSSProperties) : undefined;
    return (
        <div className="vc-limelight-picker" style={style}>
            <label className="vc-limelight-picker-search">
                <SearchIcon />
                <input
                    autoFocus
                    value={query}
                    placeholder="Find a channel"
                    aria-label="Find a channel"
                    aria-controls="vc-limelight-picker-list"
                    aria-activedescendant={focus >= 0 ? `vc-limelight-picker-${order[focus]}` : undefined}
                    onChange={e => setQuery(e.currentTarget.value)}
                    onKeyDown={onKeyDown}
                />
            </label>
            <div className="vc-limelight-picker-list" id="vc-limelight-picker-list" role="listbox" aria-label="Channels" ref={listRef}>
                {callMatches && row(
                    { id: voice.id, name: typeof voiceName === "string" ? voiceName : voice.name, type: null, muted: false, signal: { kind: "none" } },
                    index++,
                    VoiceIcon,
                    "this call"
                )}
                {callMatches && shown.length > 0 && <div className="vc-limelight-picker-sep" role="presentation" />}
                {shown.map(section => (
                    <div key={section.category?.id ?? "loose"} role="group" aria-label={section.category?.name ?? "Channels"}>
                        {section.category && <div className="vc-limelight-picker-group" aria-hidden="true">{section.category.name}</div>}
                        {section.rows.map(r => row(
                            { id: r.id, name: r.name, type: r.type, muted: r.muted, signal: data.signals.get(r.id) ?? { kind: "none" } },
                            index++,
                            channelIcon(r.type)
                        ))}
                    </div>
                ))}
                {order.length === 0 && <div className="vc-limelight-picker-empty">No channels match</div>}
            </div>
        </div>
    );
}

// --- the three swapped parts ------------------------------------------------

interface HeaderBarLike {
    ChannelIcon: ComponentType<any>;
    Title: ComponentType<any>;
}

export interface HeadingProps {
    Header: HeaderBarLike;
    icon: ComponentType<any>;
    iconLabel: string;
    name: ReactNode;
    channel: ChannelRecord;
}

function DiscordHeading({ Header, icon, iconLabel, name }: HeadingProps) {
    return (
        <>
            <Header.ChannelIcon icon={icon} aria-label={iconLabel} />
            <Header.Title>{name}</Header.Title>
        </>
    );
}

function PickerHeading(props: HeadingProps) {
    const { Header, icon, name, channel } = props;
    const { chat } = useLimelightConfig();
    const target = useCallChatTarget(channel);
    const triggerRef = React.useRef<HTMLDivElement>(null);

    // Direct message calls have no server channels; the switch turns it all off
    if (!chat.channelPicker || channel.guild_id == null) return <DiscordHeading {...props} />;

    const shownIcon = target ? channelIcon(target.type) : icon;
    return (
        <>
            <Popout
                position="bottom"
                align="left"
                spacing={6}
                animation={Popout.Animation.FADE}
                targetElementRef={triggerRef}
                renderPopout={({ closePopout }) => (
                    <ErrorBoundary noop>
                        <PickerList
                            voice={channel}
                            voiceIcon={icon}
                            voiceName={name}
                            current={target?.id ?? channel.id}
                            onPick={id => {
                                setTarget(channel.id, id);
                                closePopout();
                            }}
                        />
                    </ErrorBoundary>
                )}
            >
                {({ onClick }, { isShown }) => (
                    <div
                        ref={triggerRef}
                        role="button"
                        tabIndex={0}
                        className="vc-limelight-picker-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isShown}
                        aria-label={`Channel picker, showing ${target ? target.name : channel.name}`}
                        onClick={onClick}
                        onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onClick(e as any);
                            }
                        }}
                    >
                        <Header.ChannelIcon icon={shownIcon} />
                        <Header.Title>{target ? target.name : name}</Header.Title>
                        <ChevronIcon className="vc-limelight-picker-chevron" />
                    </div>
                )}
            </Popout>
            {target && (
                <button type="button" className="vc-limelight-picker-back" onClick={() => setTarget(channel.id, null)}>
                    <ReturnIcon />
                    Call chat
                </button>
            )}
        </>
    );
}

export function callChatHeading(props: HeadingProps): ReactNode {
    return guard<ReactNode>(HOOK.chat, <DiscordHeading {...props} />, () => (
        <ErrorBoundary fallback={() => <DiscordHeading {...props} />}>
            <PickerHeading {...props} />
        </ErrorBoundary>
    ));
}

interface UploadProps {
    Upload: ComponentType<any>;
    props: { channel: ChannelRecord; [key: string]: unknown; };
}

function PickerUpload({ Upload, props }: UploadProps) {
    const target = useCallChatTarget(props.channel);
    return <Upload {...props} channel={target ?? props.channel} />;
}

export function callChatUpload(Upload: ComponentType<any>, props: UploadProps["props"]): ReactNode {
    return guard<ReactNode>(HOOK.chat, <Upload {...props} />, () => (
        <ErrorBoundary fallback={() => <Upload {...props} />}>
            <PickerUpload Upload={Upload} props={props} />
        </ErrorBoundary>
    ));
}

interface BodyProps {
    Chat: ComponentType<any>;
    voice: ChannelRecord;
    guild: unknown;
    types: Record<string, object>;
}

// Discord loads a channel's messages when it is selected. A channel shown here is
// not selected, so the first page is asked for once, as opening it would.
function loadIfNeeded(channelId: string): void {
    try {
        const messages = MessageStore.getMessages(channelId) as any;
        if (messages?.ready || messages?.loadingMore) return;
        MessageFetch.fetchMessages({ channelId, limit: 50 });
    } catch {
        // The chat shows its own loading and error states
    }
}

function PickerBody({ Chat, voice, guild, types }: BodyProps) {
    const target = useCallChatTarget(voice);
    React.useEffect(() => setMountedCallChat(voice.id), [voice.id]);
    React.useEffect(() => {
        if (target) loadIfNeeded(target.id);
    }, [target?.id]);

    const shown = target ?? voice;
    const inputType = target ? textChannelInputType(types.SIDEBAR, types.NORMAL) : types.SIDEBAR;
    return <Chat key={shown.id} channel={shown} guild={guild} chatInputType={inputType} />;
}

export function callChatBody(Chat: ComponentType<any>, props: { channel: ChannelRecord; guild: unknown; }, types: Record<string, object>): ReactNode {
    const original = <Chat key={props.channel.id} channel={props.channel} guild={props.guild} chatInputType={types.SIDEBAR} />;
    return guard<ReactNode>(HOOK.chat, original, () => (
        <ErrorBoundary fallback={() => original}>
            <PickerBody Chat={Chat} voice={props.channel} guild={props.guild} types={types} />
        </ErrorBoundary>
    ));
}

// --- channel links clicked inside the call chat ------------------------------

let clickInCallChat = false;

/** A capture-phase click listener on the document: notes whether the click began inside the call chat */
export function recordClickOrigin(event: MouseEvent): void {
    const { target } = event;
    clickInCallChat = target instanceof Element && target.closest(CHAT_ROOT) != null;
}

/**
 * Called first by a channel mention's click handler (patches.ts). A link to a
 * channel (not a message) clicked inside the call chat, for a channel the
 * picker would list in the call's server, opens in the call chat and returns
 * true, so Discord does not navigate. Anything else returns false and Discord
 * handles the click as it always does.
 */
export function openMentionInCallChat(node: { channelId?: string | null; messageId?: string | null; } | null | undefined): boolean {
    const fromCallChat = clickInCallChat;
    clickInCallChat = false;
    if (!fromCallChat || node?.channelId == null || node.messageId != null) return false;
    if (!getConfig().chat.channelPicker) return false;

    const voiceId = getMountedCallChat();
    const voice = voiceId != null ? ChannelStore.getChannel(voiceId) as ChannelRecord | undefined : undefined;
    const channel = ChannelStore.getChannel(node.channelId) as ChannelRecord | undefined;
    if (voiceId == null || voice?.guild_id == null || channel == null) return false;
    if (!isPickable(facts(channel), voice.guild_id, rulesFor(voice.guild_id))) return false;

    setTarget(voiceId, channel.id);
    return true;
}
