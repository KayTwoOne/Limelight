/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The People tab (spec 6.3, tokens.md 5.5, 5.6): the people in the call right
// now, each with a swatch of the theme their tile wears, and a theme editor for
// whoever is opened. Nobody outside the call is ever listed. While an editor is
// open every other tile dims (the editing target feeds the generated sheet), and
// if that person leaves the call the editor closes by itself.

import { ChannelRTCStore, ChannelStore, React, SelectedChannelStore, UserProfileStore, UserStore, useStateFromStores } from "@webpack/common";

import { normaliseHex } from "../logic/colour";
import { type Preset, type Theme, type TileSize } from "../logic/config";
import { avatarTheme } from "../logic/matchAvatar";
import { decodePeople, peopleKey, type PersonEntry, type PersonLike } from "../logic/people";
import { copyTheme, matchingPreset } from "../logic/presets";
import { themeFor } from "../logic/theme";
import { setEditingUserId } from "../runtime/editing";
import { limelightToast } from "../runtime/toast";
import { updateConfig, useLimelightConfig } from "../store/configStore";
import { samplePixels } from "../store/imagePipeline";
import { useImageUrl } from "../store/imageStore";
import { ChevronLeftIcon, ChevronRightIcon } from "./panelIcons";
import { PresetBar, presetOptions } from "./PresetBar";
import { Segmented, type SegmentOption } from "./Segmented";
import { Select } from "./Select";
import { previewBackground, PROFILE_FALLBACK, ThemeEditor } from "./ThemeEditor";

// Discord's avatar sizes are powers of two; 128 stays sharp at 46px on a dense
// screen.
const AVATAR_PX = 128;

// A number Discord stores a colour as (0xRRGGBB), as a hex string, or "".
function hexOf(colour: unknown): string {
    return typeof colour === "number" ? normaliseHex("#" + colour.toString(16).padStart(6, "0")) ?? "" : "";
}

// A person's profile colour as a hex string: the accent colour of their profile if
// Discord has it, else the first of its theme colours, else "" when nothing is
// known. A primitive, so the store mapper below can compare it with ===.
function profileOf(userId: string): string {
    const profile = UserProfileStore.getUserProfile(userId);
    return hexOf(profile?.accentColor) || hexOf(profile?.themeColors?.[0]);
}

// The colour a Profile background shows for this person: their profile colour if
// Discord has one, else the neutral.
function useProfileColour(userId: string): string {
    const colour = useStateFromStores([UserProfileStore], () => profileOf(userId), [userId]);
    return colour || PROFILE_FALLBACK;
}

interface AvatarProps {
    userId: string;
    guildId: string | null;
    large?: boolean;
}

function Avatar({ userId, guildId, large = false }: AvatarProps) {
    const url = useStateFromStores([UserStore], () => UserStore.getUser(userId)?.getAvatarURL(guildId, AVATAR_PX) ?? "", [userId, guildId]);
    const className = large ? "vc-limelight-avatar vc-limelight-avatar-large" : "vc-limelight-avatar";
    return url
        ? <img className={className} src={url} alt="" draggable={false} />
        : <span className={className} aria-hidden="true" />;
}

interface PersonRowProps {
    person: PersonEntry;
    guildId: string | null;
    theme: Theme;
    own: boolean;
    /** The preset their own theme still equals, named on the row */
    preset: Preset | null;
    onOpen(): void;
    rowRef(node: HTMLButtonElement | null): void;
}

function PersonRow({ person, guildId, theme, own, preset, onOpen, rowRef }: PersonRowProps) {
    const profile = useProfileColour(person.id);
    const imageUrl = useImageUrl(theme.background.type === "image" ? theme.background.imageId : undefined);

    return (
        <button type="button" className="vc-limelight-person" ref={rowRef} onClick={onOpen}>
            <Avatar userId={person.id} guildId={guildId} />
            <span className="vc-limelight-person-text">
                <span className="vc-limelight-person-name">{person.name || "Unknown"}</span>
                <span className="vc-limelight-person-theme">
                    <span
                        className="vc-limelight-theme-swatch"
                        aria-hidden="true"
                        style={{ background: previewBackground(theme.background, imageUrl, profile) }}
                    />
                    {own ? preset?.name ?? "Own theme" : "Everyone theme"}
                </span>
            </span>
            {person.live && <span className="vc-limelight-live">LIVE</span>}
            <span className="vc-limelight-chevron"><ChevronRightIcon /></span>
        </button>
    );
}

type SizeChoice = "auto" | TileSize;

const SIZE_OPTIONS: ReadonlyArray<SegmentOption<SizeChoice>> = [
    { id: "auto", label: "Auto" },
    { id: "normal", label: "Normal" },
    { id: "small", label: "Small" }
];

// A person's tile size (small tiles, tiles/SplitGrid.tsx). Auto follows Bots get
// small tiles for a bot, and keeps anyone else full size.
function TileSizeField({ userId }: { userId: string; }) {
    const { tiles } = useLimelightConfig();
    const bot = useStateFromStores([UserStore], () => UserStore.getUser(userId)?.bot === true, [userId]);
    const value: SizeChoice = tiles.people[userId] ?? "auto";

    return (
        <div className="vc-limelight-field">
            <span className="vc-limelight-section-label">Tile size</span>
            <Segmented
                label="Tile size"
                options={SIZE_OPTIONS}
                value={value}
                onChange={next => updateConfig(draft => {
                    if (next === "auto") delete draft.tiles.people[userId];
                    else draft.tiles.people[userId] = next;
                })}
            />
            <p className="vc-limelight-caption">
                {bot
                    ? `A bot: Auto follows Bots get small tiles (${tiles.smallBots ? "on" : "off"}). Normal keeps it full size.`
                    : "Auto keeps them full size. Small puts them in the strip with the bots."}
            </p>
        </div>
    );
}

interface PersonEditorProps {
    person: PersonEntry;
    guildId: string | null;
    backRef: { current: HTMLButtonElement | null; };
    onBack(): void;
}

function PersonEditor({ person, guildId, backRef, onBack }: PersonEditorProps) {
    const config = useLimelightConfig();
    const profile = useProfileColour(person.id);
    const { theme, own } = themeFor(config, person.id);
    const name = person.name || "Unknown";
    // Use Everyone replaces everything the editor shows, so it starts afresh:
    // nothing it was holding open (an image field, a picker) outlives the theme it
    // was open over, even where Everyone's background equals the one just removed.
    const [resets, setResets] = React.useState(0);

    // The first edit of a person who has no theme of their own starts from a
    // copy of Everyone's, so the controls begin on what their tile already shows.
    function save(next: Theme): void {
        updateConfig(draft => { draft.people[person.id] = next; });
    }

    function resetToEveryone(): void {
        if (!own) return;
        updateConfig(draft => { delete draft.people[person.id]; });
        setResets(count => count + 1);
    }

    // A preset replaces the whole theme, so the editor starts afresh on it too
    function applyPreset(next: Theme): void {
        save(next);
        setResets(count => count + 1);
    }

    // The still avatar, since an animated one's first frame may not be its look
    async function matchAvatar(): Promise<void> {
        const url = UserStore.getUser(person.id)?.getAvatarURL(guildId, 64, false);
        try {
            const next = url ? avatarTheme(await samplePixels(url, 32), theme) : null;
            if (!next) throw new Error("no colours");
            applyPreset(next);
        } catch {
            limelightToast(`Couldn't read ${name}'s avatar`, "failure");
        }
    }

    return (
        <>
            <div className="vc-limelight-editor-head">
                <button type="button" className="vc-limelight-back" ref={backRef} onClick={onBack}>
                    <ChevronLeftIcon />
                    People
                </button>
                <div className="vc-limelight-identity">
                    <Avatar userId={person.id} guildId={guildId} large />
                    <div className="vc-limelight-identity-text">
                        <span className="vc-limelight-title">{name}</span>
                        <span className="vc-limelight-caption">
                            {own ? `Saved for ${name}, in every call` : "Follows Everyone until you change something"}
                        </span>
                    </div>
                    <button type="button" className="vc-limelight-outline" aria-disabled={!own} onClick={resetToEveryone}>
                        Use Everyone
                    </button>
                </div>
            </div>
            <TileSizeField userId={person.id} />
            <PresetBar theme={theme} onApply={applyPreset} onMatchAvatar={matchAvatar} />
            <ThemeEditor key={resets} theme={theme} onChange={save} profile={profile} />
        </>
    );
}

export function PeopleTab() {
    const config = useLimelightConfig();
    // The voice channel, never the one being looked at (anchors-panel-chat.md 3).
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId() ?? "");
    const guildId = useStateFromStores([ChannelStore], () => (channelId ? ChannelStore.getChannel(channelId)?.guild_id ?? null : null), [channelId]);
    // Discord hands out one mutable array, so the subscription is to a string key
    // that changes only when somebody joins, leaves, is renamed or starts or stops
    // streaming.
    const key = useStateFromStores(
        [ChannelRTCStore],
        () => (channelId ? peopleKey(ChannelRTCStore.getParticipants(channelId) as unknown as readonly PersonLike[]) : ""),
        [channelId]
    );
    const people = React.useMemo(() => decodePeople(key), [key]);

    const [openId, setOpenId] = React.useState<string | null>(null);
    const open = openId === null ? null : people.find(person => person.id === openId) ?? null;
    const editingId = open?.id ?? null;

    const rows = React.useRef(new Map<string, HTMLButtonElement>());
    const backRef = React.useRef<HTMLButtonElement | null>(null);
    // Where focus goes when the view changes: the Back button on the way in, the
    // person's row on the way out. Without it the focused button unmounts and
    // focus falls to the page.
    const focusTarget = React.useRef<"back" | { row: string; } | null>(null);

    // Dim every other tile while an editor is open, and stop when it closes, when
    // the person leaves, or when the popover goes.
    React.useEffect(() => { setEditingUserId(editingId); }, [editingId]);
    React.useEffect(() => () => setEditingUserId(null), []);

    // A person who left while their editor was open: back to the list, and do not
    // reopen the editor if they come back.
    React.useEffect(() => {
        if (openId !== null && open === null) setOpenId(null);
    }, [openId, open]);

    React.useEffect(() => {
        const target = focusTarget.current;
        if (target === null) return;
        const node = target === "back" ? backRef.current : rows.current.get(target.row);
        if (!node) return;
        focusTarget.current = null;
        node.focus({ preventScroll: true });
    }, [open]);

    function openPerson(id: string): void {
        focusTarget.current = "back";
        setOpenId(id);
    }

    function back(): void {
        if (openId !== null) focusTarget.current = { row: openId };
        setOpenId(null);
    }

    if (open) return <PersonEditor person={open} guildId={guildId} backRef={backRef} onBack={back} />;

    const options = presetOptions(config.presets);

    return (
        <>
            <div className="vc-limelight-people">
                <div className="vc-limelight-section-label vc-limelight-people-label">In this call / {people.length}</div>
                {people.map(person => {
                    const { theme, own } = themeFor(config, person.id);
                    const preset = own ? matchingPreset(theme, config.presets) : null;
                    return (
                        <div key={person.id} className="vc-limelight-person-card">
                            <PersonRow
                                person={person}
                                guildId={guildId}
                                theme={theme}
                                own={own}
                                preset={preset}
                                onOpen={() => openPerson(person.id)}
                                rowRef={node => {
                                    if (node) rows.current.set(person.id, node);
                                    else rows.current.delete(person.id);
                                }}
                            />
                            {/* Hands out a preset without opening the person: a copy, so
                                editing the preset later never changes them */}
                            <Select
                                label={`Preset for ${person.name || "this person"}`}
                                placeholder={options.length ? "Choose a preset" : "No presets yet"}
                                value={preset?.id ?? null}
                                options={options}
                                disabled={options.length === 0}
                                onChange={id => {
                                    const chosen = config.presets.find(p => p.id === id);
                                    if (chosen) updateConfig(draft => { draft.people[person.id] = copyTheme(chosen.theme); });
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            <p className="vc-limelight-caption vc-limelight-footnote">
                Only people in this call are listed. A theme you give someone is saved, and comes back whenever they are in a call with you.
            </p>
        </>
    );
}
