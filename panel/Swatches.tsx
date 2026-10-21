/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// A row of curated colour swatches ending in a custom swatch that opens the
// inline picker under the row (spec 6.6, tokens.md 5.9). A colour outside the
// curated set makes the custom swatch show that colour and stay selected.

import { React } from "@webpack/common";
import { type CSSProperties, type KeyboardEvent } from "react";

import { normaliseHex } from "../logic/colour";
import { PlusIcon } from "../tiles/icons";
import { ColourPicker } from "./ColourPicker";

// The curated lists, exactly spec 6.6 (written in the lower case that
// normaliseHex gives, which is also how a config stores them).
export const FROM_COLOURS: readonly string[] = ["#0e4d49", "#1d4e89", "#7a3b1d", "#6b1518", "#3d4a2a", "#2b2d31", "#b8892b"];
export const TO_COLOURS: readonly string[] = ["#081619", "#0b1a33", "#1e0e07", "#170607", "#121608", "#111214", "#2a1c06"];
export const RING_COLOURS: readonly string[] = ["#23a55a", "#d8f35a", "#5ac8fa", "#ff9f43", "#ff6b9a", "#f2f3f5"];

interface SwatchesProps {
    colours: readonly string[];
    value: string;
    onChange(hex: string): void;
    // The field's name: the label above the row and the row's accessible name.
    label: string;
    // The ring row is round (tokens.md 5.9) and gets its heading from the editor.
    round?: boolean;
    hideLabel?: boolean;
}

export function Swatches({ colours, value, onChange, label, round = false, hideLabel = false }: SwatchesProps) {
    const [open, setOpen] = React.useState(false);
    const [focused, setFocused] = React.useState<number | null>(null);
    const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
    const labelId = React.useId();
    const pickerId = React.useId();

    const curated = colours.map(colour => normaliseHex(colour) ?? colour);
    const current = normaliseHex(value);
    const selected = current === null ? -1 : curated.indexOf(current);
    const custom = current !== null && selected === -1;
    const customIndex = curated.length;

    // One swatch is in the tab order at a time; arrow keys move between them.
    const tabbable = focused ?? (selected !== -1 ? selected : custom ? customIndex : 0);

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
        let next: number;
        switch (event.key) {
            case "ArrowRight":
            case "ArrowDown": next = index === customIndex ? 0 : index + 1; break;
            case "ArrowLeft":
            case "ArrowUp": next = index === 0 ? customIndex : index - 1; break;
            case "Home": next = 0; break;
            case "End": next = customIndex; break;
            default: return;
        }
        event.preventDefault();
        buttons.current[next]?.focus();
    }

    // Done unmounts the button that has focus. Focus goes to the custom swatch
    // (still mounted) first, so it never drops to the page, where the popover's
    // focus lock would hand it to the Close button.
    function closePicker(): void {
        buttons.current[customIndex]?.focus();
        setOpen(false);
    }

    function bind(index: number) {
        return {
            ref: (node: HTMLButtonElement | null) => { buttons.current[index] = node; },
            tabIndex: tabbable === index ? 0 : -1,
            onFocus: () => setFocused(index),
            onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index)
        };
    }

    return (
        <div className="vc-limelight-swatches" data-round={round || undefined}>
            {!hideLabel && <span className="vc-limelight-field-label" id={labelId}>{label}</span>}
            <div
                className="vc-limelight-swatch-row"
                role="group"
                aria-labelledby={hideLabel ? undefined : labelId}
                aria-label={hideLabel ? label : undefined}
            >
                {curated.map((hex, index) => (
                    <button
                        key={hex}
                        type="button"
                        className="vc-limelight-swatch"
                        data-selected={selected === index}
                        aria-label={hex}
                        aria-pressed={selected === index}
                        style={{ "--ll-swatch": hex } as CSSProperties}
                        onClick={() => onChange(hex)}
                        {...bind(index)}
                    />
                ))}
                <button
                    type="button"
                    className="vc-limelight-swatch vc-limelight-swatch-custom"
                    data-selected={custom || open}
                    aria-label={custom ? `Custom colour ${current}` : "Custom colour"}
                    aria-pressed={custom}
                    aria-expanded={open}
                    aria-controls={open ? pickerId : undefined}
                    onClick={() => setOpen(!open)}
                    {...bind(customIndex)}
                >
                    <span className="vc-limelight-swatch-inner" style={custom ? { "--ll-swatch": current } as CSSProperties : undefined}>
                        {!custom && <PlusIcon />}
                    </span>
                </button>
            </div>
            {open && (
                <div id={pickerId}>
                    <ColourPicker value={value} onChange={onChange} onDone={closePicker} round={round} />
                </div>
            )}
        </div>
    );
}
