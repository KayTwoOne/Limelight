/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The inline colour picker a swatch row opens under itself (spec 6.6, tokens.md
// 5.9): a saturation and brightness square, a hue bar, a hex field and Done.
// Dragging calls onChange at most once per animation frame, and the last value
// is always delivered, on Done or when the picker closes mid-drag.

import { React } from "@webpack/common";
import { type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { hexToHsv, type Hsv, hsvToHex, normaliseHex } from "../logic/colour";

interface ColourPickerProps {
    value: string;
    onChange(hex: string): void;
    onDone(): void;
    // The ring row's picker shows its colour chip as a circle (tokens.md 5.9).
    round?: boolean;
}

// The hue bar stops just short of 360, which is red again (tokens.md 5.9).
const HUE_MAX = 359.9;
const FALLBACK = "#000000";

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}

export function ColourPicker({ value, onChange, onDone, round = false }: ColourPickerProps) {
    const [hsv, setHsv] = React.useState<Hsv>(() => hexToHsv(normaliseHex(value) ?? FALLBACK));
    // The hex text while the field is being typed in; null means "show the colour".
    const [draft, setDraft] = React.useState<string | null>(null);

    // The picker's own hue, saturation and brightness are the truth while it is
    // open: a hex value cannot hold the hue of a grey. produced is the latest
    // colour it made and sent the latest it gave the parent, so the value coming
    // back down (a frame late) is not mistaken for an outside change.
    const hsvRef = React.useRef(hsv);
    const produced = React.useRef(normaliseHex(value));
    const sent = React.useRef(produced.current);
    const pending = React.useRef<string | null>(null);
    const frame = React.useRef(0);
    const drag = React.useRef<"sv" | "hue" | null>(null);
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;

    function flush(): void {
        if (frame.current !== 0) {
            cancelAnimationFrame(frame.current);
            frame.current = 0;
        }
        const { current: hex } = pending;
        if (hex === null) return;
        pending.current = null;
        sent.current = hex;
        onChangeRef.current(hex);
    }

    function apply(next: Hsv): void {
        hsvRef.current = next;
        setHsv(next);
        const hex = hsvToHex(next.h, next.s, next.v);
        produced.current = hex;
        pending.current = hex;
        if (frame.current === 0) {
            frame.current = requestAnimationFrame(() => {
                frame.current = 0;
                flush();
            });
        }
    }

    // A colour the picker did not make (a curated swatch clicked while it is
    // open) replaces what it shows. While a pointer is dragging the picker is the
    // only author: a value coming back down is one the picker sent a frame or two
    // ago, so it is ignored whatever it is and the thumb never steps back.
    React.useEffect(() => {
        if (drag.current !== null) return;
        const incoming = normaliseHex(value);
        if (incoming === null || incoming === produced.current || incoming === sent.current) return;
        const next = hexToHsv(incoming);
        hsvRef.current = next;
        produced.current = incoming;
        sent.current = incoming;
        pending.current = null;
        setHsv(next);
        setDraft(null);
    }, [value]);

    // Closing the picker mid-drag still delivers the last colour.
    React.useEffect(() => flush, []);

    function track(kind: "sv" | "hue", event: PointerEvent<HTMLDivElement>): void {
        if (drag.current !== kind) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = clamp01((event.clientX - rect.left) / rect.width);
        const { h, s, v } = hsvRef.current;
        if (kind === "sv") apply({ h, s: x, v: 1 - clamp01((event.clientY - rect.top) / rect.height) });
        else apply({ h: x * HUE_MAX, s, v });
    }

    function begin(kind: "sv" | "hue", event: PointerEvent<HTMLDivElement>): void {
        if (event.button !== 0) return;
        drag.current = kind;
        event.currentTarget.setPointerCapture(event.pointerId);
        track(kind, event);
    }

    function end(): void {
        drag.current = null;
    }

    function svKey(event: KeyboardEvent<HTMLDivElement>): void {
        const step = event.shiftKey ? 0.1 : 0.01;
        const { h, s, v } = hsvRef.current;
        switch (event.key) {
            case "ArrowLeft": apply({ h, s: clamp01(s - step), v }); break;
            case "ArrowRight": apply({ h, s: clamp01(s + step), v }); break;
            case "ArrowUp": apply({ h, s, v: clamp01(v + step) }); break;
            case "ArrowDown": apply({ h, s, v: clamp01(v - step) }); break;
            default: return;
        }
        event.preventDefault();
    }

    function hueKey(event: KeyboardEvent<HTMLDivElement>): void {
        const step = event.shiftKey ? 10 : 1;
        const { h, s, v } = hsvRef.current;
        const to = (hue: number) => apply({ h: Math.max(0, Math.min(HUE_MAX, hue)), s, v });
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown": to(h - step); break;
            case "ArrowRight":
            case "ArrowUp": to(h + step); break;
            case "Home": to(0); break;
            case "End": to(HUE_MAX); break;
            default: return;
        }
        event.preventDefault();
    }

    // Typing accepts 3 or 6 digits with or without "#". Anything else is ignored
    // until it is valid, and the field shows the colour again when it loses focus.
    function typeHex(text: string): void {
        setDraft(text);
        const hex = normaliseHex(text);
        if (hex !== null) apply(hexToHsv(hex));
    }

    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    const saturation = Math.round(hsv.s * 100);
    const brightness = Math.round(hsv.v * 100);

    return (
        <div
            className="vc-limelight-picker"
            data-round={round || undefined}
            style={{ "--ll-hue": hsvToHex(hsv.h, 1, 1), "--ll-picked": hex } as CSSProperties}
        >
            <div
                className="vc-limelight-sv"
                role="slider"
                tabIndex={0}
                aria-label="Saturation and brightness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={saturation}
                aria-valuetext={`Saturation ${saturation}%, brightness ${brightness}%`}
                onPointerDown={event => begin("sv", event)}
                onPointerMove={event => track("sv", event)}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onKeyDown={svKey}
            >
                <span className="vc-limelight-sv-thumb" aria-hidden="true" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
            </div>

            <div
                className="vc-limelight-hue"
                role="slider"
                tabIndex={0}
                aria-label="Hue"
                aria-valuemin={0}
                aria-valuemax={360}
                aria-valuenow={Math.round(hsv.h)}
                onPointerDown={event => begin("hue", event)}
                onPointerMove={event => track("hue", event)}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onKeyDown={hueKey}
            >
                <span className="vc-limelight-hue-thumb" aria-hidden="true" style={{ left: `${hsv.h / 360 * 100}%` }} />
            </div>

            <div className="vc-limelight-picker-row">
                <span className="vc-limelight-picker-chip" aria-hidden="true" />
                <label className="vc-limelight-hexfield">
                    <span aria-hidden="true">#</span>
                    <input
                        type="text"
                        value={draft ?? hex.slice(1)}
                        maxLength={7}
                        spellCheck={false}
                        autoComplete="off"
                        aria-label="Hex colour"
                        onChange={event => typeHex(event.currentTarget.value)}
                        onBlur={() => setDraft(null)}
                    />
                </label>
                <button
                    type="button"
                    className="vc-limelight-done"
                    onClick={() => {
                        flush();
                        onDone();
                    }}
                >
                    Done
                </button>
            </div>
        </div>
    );
}
