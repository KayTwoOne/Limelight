/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Limelight's own glyphs. The pill glyphs (tokens.md 2.5) are 16px, a 24 unit
// viewBox, stroke #c9ccd1 at width 2 with round caps and joins; each carries its
// accessible name and the pill's size comes from CSS. The panel glyphs at the
// foot of the file take their colour from the CSS that places them. Every path
// is the mockup's.

import { type ReactNode } from "react";

interface GlyphProps {
    label?: string;
    className?: string;
    children: ReactNode;
}

function Glyph({ label, className, children }: GlyphProps) {
    return (
        <svg
            className={className ? `ll-pill-icon ${className}` : "ll-pill-icon"}
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c9ccd1"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            role={label ? "img" : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            {children}
        </svg>
    );
}

export function StreamingIcon() {
    return (
        <Glyph label="Streaming">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
        </Glyph>
    );
}

export function MutedIcon() {
    return (
        <Glyph label="Muted">
            <path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8" />
            <path d="M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.4 6.1M12 18v3" />
            <path d="M3 3l18 18" />
        </Glyph>
    );
}

export function DeafenedIcon() {
    return (
        <Glyph label="Deafened">
            <path d="M4 15v-3a8 8 0 0 1 13.7-5.6M20 12v3" />
            <rect x="3" y="15" width="4" height="6" rx="1.5" />
            <rect x="17" y="15" width="4" height="6" rx="1.5" />
            <path d="M3 3l18 18" />
        </Glyph>
    );
}

export function MobileIcon() {
    return (
        <Glyph label="On mobile">
            <rect x="7" y="2" width="10" height="20" rx="2" />
            <path d="M11 18h2" />
        </Glyph>
    );
}

export function ConsoleIcon() {
    return (
        <Glyph label="On console">
            <path d="M7 8h10a5 5 0 0 1 4.9 6l-.6 3a2.5 2.5 0 0 1-4.3 1.2L15 16H9l-2 2.2A2.5 2.5 0 0 1 2.7 17l-.6-3A5 5 0 0 1 7 8z" />
            <path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01" />
        </Glyph>
    );
}

// The end-to-end encryption shield. Discord's name plate carries this, and the
// plate is hidden where a pill exists, so the pill keeps it in Full and Compact
// (Mini keeps the avatar chip only). It is a direct child of the pill, not of the
// icon group.
export function ShieldIcon() {
    return (
        <Glyph label="End-to-end encrypted and verified" className="ll-pill-shield">
            <path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.9 7.5 9.5 4.4-1.6 7.5-4.9 7.5-9.5V6z" />
            <path d="m9 12 2.2 2.2L15.5 10" />
        </Glyph>
    );
}

// Shown in place of a game's icon while Discord has not fetched the application.
// Decorative: the activity's name is the text beside it.
export function GameGlyph() {
    return (
        <svg className="ll-pill-act-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
            <rect width="16" height="16" rx="4" fill="#404249" />
            <path d="M4.4 11.2 8 4.6l3.6 6.6z" fill="#c9ccd1" opacity="0.92" />
        </svg>
    );
}

interface PaletteIconProps {
    size?: number;
    className?: string;
    color?: string;
}

// The palette button's glyph (tokens.md 5.1, Panel.dc.html:66). Discord's tray
// button renders its iconComponent with size, className and color, so this takes
// exactly those. The lime comes from the CSS on the class it is given.
export function PaletteIcon({ size = 20, className, color = "currentColor" }: PaletteIconProps) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.3-4-7.7-9-7.7z" />
            <circle cx="7.5" cy="11.5" r="1.1" />
            <circle cx="10.5" cy="7.5" r="1.1" />
            <circle cx="15.5" cy="8" r="1.1" />
        </svg>
    );
}

// The popover header's mark (tokens.md 5.3, Popover.dc.html:22): a beam, a base
// and a head, all in the colour the CSS gives it (the lime accent). The header
// draws it at 24px; the pre-call button asks for 20px, the size Discord gives
// the icon in a button of that size, and for `strong`: drawn straight on a solid
// fill, the beam and base at their usual opacities nearly disappear, so they are
// denser there (0.5 and 0.85 rather than 0.26 and 0.7).
interface LimelightMarkProps {
    size?: number;
    className?: string;
    strong?: boolean;
}

export function LimelightMark({ size = 24, className, strong = false }: LimelightMarkProps) {
    return (
        <svg className={className ? `vc-limelight-mark ${className}` : "vc-limelight-mark"} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.1 7.4 L3.6 20.2 H20.4 L13.9 7.4 Z" fill="currentColor" opacity={strong ? 0.5 : 0.26} />
            <ellipse cx="12" cy="20.2" rx="8.4" ry="1.7" fill="currentColor" opacity={strong ? 0.85 : 0.7} />
            <circle cx="12" cy="5.2" r="2.7" fill="currentColor" />
        </svg>
    );
}

// The close button's cross (tokens.md 5.3): 18px, stroke 2.2.
export function CloseIcon() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    );
}

// The custom swatch's plus (tokens.md 5.9): 16px, stroke 2.6.
export function PlusIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}
