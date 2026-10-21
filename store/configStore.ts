/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Wires the tested store core to Equicord's DataStore, the signed-in account
// and the browser's timers.

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { React, UserStore } from "@webpack/common";

import { type LimelightConfig, sanitiseConfig } from "../logic/config";
import { createConfigCore } from "../logic/storeCore";

const logger = new Logger("Limelight");
const KEY_PREFIX = "Limelight_config_";

const core = createConfigCore({
    read: key => DataStore.get(key),
    write: (key, value) => DataStore.set(key, value),
    currentKey() {
        const user = UserStore.getCurrentUser();
        return user ? KEY_PREFIX + user.id : null;
    },
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    log: (message, error) => logger.error(message, error)
});

export const loadConfig = core.load;
export const flushConfig = core.flush;
export const getConfig = core.get;
export const isConfigReady = core.ready;
export const updateConfig = core.update;
export const { subscribe } = core;

export function useLimelightConfig(): LimelightConfig {
    return React.useSyncExternalStore(core.subscribe, core.get);
}

// Every account's saved config on this profile, rebuilt through the allowlist, for
// work that must know what all of them point at (the stored images are shared by
// the accounts, so tidying them must not delete another account's). Rejects if
// anything cannot be read, so the caller does nothing rather than guess.
export async function savedConfigs(): Promise<LimelightConfig[]> {
    const keys = await DataStore.keys();
    const mine = keys.filter((key): key is string => typeof key === "string" && key.startsWith(KEY_PREFIX));
    return Promise.all(mine.map(async key => sanitiseConfig(await DataStore.get(key))));
}
