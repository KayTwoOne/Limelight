/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// What Limelight adds to the call view's bottom-left controls, before Discord's own
// Invite and chat arrow: the « » channel list button while it is switched on
// (Stage tab). Folded, Discord's user section stands in the server list, clear of
// the call, so nothing here moves Discord's buttons. If a fold failed its check
// this session, the button stays, inert, and its tooltip says why. Discord's
// element is always rendered, untouched.

import { React, Tooltip } from "@webpack/common";
import { type ReactNode } from "react";

import { foldHealth, subscribeFold, toggleFold } from "../runtime/channelFoldRuntime";
import { getConfig, subscribe } from "../store/configStore";
import { FoldIcon } from "./icons";

const buttonOn = () => getConfig().stage.foldButton;
const folded = () => getConfig().stage.folded;

export function FoldControls({ original }: { original: ReactNode; }) {
    const on = React.useSyncExternalStore(subscribe, buttonOn);
    const isFolded = React.useSyncExternalStore(subscribe, folded);
    const health = React.useSyncExternalStore(subscribeFold, foldHealth);

    if (!on) return <>{original}</>;

    const broken = health === "broken";
    const label = broken
        ? "The channel list can't fold: Discord's layout changed. See Limelight's Health."
        : isFolded ? "Show channel list" : "Hide channel list";
    return (
        <>
            <Tooltip text={label}>
                {({ onMouseEnter, onMouseLeave }) => (
                    <button
                        type="button"
                        className="vc-limelight-fold-button"
                        aria-label={label}
                        aria-disabled={broken || undefined}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onClick={toggleFold}
                    >
                        <FoldIcon folded={isFolded && !broken} />
                    </button>
                )}
            </Tooltip>
            {original}
        </>
    );
}
