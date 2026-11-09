/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// A dropdown (presets): a field-style button showing the choice, and a list that
// opens under it, in the flow of the panel so it is never clipped by the panel's
// scrolling body. The list takes focus while open: Up and Down move, Home and End
// jump, Enter or Space picks, Escape closes and hands focus back to the button.
// Escape is kept from reaching Discord's popout, which would close the panel.
// A click outside closes it.

import { React } from "@webpack/common";
import { type KeyboardEvent, type ReactNode } from "react";

import { ChevronDownIcon, TickIcon } from "./panelIcons";

export interface SelectOption {
    id: string;
    label: string;
    swatch?: ReactNode;
}

interface SelectProps {
    label: string;
    placeholder: string;
    value: string | null;
    options: readonly SelectOption[];
    onChange(id: string): void;
    /** A last item set apart from the options, such as Rename or delete presets */
    footer?: { label: string; onSelect(): void; };
    disabled?: boolean;
}

const FOOTER = "__footer";

export function Select({ label, placeholder, value, options, onChange, footer, disabled }: SelectProps) {
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(0);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const listId = React.useId();
    const ids = React.useMemo(() => [...options.map(o => o.id), ...(footer ? [FOOTER] : [])], [options, footer]);
    const chosen = options.find(o => o.id === value) ?? null;

    function show(): void {
        if (disabled) return;
        const at = Math.max(0, options.findIndex(o => o.id === value));
        setActive(at);
        setOpen(true);
    }

    function close(focusButton: boolean): void {
        setOpen(false);
        if (focusButton) buttonRef.current?.focus({ preventScroll: true });
    }

    function pick(id: string): void {
        close(true);
        if (id === FOOTER) footer?.onSelect();
        else onChange(id);
    }

    React.useEffect(() => {
        if (!open) return;
        listRef.current?.focus({ preventScroll: true });
        const onDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown, true);
        return () => document.removeEventListener("mousedown", onDown, true);
    }, [open]);

    React.useEffect(() => {
        if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [open, active]);

    function onListKey(event: KeyboardEvent<HTMLUListElement>): void {
        const last = ids.length - 1;
        switch (event.key) {
            case "ArrowDown": setActive(i => Math.min(last, i + 1)); break;
            case "ArrowUp": setActive(i => Math.max(0, i - 1)); break;
            case "Home": setActive(0); break;
            case "End": setActive(last); break;
            case "Enter":
            case " ":
                if (ids[active] !== undefined) pick(ids[active]);
                break;
            case "Escape":
                close(true);
                break;
            case "Tab":
                setOpen(false);
                return;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    return (
        <div className="vc-limelight-select-root" ref={rootRef}>
            <button
                type="button"
                ref={buttonRef}
                className="vc-limelight-select"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-label={chosen ? `${label}: ${chosen.label}` : label}
                aria-disabled={disabled || undefined}
                onClick={() => (open ? close(false) : show())}
            >
                {chosen?.swatch}
                <span className="vc-limelight-select-text" data-empty={chosen ? undefined : true}>{chosen ? chosen.label : placeholder}</span>
                <span className="vc-limelight-select-chevron"><ChevronDownIcon /></span>
            </button>
            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    className="vc-limelight-menu"
                    role="listbox"
                    aria-label={label}
                    tabIndex={-1}
                    aria-activedescendant={`${listId}-${active}`}
                    onKeyDown={onListKey}
                >
                    {options.map((option, index) => (
                        <li
                            key={option.id}
                            id={`${listId}-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={option.id === value}
                            className="vc-limelight-menu-item"
                            data-active={index === active || undefined}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => pick(option.id)}
                        >
                            {option.swatch}
                            <span className="vc-limelight-select-text">{option.label}</span>
                            {option.id === value && <span className="vc-limelight-menu-tick"><TickIcon /></span>}
                        </li>
                    ))}
                    {footer && (
                        <>
                            <li className="vc-limelight-menu-rule" role="presentation" />
                            <li
                                id={`${listId}-${options.length}`}
                                data-index={options.length}
                                role="option"
                                aria-selected={false}
                                className="vc-limelight-menu-item vc-limelight-menu-manage"
                                data-active={active === options.length || undefined}
                                onMouseEnter={() => setActive(options.length)}
                                onClick={() => pick(FOOTER)}
                            >
                                {footer.label}
                            </li>
                        </>
                    )}
                </ul>
            )}
        </div>
    );
}
