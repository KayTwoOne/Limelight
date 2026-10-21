/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The config store's logic, with storage, account and timers injected so it
// can be tested under node. plugin/store/configStore.ts wires it to Equicord.

import { defaultConfig, type LimelightConfig, sanitiseConfig } from "./config";

export const SAVE_DELAY_MS = 400;

export interface StoreDeps {
    read(key: string): Promise<unknown>;
    write(key: string, value: LimelightConfig): Promise<void>;
    currentKey(): string | null;
    schedule(fn: () => void, ms: number): unknown;
    cancel(handle: unknown): void;
    log(message: string, error?: unknown): void;
}

export interface ConfigCore {
    load(): Promise<void>;
    flush(): Promise<void>;
    get(): LimelightConfig;
    // True once the signed-in account's saved config has been read successfully and
    // no other load is under way: only then does get() hold what the account has.
    ready(): boolean;
    update(mutate: (draft: LimelightConfig) => void): void;
    subscribe(listener: () => void): () => void;
}

type Mutation = (draft: LimelightConfig) => void;

// An edit made while a load was in flight, tagged with the account that load
// was for (null: made before any account was known, so it fits the first one).
interface QueuedEdit {
    mutate: Mutation;
    owner: string | null;
}

function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value)) deepFreeze(inner);
    }
    return value;
}

export function createConfigCore(deps: StoreDeps): ConfigCore {
    let current = deepFreeze(defaultConfig());
    let loadedKey: string | null = null;
    let loadingKey: string | null = null;
    let loading: Promise<void> | null = null;
    let dirty = false;
    let readFailed = false;
    let timer: unknown = null;
    let generation = 0;
    let queued: QueuedEdit[] = [];
    // Edits applied in memory while the saved config could not be read, kept so
    // a later successful read can replay them on top of what is really stored.
    let failedEdits: Mutation[] = [];
    const listeners = new Set<() => void>();

    function emit() {
        for (const listener of [...listeners]) {
            try { listener(); } catch (e) { deps.log("Listener failed", e); }
        }
    }

    function apply(mutate: Mutation) {
        const draft = structuredClone(current) as LimelightConfig;
        mutate(draft);
        current = deepFreeze(sanitiseConfig(draft));
        dirty = true;
        if (readFailed) failedEdits.push(mutate);
    }

    async function flush() {
        if (timer !== null) { deps.cancel(timer); timer = null; }
        if (!dirty || readFailed || loadedKey === null) return;
        const key = loadedKey;
        dirty = false;
        try {
            await deps.write(key, current);
        } catch (e) {
            dirty = true;
            deps.log("Could not save the config", e);
        }
    }

    function scheduleSave() {
        if (timer !== null) deps.cancel(timer);
        timer = deps.schedule(() => { timer = null; void flush(); }, SAVE_DELAY_MS);
    }

    // Edits queued for another account's load must never reach this one.
    function keepQueuedFor(key: string | null) {
        const kept = queued.filter(q => q.owner === null || q.owner === key);
        if (kept.length !== queued.length) {
            deps.log(`Dropped ${queued.length - kept.length} edit(s) made for an account that is no longer current`);
        }
        queued = kept;
    }

    // The account that was loading is no longer current and the one already
    // loaded is again: forget the in-flight load (its result is discarded).
    function abandonLoad() {
        generation++;
        keepQueuedFor(loadedKey);
        loading = null;
        loadingKey = null;
    }

    function finishLoad(key: string, ok: boolean, raw: unknown) {
        loading = null;
        loadingKey = null;
        const retry = key === loadedKey;
        const mine = queued.filter(q => q.owner === null || q.owner === key).map(q => q.mutate);
        queued = [];
        let replay: Mutation[];
        if (ok) {
            current = deepFreeze(sanitiseConfig(raw));
            readFailed = false;
            replay = [...(retry ? failedEdits : []), ...mine];
            failedEdits = [];
        } else {
            readFailed = true;
            if (!retry) {
                current = deepFreeze(sanitiseConfig(undefined));
                failedEdits = [];
            }
            replay = mine;
        }
        loadedKey = key;
        dirty = false;
        for (const mutate of replay) {
            try {
                apply(mutate);
            } catch (e) {
                deps.log("Skipped an edit that could not be applied", e);
            }
        }
        if (dirty && !readFailed) scheduleSave();
        emit();
    }

    async function load() {
        const key = deps.currentKey();
        if (key === null) return;
        if (loading !== null && loadingKey === key) return loading;
        if (key === loadedKey && !readFailed) {
            if (loading !== null) abandonLoad();
            return;
        }
        const gen = ++generation;
        keepQueuedFor(key);
        loadingKey = key;
        const run = (async () => {
            // Pending edits belong to the account that owns them: save them
            // there before the switch. Edits made meanwhile are queued for
            // the new account, because loadingKey is already set.
            if (dirty && key !== loadedKey) await flush();
            if (gen !== generation) return;
            let raw: unknown;
            let ok = true;
            try {
                raw = await deps.read(key);
            } catch (e) {
                ok = false;
                deps.log("Could not read the saved config; using defaults and not saving", e);
            }
            if (gen !== generation) return;
            finishLoad(key, ok, raw);
        })();
        loading = run;
        try {
            await run;
        } finally {
            if (loading === run) { loading = null; loadingKey = null; }
        }
    }

    function update(mutate: Mutation) {
        if (loadingKey !== null || loadedKey === null) {
            queued.push({ mutate, owner: loadingKey });
            return;
        }
        apply(mutate);
        emit();
        scheduleSave();
    }

    return {
        load,
        flush,
        get: () => current,
        ready: () => loadedKey !== null && !readFailed && loadingKey === null,
        update,
        subscribe(listener) {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        }
    };
}
