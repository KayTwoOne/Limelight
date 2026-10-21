/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The palette button in the call's control tray and the 420px popover it opens
// (spec 6.1 and 6.2, tokens.md 5.1 to 5.4). The button is Discord's own tray
// button with Limelight's glyph; the popover is Discord's Popout with a focus
// lock, so Escape and outside clicks close it as they close the soundboard.

import ErrorBoundary from "@components/ErrorBoundary";
import { find, findComponentByCodeLazy } from "@webpack";
import { FocusLock, Popout, React } from "@webpack/common";
import { type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { finders } from "../patches";
import { CloseIcon, LimelightMark, PaletteIcon } from "../tiles/icons";
import { ChatTab } from "./ChatTab";
import { DisplayControls } from "./DisplayControls";
import { EveryoneTab } from "./EveryoneTab";
import { PeopleTab } from "./PeopleTab";
import { PreCallTab } from "./PreCallTab";

// Lazy, so nothing is looked up until the first render. Both strings are
// destructured prop names in the component (anchors-panel-chat.md 1), so the
// minifier cannot rename them; together they pick the full tray button and not
// the bare inner button.
const TrayButton = findComponentByCodeLazy<any>(...finders.trayButton.strings);

// Discord's idle context: the call's IdleProvider supplies onPreventIdle(reason)
// and onAllowIdle(reason), which keep a set of reasons while the call's controls
// stay visible instead of idle-hiding. Idle-hiding would pull the tray, and the
// popover's anchor, away under the open panel. The context is found by its
// shape (the four callback names are object keys the minifier cannot rename)
// and not by looking up Discord's idle component by its code: that lookup began
// matching a different component after a Discord update and crashed on render.
// The real context object is used, not a lazy proxy, because React compares
// context identity. It is resolved at render time and cached once found. A miss
// is indirect (no log, no dev-build throw) and is caught, so it can never throw
// out of the component.
interface IdleCallbacks {
    onAllowIdle(reason: string): void;
    onPreventIdle(reason: string): void;
}

const IDLE_REASON = "limelight-palette";

let idleContext: React.Context<IdleCallbacks> | null = null;
let inertIdleContext: React.Context<IdleCallbacks> | null = null;

function isIdleContext(m: any) {
    const value = m?._currentValue;
    return typeof value?.onPreventIdle === "function"
        && typeof value.onAllowIdle === "function"
        && typeof value.onForceIdle === "function"
        && typeof value.onActive === "function";
}

function findIdleContext(): React.Context<IdleCallbacks> | null {
    if (idleContext) return idleContext;
    try {
        idleContext = find(isIdleContext, { isIndirect: true }) ?? null;
    } catch {
        idleContext = null;
    }
    return idleContext;
}

// What KeepTrayAwake reads when the context was not found, so its hooks run in
// the same order either way. Created on first use, never at module scope, since
// React is not available until the client has loaded.
function getInertIdleContext() {
    return inertIdleContext ??= React.createContext<IdleCallbacks>({
        onAllowIdle: () => { },
        onPreventIdle: () => { }
    });
}

// Holds the call's controls awake while the popover is open. It renders nothing.
// It asks under Limelight's own reason, so closing the popover never clears
// Discord's own "popup" reason. A context that was not found makes it inert, and
// a failure here stays in its own boundary instead of taking the popover with it.
// The callbacks are read through a ref so an unstable callback identity from the
// provider cannot re-run the effect.
function KeepTrayAwake() {
    const context = React.useMemo(() => findIdleContext() ?? getInertIdleContext(), []);
    const idle = React.useContext(context);
    const idleRef = React.useRef(idle);
    idleRef.current = idle;

    React.useEffect(() => {
        idleRef.current.onPreventIdle(IDLE_REASON);
        return () => idleRef.current.onAllowIdle(IDLE_REASON);
    }, []);

    return null;
}

const TABS = [
    { id: "people", label: "People" },
    { id: "everyone", label: "Everyone" },
    { id: "chat", label: "Chat" },
    { id: "precall", label: "Pre-call" },
    { id: "display", label: "Display" }
] as const;

type TabId = typeof TABS[number]["id"];

// The tab the popover last showed, kept for when it is closed and reopened (the
// popover's own state is gone once it closes). A plain variable: it needs no
// React and survives the tray being rebuilt.
let rememberedTab: TabId = "people";

interface PaletteTrayProps {
    isShown: boolean;
    onClick(event: unknown): void;
    targetRef: RefObject<HTMLSpanElement | null>;
}

// The button and the span Limelight owns around it. The span is the Popout's
// target: Discord's tray drops its own wrapper below 456px, so the target cannot
// be the wrapper.
function PaletteTray({ isShown, onClick, targetRef }: PaletteTrayProps) {
    // Discord's tray button forwards a fixed list of props and not the rest, so
    // the expanded state is written onto the button it rendered.
    React.useEffect(() => {
        const button = targetRef.current?.querySelector("button");
        if (!button) return;
        button.setAttribute("aria-expanded", String(isShown));
        button.setAttribute("aria-haspopup", "dialog");
    }, [isShown, targetRef]);

    return (
        <span ref={targetRef} className="vc-limelight-tray" data-open={isShown}>
            <TrayButton
                isTrayButton
                color="primaryDark"
                isActive={isShown}
                shouldShowTooltip={!isShown}
                label="Limelight"
                aria-label="Limelight: customise this call"
                iconComponent={PaletteIcon}
                iconClassName="vc-limelight-tray-icon"
                onClick={onClick}
            />
        </span>
    );
}

interface PopoverProps {
    onClose(): void;
    // The tab to open on, for a button that belongs to one tab (the pre-call
    // screen's). Without it the popover opens on the tab last shown. It is only
    // where this opening starts: the remembered tab changes when the person picks
    // a tab, not when the popover opens.
    initialTab?: TabId;
}

export function Popover({ onClose, initialTab }: PopoverProps) {
    const panelRef = React.useRef<HTMLDivElement>(null);
    const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const firstTab = React.useRef<TabId>(initialTab ?? rememberedTab);
    const [tab, setTab] = React.useState<TabId>(firstTab.current);
    const base = React.useId();

    // Focus enters the popover on the selected tab. Discord's focus lock hands
    // focus back to where it was when the popover unmounts.
    React.useEffect(() => {
        const frame = requestAnimationFrame(() => {
            tabRefs.current[TABS.findIndex(t => t.id === firstTab.current)]?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    function select(id: TabId): void {
        rememberedTab = id;
        setTab(id);
    }

    // Arrow keys move between tabs and select as they go; Home and End jump.
    function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
        let next: number;
        switch (event.key) {
            case "ArrowRight": next = (index + 1) % TABS.length; break;
            case "ArrowLeft": next = (index + TABS.length - 1) % TABS.length; break;
            case "Home": next = 0; break;
            case "End": next = TABS.length - 1; break;
            default: return;
        }
        event.preventDefault();
        select(TABS[next].id);
        tabRefs.current[next]?.focus();
    }

    return (
        <FocusLock containerRef={panelRef}>
            <div className="vc-limelight-popover" ref={panelRef} role="dialog" aria-label="Limelight">
                <div className="vc-limelight-header">
                    <div className="vc-limelight-brand">
                        <LimelightMark />
                        <span className="vc-limelight-wordmark">Limelight</span>
                    </div>
                    <button type="button" className="vc-limelight-close" aria-label="Close Limelight" onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>

                <div className="vc-limelight-tabs" role="tablist" aria-label="Limelight sections">
                    {TABS.map(({ id, label }, index) => (
                        <button
                            key={id}
                            ref={node => { tabRefs.current[index] = node; }}
                            type="button"
                            role="tab"
                            className="vc-limelight-tab"
                            id={`${base}-tab-${id}`}
                            aria-selected={tab === id}
                            aria-controls={`${base}-panel`}
                            tabIndex={tab === id ? 0 : -1}
                            onClick={() => select(id)}
                            onKeyDown={event => onTabKey(event, index)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="vc-limelight-body" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${tab}`}>
                    {renderTab(tab)}
                </div>

                <ErrorBoundary noop>
                    <KeepTrayAwake />
                </ErrorBoundary>
            </div>
        </FocusLock>
    );
}

// Each tab's content, in its own boundary so one tab failing leaves the popover
// and its other tabs working.
function renderTab(tab: TabId): ReactNode {
    switch (tab) {
        case "people":
            return <ErrorBoundary noop><PeopleTab /></ErrorBoundary>;
        case "everyone":
            return <ErrorBoundary noop><EveryoneTab /></ErrorBoundary>;
        case "chat":
            return <ErrorBoundary noop><ChatTab /></ErrorBoundary>;
        case "precall":
            return <ErrorBoundary noop><PreCallTab /></ErrorBoundary>;
        case "display":
            return <ErrorBoundary noop><DisplayControls /></ErrorBoundary>;
    }
}

interface PaletteButtonProps {
    // The call's channel, handed over by the tray. Unused: the People tab reads
    // the voice channel from the store, so it follows the call and not the tray.
    channel: unknown;
}

export function PaletteButton(_props: PaletteButtonProps) {
    const targetRef = React.useRef<HTMLSpanElement>(null);

    return (
        <Popout
            position="top"
            align="center"
            spacing={16}
            animation={Popout.Animation.FADE}
            targetElementRef={targetRef}
            renderPopout={({ closePopout }) => (
                <ErrorBoundary noop>
                    <Popover onClose={closePopout} />
                </ErrorBoundary>
            )}
        >
            {({ onClick }, { isShown }) => <PaletteTray isShown={isShown} onClick={onClick} targetRef={targetRef} />}
        </Popout>
    );
}

// What the tray patch inserts: the button inside its own error boundary, so a
// failure here can never reach Discord's tray.
export function paletteElement(channel: unknown): ReactNode {
    return (
        <ErrorBoundary noop key="vc-limelight-palette">
            <PaletteButton channel={channel} />
        </ErrorBoundary>
    );
}
