/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The one stylesheet Limelight owns. Every theme and Display setting reaches
// the page through it, so edits apply live without re-rendering Discord. Pure.

import { rgba } from "./colour";
import { type Background, DISCORD_GREEN, type LimelightConfig, PRESET_GREY } from "./config";
import { lightestOf, scrimAlpha } from "./scrim";
import { backgroundCss, CORNER_PX, FOLLOW_WASH_ALPHA, FOLLOW_WASH_HEX, SPOTLIGHT_OPACITY, stageCss, stageLightest, stagePeak } from "./theme";

export const CALL = "[class*=\"callContainer_\"]:not([class*=\"callContainer__\"])";
export const TILE = ".limelight-tile";
export const TILE_BG = "[class*=\"content__\"] > [class*=\"background_\"]";
export const GAP_DELTA_PX = { tight: 5, normal: 0, airy: -10 } as const;

// The pre-call screen (shown before you join a voice channel). PRECALL is the
// marker the patch puts on its root; PRECALL_STAGE is the element the patch adds
// behind the screen's content. The stage's position, size and stacking are in the
// static stylesheet, so this sheet only ever paints it. Both sheets name the stage
// as a child of the marked root, so if the marker is missing (its replacement
// stopped matching) the stage is an empty, unpainted element and covers nothing.
export const PRECALL = ".limelight-precall";
export const PRECALL_STAGE = ".vc-limelight-precall-stage";

// The call view's wrapper: the stage is set here so it runs unbroken under the
// call and under the chat column (anchors-panel-chat.md 4, risk 1).
export const CALL_WRAPPER = `[class*="wrapper_"]:has(> ${CALL})`;
// The call chat's scope root. The chat is portalled out of channelChatWrapper_ into
// the layer container beside the call wrapper, so this is the one selector that
// reaches the call chat and no text channel (anchors-panel-chat.md 4).
export const CHAT_ROOT = "[class*=\"layerContainer_\"] > [class*=\"chatLayerWrapper_\"]";
// The visible sidebar card (not the hidden placeholder) and its header.
export const CHAT_SIDE = `${CHAT_ROOT} > [class*="container_"]:not([class*="chatTarget_"])`;
export const CHAT_HEAD = `${CHAT_SIDE} > section[class*="container_"]`;
// The gap the grid shows between tiles for each Tile spacing setting: Discord's
// own 8px less GAP_DELTA_PX. "As a tile" pads the chat by the same amount.
export const VISIBLE_GAP_PX = { tight: 3, normal: 8, airy: 18 } as const;

// Chat surfaces (tokens.md 7.1, 7.5).
const FOLLOW_WASH = rgba(FOLLOW_WASH_HEX, FOLLOW_WASH_ALPHA);
const GLASS = "rgba(30, 31, 34, 0.84)";
const SEAMLESS_FADE = "linear-gradient(90deg, transparent 0, #000000 64px)";
const HEADER_RULE = "rgba(255, 255, 255, 0.06)";

const SNOWFLAKE = /^\d{15,21}$/;

export interface SheetInput {
    config: LimelightConfig;
    imageUrl(imageId: string): string | null;
    // The colours sampled when an image was stored: the stage tint and the scrim
    // read them. Null while the image is still being read.
    imageAverage(imageId: string): string | null;
    imageLightest(imageId: string): string | null;
    editingUserId: string | null;
}

// What the pre-call screen's colours depend on: the config and the stored images'
// URL and sampled colours. A SheetInput is one; so is what the Limelight button
// reads, which has no use for the rest.
export type PreCallInput = Pick<SheetInput, "config" | "imageUrl" | "imageAverage" | "imageLightest">;

function css(bg: Background, input: PreCallInput): string | null {
    return backgroundCss(bg, bg.type === "image" && bg.imageId ? input.imageUrl(bg.imageId) : null);
}

// The Everyone image's average colour once it has been read: the stage tint reads
// it. Null for any other background, and while the image is still being read.
export function everyoneAverage(input: PreCallInput): string | null {
    const bg = input.config.everyone.background;
    return bg.type === "image" && bg.imageId ? input.imageAverage(bg.imageId) : null;
}

// The lightest colour of an Own background, which the scrim is sized for.
function ownLightest(bg: Background, input: PreCallInput): string | null {
    return lightestOf(bg, bg.type === "image" && bg.imageId ? input.imageLightest(bg.imageId) : null);
}

// The stage and chat looks (spec 8, tokens.md 7). The Discord look emits nothing,
// so G5 holds. Every selector is under the call wrapper or the call chat scope
// root. An Own background that is an image still being read emits nothing either:
// chat stays as Discord draws it until the picture arrives.
function chatRules(input: SheetInput): string[] {
    const { chat, everyone, display } = input.config;
    if (chat.look === "discord") return [];

    const rules: string[] = [];
    let surface: string;
    // Follow grid only: the stage is one picture shared by the call and the chat, so
    // every layer that paints it is attached to the viewport and the copies line up.
    // The attachment has to sit on the element that paints (a custom property
    // cannot carry it), which for the chat is the sidebar card or its fade layer.
    let fixed = "";
    // Black, because scrimAlpha measures contrast against black mixed in.
    const scrimOf = (a: number) => `linear-gradient(rgba(0, 0, 0, ${a}), rgba(0, 0, 0, ${a}))`;
    let scrim: string;
    if (chat.look === "follow") {
        const average = everyoneAverage(input);
        const stage = stageCss(everyone, average);
        // The stage is on the wrapper; the call container (black) and the column
        // that holds the chat's place stop painting over it.
        rules.push(`${CALL_WRAPPER}{background:${stage};background-attachment:fixed}`);
        rules.push(`${CALL}{background:transparent}`);
        rules.push(`${CALL_WRAPPER} > [class*="channelChatWrapper_"]{background:transparent}`);
        surface = `linear-gradient(${FOLLOW_WASH}, ${FOLLOW_WASH}), ${stage}`;
        fixed = ";background-attachment:fixed";
        // Sized for the stage's lightest point; a dark stage needs none.
        const alpha = scrimAlpha(stageLightest(everyone, average));
        scrim = alpha > 0 ? scrimOf(alpha) : "transparent";
    } else {
        const own = css(chat.own, input);
        if (!own) return [];
        surface = own;
        scrim = scrimOf(scrimAlpha(ownLightest(chat.own, input)));
    }

    // Discord paints each chat surface with background: var(--background-gradient-X,
    // fallback), so redefining them on the root re-themes every surface inside it.
    rules.push(`${CHAT_ROOT}{--background-gradient-app-frame:${surface};--background-gradient-chat:${scrim};--background-gradient-lower:${scrim};--__header-bar-background:${scrim};--background-gradient-highest:${GLASS}}`);

    // The composer sits beside the control island: its radius family and glass.
    rules.push(`${CHAT_ROOT} [class*="channelTextArea_"]{border-radius:14px;border-color:rgba(255, 255, 255, 0.05)}`);
    rules.push(`${CHAT_ROOT} [class*="scrollableContainer_"]{border-radius:inherit;backdrop-filter:blur(10px)}`);
    rules.push(`${CHAT_ROOT} [class*="chatGradient"],${CHAT_ROOT} [class*="chatTypingGradient"],${CHAT_ROOT} [class*="formWithLoadedChatInput_"]::before{display:none}`);

    switch (chat.join) {
        case "seamless":
            // The surface moves to a layer behind the content so only it fades.
            rules.push(`${CHAT_SIDE}{position:relative;isolation:isolate;background:none;border-color:transparent;border-radius:0!important;box-shadow:none}`);
            rules.push(`${CHAT_HEAD}{border-color:transparent}`);
            rules.push(`${CHAT_SIDE}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--background-gradient-app-frame)${fixed};mask-image:${SEAMLESS_FADE}}`);
            break;
        case "tile": {
            // The radius variable lives on the call container, which the chat is not
            // inside, so a changed corner setting is repeated here.
            const radius = display.corners !== "discord" ? `;--custom-base-tile-border-radius:${CORNER_PX[display.corners]}px` : "";
            rules.push(`${CHAT_ROOT}{padding:${VISIBLE_GAP_PX[display.spacing]}px;box-sizing:border-box${radius}}`);
            rules.push(`${CHAT_SIDE}{overflow:hidden;border-color:transparent;border-radius:var(--custom-base-tile-border-radius, 8px)!important;box-shadow:0 0 0 1px rgba(255, 255, 255, 0.07), 0 18px 40px rgba(0, 0, 0, 0.35)${fixed}}`);
            rules.push(`${CHAT_HEAD}{border-color:${HEADER_RULE}}`);
            break;
        }
        case "line":
            rules.push(`${CHAT_SIDE}{border-color:transparent;border-inline-start:1px solid var(--border-subtle);border-radius:0!important;box-shadow:none${fixed}}`);
            rules.push(`${CHAT_HEAD}{border-color:${HEADER_RULE}}`);
            break;
    }
    return rules;
}

// How dark the pre-call screen's centre scrim is, 0 where none is painted: the
// Discord look, an Own image still being read, and any backdrop dark enough to
// need none. The stylesheet below paints exactly this, and the Limelight button
// reads it too, since the button sits inside the scrim and must stand out against
// the colours as shaded. It is sized from the backdrop's lightest colour: for
// Follow grid the stage's own peak (see preCallRules), for Own the background's
// lightest.
export function preCallScrimAlpha(input: PreCallInput): number {
    const { preCall, everyone } = input.config;
    if (preCall.look === "discord") return 0;
    if (preCall.look === "follow") return scrimAlpha(stagePeak(everyone, everyoneAverage(input)));
    if (!css(preCall.own, input)) return 0;
    return scrimAlpha(ownLightest(preCall.own, input));
}

// The pre-call screen's backdrop. The Discord look emits nothing, so G5 holds and
// the default config writes no rule that names these selectors. Follow grid paints
// the Everyone stage; Own paints its own background, and an image still being read
// emits nothing, so Discord's screen stays until the picture arrives. Both lay a
// scrim behind the join card, darkest at its centre and fading to nothing at the
// edge, sized for the backdrop's lightest colour so the card's text keeps 4.5:1
// while the rest of the picture is left as it is. A dark backdrop needs none. The
// stage is painted bare here, without the wash the chat lays over it, so Follow
// grid is sized from the stage's own peak and not from stageLightest, which is
// the chat's washed (darker) version and would leave a bright theme under-scrimmed.
function preCallRules(input: SheetInput): string[] {
    const { preCall, everyone } = input.config;
    if (preCall.look === "discord") return [];

    let paint: string;
    if (preCall.look === "follow") {
        paint = stageCss(everyone, everyoneAverage(input));
    } else {
        const own = css(preCall.own, input);
        if (!own) return [];
        paint = own;
    }

    const alpha = preCallScrimAlpha(input);
    const scrim = alpha > 0 ? `radial-gradient(closest-side at 50% 52%, rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, 0)), ` : "";
    return [`${PRECALL} > ${PRECALL_STAGE}{background:${scrim}${paint}}`];
}

export function buildSheet(input: SheetInput): string {
    const { display, everyone, people } = input.config;
    const ids = Object.keys(people);
    const rules: string[] = [];

    const call = [`--ll-zoom:${display.gridZoom / 100}`];
    if (display.corners !== "discord") call.push(`--custom-base-tile-border-radius:${CORNER_PX[display.corners]}px`);
    if (GAP_DELTA_PX[display.spacing] !== 0) call.push(`--ll-gap-delta:${GAP_DELTA_PX[display.spacing]}px`);
    rules.push(`${CALL}{${call.join(";")}}`);

    if (display.disableUserThemes) {
        rules.push(`${TILE} ${TILE_BG}{background:${PRESET_GREY}!important}`);
        rules.push(`${TILE}{--ll-spot:0}`);
    } else {
        const everyoneCss = css(everyone.background, input);
        if (everyoneCss) {
            // One :not() holding every Profile person scores as a single class,
            // so a person's own rule (emitted later) always beats Everyone's.
            // A :not() per person would add a class each and outrank it.
            const profileIds = ids.filter(id => css(people[id].background, input) === null);
            const keepProfile = profileIds.length > 0 ? `:not(${profileIds.map(id => `.ll-u-${id}`).join(", ")})` : "";
            rules.push(`${TILE}${keepProfile} ${TILE_BG}{background:${everyoneCss}!important}`);
        }
        rules.push(`${TILE}{--ll-spot:${SPOTLIGHT_OPACITY[everyone.spotlight]}}`);
        for (const id of ids) {
            const own = css(people[id].background, input);
            if (own) rules.push(`${TILE}.ll-u-${id} ${TILE_BG}{background:${own}!important}`);
            rules.push(`${TILE}.ll-u-${id}{--ll-spot:${SPOTLIGHT_OPACITY[people[id].spotlight]}}`);
        }
    }

    if (everyone.ring !== DISCORD_GREEN) rules.push(`${TILE}{--status-speaking:${everyone.ring};--ll-ring:${everyone.ring}}`);
    for (const id of ids) {
        const { ring } = people[id];
        if (ring !== everyone.ring) rules.push(`${TILE}.ll-u-${id}{--status-speaking:${ring};--ll-ring:${ring}}`);
    }

    if (input.editingUserId && SNOWFLAKE.test(input.editingUserId)) {
        rules.push(`${TILE}:not(.ll-u-${input.editingUserId}){filter:brightness(0.42)}`);
    }

    rules.push(...chatRules(input));
    rules.push(...preCallRules(input));

    return rules.join("\n");
}
