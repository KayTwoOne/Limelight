/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// A row of exclusive choices drawn as a segmented control (tokens.md 5.8): a
// dark track, one lime segment. Each segment is a real button whose pressed state
// is announced, so the Display and Chat tabs use it too.

import { type CSSProperties } from "react";

export interface SegmentOption<T extends string> {
    readonly id: T;
    readonly label: string;
}

interface SegmentedProps<T extends string> {
    // The group's accessible name; the visible heading is the caller's.
    label: string;
    options: ReadonlyArray<SegmentOption<T>>;
    // null: none of the options is current.
    value: T | null;
    onChange(id: T): void;
    // Dimmed and inert, but still focusable and still showing the current value.
    disabled?: boolean;
}

export function Segmented<T extends string>({ label, options, value, onChange, disabled = false }: SegmentedProps<T>) {
    return (
        <div
            className="vc-limelight-segmented"
            role="group"
            aria-label={label}
            data-disabled={disabled || undefined}
            style={{ "--ll-cols": options.length } as CSSProperties}
        >
            {options.map(option => (
                <button
                    key={option.id}
                    type="button"
                    className="vc-limelight-segment"
                    aria-pressed={value === option.id}
                    aria-disabled={disabled || undefined}
                    onClick={() => { if (!disabled) onChange(option.id); }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
