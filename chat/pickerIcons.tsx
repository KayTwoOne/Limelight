/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Icons for the call chat's channel picker, drawn to Discord's 24px grid so they
// sit beside its own. The channel icons take the props Discord's header passes
// an icon (a size token or width and height, a colour, a class).

interface IconProps {
    size?: string | number;
    width?: number;
    height?: number;
    color?: string;
    className?: string;
}

const SIZES: Record<string, number> = { xxs: 12, xs: 16, sm: 18, md: 24, lg: 32 };

function px(props: IconProps, fallback: number): { width: number; height: number; } {
    const size = typeof props.size === "number" ? props.size : SIZES[props.size ?? ""] ?? fallback;
    return { width: props.width ?? size, height: props.height ?? size };
}

export function HashIcon(props: IconProps) {
    return (
        <svg {...px(props, 24)} viewBox="0 0 24 24" className={props.className} aria-hidden="true">
            <path fill={props.color ?? "currentColor"} fillRule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" />
        </svg>
    );
}

export function AnnouncementIcon(props: IconProps) {
    return (
        <svg {...px(props, 24)} viewBox="0 0 24 24" className={props.className} aria-hidden="true">
            <path fill={props.color ?? "currentColor"} d="M19.56 2a3 3 0 0 0-2.46 1.28 3.85 3.85 0 0 1-1.86 1.42l-8.9 3.18a.5.5 0 0 0-.34.47v10.09a3 3 0 0 0 2.27 2.9l.62.16c1.57.4 3.15-.56 3.55-2.12l.56-2.15 2.6.93c.75.27 1.39.78 1.83 1.47a3 3 0 0 0 5.57-1.6V5a3 3 0 0 0-3.44-3ZM2.5 9.5A1.5 1.5 0 0 0 1 11v4a1.5 1.5 0 0 0 1.5 1.5H4V9.5H2.5Z" />
        </svg>
    );
}

export function ChevronIcon({ className }: { className?: string; }) {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="currentColor" d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42Z" />
        </svg>
    );
}

export function ReturnIcon() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9.7 4.3a1 1 0 0 1 0 1.4L6.42 9H14a7 7 0 1 1 0 14h-2a1 1 0 1 1 0-2h2a5 5 0 0 0 0-10H6.41l3.3 3.3a1 1 0 0 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.42 0Z" />
        </svg>
    );
}

export function TickIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M21.7 5.3a1 1 0 0 1 0 1.4l-12 12a1 1 0 0 1-1.4 0l-6-6a1 1 0 1 1 1.4-1.4L9 16.58l11.3-11.3a1 1 0 0 1 1.4 0Z" />
        </svg>
    );
}

export function SearchIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M15.62 17.03a9 9 0 1 1 1.41-1.41l4.68 4.67a1 1 0 0 1-1.42 1.42l-4.67-4.68ZM17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0Z" />
        </svg>
    );
}
