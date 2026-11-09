/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Every place Limelight changes Discord's code, as data. index.tsx registers
// them; tools/verify-patches.mjs checks each against Discord's real code on
// every build. Finds are literals that minification cannot rename.

export const HOOK = { tiles: "tiles", fold: "fold", watch: "watch", badge: "badge", tray: "tray", precall: "precall", chat: "chat", mention: "mention", invite: "invite", alone: "alone", grid: "grid", foldButton: "foldButton" } as const;

export const patches = [
    {
        // Tiles (anchors-tiles.md 1 and 7): marker classes on every tile, the pill
        // beside Discord's overlay, and a stable class on the tile's root.
        hook: HOOK.tiles,
        find: "displayName=\"CallTile\"",
        group: true,
        replacement: [
            {
                match: /(?<=\{participant:(\i),popoutType:.+?)className:(\i\(\)\(\i\.\i,\{[^}]+\}\)),noBorder:(\i),style:(\i),participantUserId:/,
                replace: "className:$self.tileClass($2,$1),noBorder:$3,style:$4,participantUserId:"
            },
            {
                match: /(?<=:\(0,\i\.jsx\)\()(\i),\{(?=focused:\i,width:\i,inCall:\i,participantId:\i\.id,participantType:)/,
                replace: "$self.CallTileOverlay,{Original:$1,"
            },
            {
                match: /(?<=\{participant:(\i),popoutType:.+?)className:(\i\(\)\(\i\.\i,\{\[\i\.\i\]:\i\},\i\)),style:(\i),onMouseEnter:/,
                replace: "className:$self.slotClass($2,$1),style:$3,onMouseEnter:"
            }
        ]
    },
    {
        // One tile per person (anchors.md 4, revised): fold the grid's list.
        hook: HOOK.fold,
        find: ".participants.some(",
        replacement: {
            match: /(?<=\{participants:(\i),filteredParticipants:.+?\i=\i\.useMemo\(\(\)=>)(\i\.filter\(\i=>\i\.type!==\i\.\i\.ACTIVITY\|\|!\i\.participants\.some\(\i=>\(0,\i\.\i\)\(\i\)\)\))(?=,\[)/,
            replace: "$self.foldStreams($2,$1)"
        }
    },
    {
        // Watch Stream plays in the tile (anchors-tiles.md 5, replacements 1 and 2).
        hook: HOOK.watch,
        find: "_callContainerRef",
        group: true,
        replacement: [
            {
                match: /(?<=selectedParticipant:(\i),.+?)(\(0,\i\.\i\)\(\(0,\i\.\i\)\((\i)\.id\),\{forceMultiple:(\i)\.shiftKey)\}\)/,
                replace: "$2,noFocus:$self.skipFocus($3,$1)})"
            },
            {
                match: /(?<=selectedParticipant:(\i),allActiveStreams:(\i),.+?)(\i&&\i===\i\.\i\.VIDEO&&)(?=\(\i\?\.id===(\i)\.id\?)/,
                replace: "$3$self.shouldToggleSelect($4,$2,$1)&&"
            }
        ]
    },
    {
        // The maximised stream shows Discord's LIVE and quality badge while the
        // pointer is active (anchors-tiles.md 5, badge gate).
        hook: HOOK.badge,
        find: "StreamTile",
        replacement: {
            match: /(?<=idle:(\i),width:\i,premiumIndicator:\i\}=.+?children:\[\i\|\|\i\?null:\(0,\i\.jsx\)\(\i\.\i,\{participant:\i\}\),)(\i)(?=\|\|null==\i\|\|\i\.state===\i\.\i\.ENDED\|\|\i\.state===\i\.\i\.FAILED\?null:)/,
            replace: "$self.hideBadge($2,$1)"
        }
    },
    {
        // The palette button before the "more" button (anchors.md 5).
        hook: HOOK.tray,
        find: "CenterControlTray: currentUser cannot be undefined",
        replacement: {
            match: /(\(0,\i\.jsx\)\(\i\.\i,\{channel:(\i),whichPopoutIsOpen:\i,setWhichPopoutIsOpen:\i,remoteMode:\i\}\))/,
            replace: "$self.renderPaletteButton($2),$1"
        }
    },
    {
        // The screen Discord shows before you join a voice channel (its own name
        // for it is ChannelCallEmpty). (a) marks the root so every rule is scoped,
        // (b) lets a chosen look replace Discord's animated background, (c) puts
        // the Limelight button beside Join Voice, made with the same Button.
        // Not grouped: each replacement fails on its own, so one that stops
        // matching costs only its part and never Join Voice. (a) runs before (b)
        // because its lookahead reads the original background call.
        hook: HOOK.precall,
        find: "\"ChannelCallEmpty\"",
        replacement: [
            {
                match: /(?<="div",\{className:)(\i\.\i)(?=,children:\[\(0,\i\.jsx\)\(\i\.\i,\{disableAnimation:)/,
                replace: "$self.preCallClass($1)"
            },
            {
                match: /\(0,\i\.jsx\)\((\i\.\i),\{disableAnimation:(\i)\}\)/,
                replace: "$self.renderPreCallBackground($1,$2)"
            },
            {
                match: /\(0,\i\.jsx\)(?=\(\i\.\i,\{variant:"overlay-primary")/,
                replace: "$self.renderPreCallButtons"
            }
        ]
    },
    {
        // The call chat (CallChatSidebar): its title becomes the channel picker,
        // and its upload area and chat show the picked channel. Grouped: the
        // three apply together or not at all, so the title, the drop target and
        // the composer can never point at different channels.
        //
        // Found by its sidebar type together with its floating layer, in either
        // order. In October 2026 Discord added another screen that reuses the
        // CallChatSidebar type without a floating layer; the old plain-text find
        // matched it too, and whichever loaded first used the patch up, so the
        // picker vanished. all: true means a future lookalike can never use it up
        // again: every module that matches is tried, and in any module where the
        // three replacements do not all match, the group leaves it untouched.
        hook: HOOK.chat,
        find: /\.CallChatSidebar,[^{}]{0,80}?floatingLayer:|floatingLayer:[^{}]{0,80}?\.CallChatSidebar\b/,
        all: true,
        group: true,
        replacement: [
            {
                match: /\(0,\i\.jsx\)\((\i\.\i),\{channel:(\i),draftType:(\i\.\i\.ChannelMessage)\}\)/,
                replace: "$self.renderCallChatUpload($1,{channel:$2,draftType:$3})"
            },
            {
                // The channel comes from the component's props, wherever it sits in them
                match: /(?<=let\{(?:[^{}]*?,)?channel:(\i)[^{}]*?\}=\i.+?)children:\[\(0,\i\.jsx\)\((\i\.\i)\.ChannelIcon,\{icon:(\i\.ChatIcon),"aria-label":([^{}]+?)\}\),\(0,\i\.jsx\)\(\i\.\i\.Title,\{children:(\i)\}\)\]/,
                replace: "children:$self.renderCallChatHeading({Header:$2,icon:$3,iconLabel:$4,name:$5,channel:$1})"
            },
            {
                match: /\(0,\i\.jsx\)\((\i\.\i),\{channel:(\i),guild:(\i),chatInputType:(\i\.\i)\.SIDEBAR\},\i\.id\)/,
                replace: "$self.renderCallChatBody($1,{channel:$2,guild:$3},$4)"
            }
        ]
    },
    {
        // A channel link clicked inside the call chat opens there instead of
        // leaving the call. The check runs first in the mention's click handler;
        // anywhere else, or for anything but a pickable channel, it declines and
        // Discord's own handler carries on. VoiceChatDoubleClick rewrites the
        // onClick that calls this handler, not the handler, so both apply.
        hook: HOOK.mention,
        find: "className:\"channelMention\",children:[null!=",
        replacement: {
            match: /(?<=react\((\i),\i,\i\)\{let \i=\i\.\i\.getChannel\(\i\.channelId\),\i=\i\.noStyleAndInteraction\?void 0:\i=>\{)/,
            replace: "if($self.openMentionInCallChat($1))return;"
        }
    },
    {
        // The Invite to Voice row under the people in your voice channel. It goes
        // through Limelight's gate, which draws Discord's own row unless Hide invite
        // prompts is on. The key stays Discord's. The same text is the row's own
        // popoutKey in another module, so the find includes the closing brace of the
        // props before it, which only the list has.
        hook: HOOK.invite,
        find: "},\"voice-invite-suggestions-button\")",
        replacement: {
            match: /\(0,(\i\.jsx)\)\((\i\.\i),\{(channel:\i,onClose:\i)\}(?=,"voice-invite-suggestions-button"\))/,
            replace: "(0,$1)($self.InvitePromptRow,{Original:$2,$3}"
        }
    },
    {
        // The tile Discord adds beside yours when you're the only one in a server
        // voice channel (Invite to Voice and Choose Activity). One more term on the
        // condition that adds it, so with Hide invite prompts on it never reaches the
        // grid and your tile is laid out alone. The term is read into a constant at
        // the start of the statement: the component has no early return, so the hook
        // runs on every render. The group call's activity tile is left alone. One
        // replacement, so the constant is never used without being declared.
        hook: HOOK.alone,
        find: "\"empty-tile\"",
        replacement: {
            match: /(?<=;)(null!=\i&&!\i&&!\i\.isGuildStageVoice\(\)&&\(.+?:\i&&1===\i&&\i)(?=&&\i\.push\()/,
            replace: "const limelightHideAlone=$self.useHideInvitePrompts();$1&&!limelightHideAlone"
        }
    },
    {
        // Small tiles (logic/gridLayout.ts): the same module hands its grid to
        // Limelight, with the grid's props and the participants in the order its
        // tiles render. With nobody small, Limelight renders Discord's grid exactly
        // as it was; otherwise Discord's grid twice, the small tiles in a strip.
        // After the alone patch, which leaves this part of the module alone.
        hook: HOOK.grid,
        find: "\"empty-tile\"",
        replacement: {
            match: /(?<=(\i)\[\i\]\?\.id\?\?"empty-tile",\[\i\]\);)return\(0,\i\.jsx\)\((\i\.\i),(\{className:\i,keyExtractor:\i,paddingTop:\d+,paddingBottom:\d+,children:\i\})\)/,
            replace: "return $self.renderGrid($2,$3,$1)"
        }
    },
    {
        // The call view's bottom-left controls (Discord's Invite and the chat arrow),
        // which Discord renders only in a call and never on a Stage. Limelight puts
        // its « » channel list button before them, and while the list is folded a
        // spacer the width of the floating user section, so nothing sits under it.
        // Discord's own element is passed whole and always rendered.
        hook: HOOK.foldButton,
        find: "renderBottomLeft=()=>{",
        replacement: {
            match: /(?<=renderBottomLeft=\(\)=>\{.{0,400}?return!\i\|\|\i\.isGuildStageVoice\(\)\?null:)\(0,\i\.jsx\)\(\i,\{layout:\i,channel:\i,[^{}]*?\}\)/,
            replace: "$self.renderBottomLeft($&)"
        }
    }
];

// Lazy finders, checked offline beside the patches (tools/verify-patches.mjs).
// PaletteButton takes its arguments from here, so the checked strings are the
// shipped strings.
export const pluginName = "Limelight";

export const finders = {
    trayButton: { kind: "code", strings: ["isTrayButton:", "applyStyles:"] },
    // Loads a channel's recent messages, as opening the channel does
    messageFetch: { kind: "props", props: ["fetchMessages", "jumpToMessage"] },
    idleContext: { kind: "unchecked", reason: "found by shape: a context whose value has onPreventIdle, onAllowIdle, onForceIdle and onActive" }
} as const;
