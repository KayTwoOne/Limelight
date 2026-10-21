/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Glyphs the editor tabs draw (tokens.md 5.5, 5.6), every path the mockup's.
// All are decorative: the text beside each one carries the meaning. Their colour
// is whatever the CSS that places them gives `color`.

import { type ReactNode } from "react";

interface GlyphProps {
    size: number;
    strokeWidth: number;
    children: ReactNode;
}

function Glyph({ size, strokeWidth, children }: GlyphProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

// A person row's chevron: 18px, stroke 2.2 (Popover.dc.html:51).
export function ChevronRightIcon() {
    return (
        <Glyph size={18} strokeWidth={2.2}>
            <path d="M9 6l6 6-6 6" />
        </Glyph>
    );
}

// The Back button's chevron: 18px, stroke 2.2 (Popover.dc.html:61).
export function ChevronLeftIcon() {
    return (
        <Glyph size={18} strokeWidth={2.2}>
            <path d="M15 6l-6 6 6 6" />
        </Glyph>
    );
}

// The Everyone header's two people: 22px, stroke 2 (Popover.dc.html:78).
export function PeopleIcon() {
    return (
        <Glyph size={22} strokeWidth={2}>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
            <circle cx="17" cy="9" r="2.6" />
            <path d="M16.2 13.6c2.7.2 4.8 2.2 4.8 5" />
        </Glyph>
    );
}

// The empty image box's picture glyph: 24px, stroke 1.8, drawn in the muted ink
// the CSS gives it.
export function ImageIcon() {
    return (
        <Glyph size={24} strokeWidth={1.8}>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M21 16l-5-5-8 9" />
        </Glyph>
    );
}
