/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The Display switch that hides Discord's invite prompts, read as a hook so the
// call grid and the channel list re-render when it flips. Selecting the one
// boolean means neither re-renders for any other config change.

import { React } from "@webpack/common";

import { getConfig, subscribe } from "../store/configStore";

const hidden = () => getConfig().display.hideInvitePrompts;

export function useHideInvitePrompts(): boolean {
    return React.useSyncExternalStore(subscribe, hidden);
}
