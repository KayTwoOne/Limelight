/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// A labelled on/off row (tokens.md 5.11): a label over a hint, and a 40 by 24px
// track with a knob. The whole row is one real button announced as a switch, so
// the Display tab, the settings page and the Chat tab share it.

interface SwitchRowProps {
    label: string;
    hint: string;
    checked: boolean;
    onChange(next: boolean): void;
}

export function SwitchRow({ label, hint, checked, onChange }: SwitchRowProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className="vc-limelight-switch-row"
            onClick={() => onChange(!checked)}
        >
            <span className="vc-limelight-switch-text">
                <span className="vc-limelight-switch-label">{label}</span>
                <span className="vc-limelight-switch-hint">{hint}</span>
            </span>
            <span className="vc-limelight-switch-track" aria-hidden="true">
                <span className="vc-limelight-switch-knob" />
            </span>
        </button>
    );
}
