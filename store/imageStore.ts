/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Where background images live (spec 9.4, 9.5, anchors-panel-chat.md 6): each one
// is a record in Limelight's own IndexedDB store, keyed by its id and holding the
// WebP blob and two sampled colours. The stylesheet and the panel look an image up
// by id and get an object URL that is made once and revoked when the image goes.
// An image no theme points at any longer is deleted, with great care: the stored
// images are shared by every account on this profile, and a config that failed to
// load looks the same as one that references nothing.

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { React } from "@webpack/common";

import { normaliseHex } from "../logic/colour";
import { newImageId, orphanImageIds, referencedImageIds } from "../logic/image";
import { getConfig, isConfigReady, savedConfigs, subscribe as subscribeConfig } from "./configStore";
import { type ProcessedImage } from "./imagePipeline";

const logger = new Logger("Limelight");

// After the last config change this long, unused images are tidied away.
const CLEANUP_DELAY_MS = 2000;

interface Resident {
    url: string;
    average: string | null;
    lightest: string | null;
}

// Opened on first use, so a person who never picks an image never gets a database.
let store: DataStore.UseStore | undefined;

function images(): DataStore.UseStore {
    store ??= DataStore.createStore("Limelight", "images");
    return store;
}

// Images that have been read and have an object URL.
const resident = new Map<string, Resident>();
// Ids being read right now.
const reading = new Set<string>();
// Ids with nothing to show: not in the store, or unreadable. Asked about on every
// stylesheet build, so they are remembered rather than read again.
const unavailable = new Set<string>();
// Ids being added: stored a moment before the config points at them.
const held = new Set<string>();
const listeners = new Set<() => void>();

let running = false;
// Bumped on stop, so a read or tidy that was under way then does nothing after.
let generation = 0;
let unsubscribeConfig: (() => void) | null = null;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
    for (const listener of [...listeners]) {
        try {
            listener();
        } catch (error) {
            logger.error("An image listener failed", error);
        }
    }
}

export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

// What the store hands back is rebuilt by allowlist like everything else: a blob
// and two colours that are hex or nothing.
function rebuild(raw: unknown): { blob: Blob; average: string | null; lightest: string | null; } | null {
    if (typeof raw !== "object" || raw === null) return null;
    const { blob, average, lightest } = raw as Record<string, unknown>;
    if (!(blob instanceof Blob)) return null;
    return { blob, average: normaliseHex(average), lightest: normaliseHex(lightest) };
}

function forget(id: string): void {
    const gone = resident.get(id);
    if (gone) URL.revokeObjectURL(gone.url);
    resident.delete(id);
    unavailable.delete(id);
}

async function read(id: string): Promise<void> {
    if (!running || resident.has(id) || reading.has(id) || unavailable.has(id)) return;
    reading.add(id);
    const mine = generation;
    try {
        const found = rebuild(await DataStore.get(id, images()));
        if (mine !== generation) return;
        if (found) {
            resident.set(id, { url: URL.createObjectURL(found.blob), average: found.average, lightest: found.lightest });
            emit();
        } else {
            unavailable.add(id);
        }
    } catch (error) {
        unavailable.add(id);
        logger.error(`Could not read the stored image ${id}`, error);
    } finally {
        reading.delete(id);
    }
}

// The object URL of a stored image, or null while it is still being read (the
// listeners are told when it arrives) or when there is no such image. Asking is
// what starts the read.
export function imageUrl(id: string): string | null {
    const hit = resident.get(id);
    if (hit) return hit.url;
    void read(id);
    return null;
}

export function imageAverage(id: string): string | null {
    const hit = resident.get(id);
    if (hit) return hit.average;
    void read(id);
    return null;
}

export function imageLightest(id: string): string | null {
    const hit = resident.get(id);
    if (hit) return hit.lightest;
    void read(id);
    return null;
}

// The image's URL for a component: re-renders when it arrives or goes. The read
// starts in an effect, so the snapshot itself stays free of side effects.
export function useImageUrl(id: string | undefined): string | null {
    React.useEffect(() => {
        if (id) void read(id);
    }, [id]);
    return React.useSyncExternalStore(subscribe, () => (id ? resident.get(id)?.url ?? null : null));
}

// Stores a prepared image under a new id and hands the id to `apply`, which makes
// a theme point at it. The id is held from before it is stored until `apply` has
// run, so a tidy that happens to run in between cannot take it.
export async function addImage(image: ProcessedImage, apply: (id: string) => void): Promise<string> {
    const id = newImageId();
    held.add(id);
    try {
        await DataStore.set(id, { blob: image.blob, average: image.average, lightest: image.lightest }, images());
        resident.set(id, { url: URL.createObjectURL(image.blob), average: image.average, lightest: image.lightest });
        unavailable.delete(id);
        emit();
        apply(id);
    } finally {
        held.delete(id);
    }
    return id;
}

// Frees the object URL of an image no theme points at any longer, as soon as the
// config says so. The stored copy stays until the tidy below (it may still belong
// to another account), and a later read makes a new URL if it is ever wanted
// again. Only judged once the config is known to be the account's real one.
function releaseUnreferenced(): void {
    if (!isConfigReady()) return;
    const referenced = referencedImageIds(getConfig());
    let freed = false;
    for (const id of [...resident.keys()]) {
        if (referenced.has(id) || held.has(id)) continue;
        forget(id);
        freed = true;
    }
    if (freed) emit();
}

// Deletes every stored image that no theme references. It judges by the config in
// memory and by every account's saved config, and does nothing unless the
// signed-in account's config was read successfully: a config that failed to load
// is only the defaults, which reference nothing.
async function cleanup(): Promise<void> {
    if (!running || !isConfigReady()) return;
    const mine = generation;
    try {
        const stored = await DataStore.keys(images());
        const saved = await savedConfigs();
        if (mine !== generation || !isConfigReady()) return;

        const referenced = new Set<string>();
        for (const config of [getConfig(), ...saved]) {
            for (const id of referencedImageIds(config)) referenced.add(id);
        }
        const doomed = orphanImageIds(stored, referenced, held);
        if (doomed.length === 0) return;

        await DataStore.delMany(doomed, images());
        for (const id of doomed) forget(id);
        emit();
    } catch (error) {
        logger.error("Could not tidy unused images; they stay until next time.", error);
    }
}

function scheduleCleanup(): void {
    if (!running) return;
    if (cleanupTimer !== null) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => {
        cleanupTimer = null;
        void cleanup();
    }, CLEANUP_DELAY_MS);
}

// Tidies after every config change (once they stop for two seconds) and, because
// a finished load also announces itself as a change, once the config has loaded.
export function startImages(): void {
    if (running) return;
    running = true;
    unsubscribeConfig = subscribeConfig(() => {
        releaseUnreferenced();
        scheduleCleanup();
    });
    scheduleCleanup();
}

export function stopImages(): void {
    running = false;
    generation++;
    unsubscribeConfig?.();
    unsubscribeConfig = null;
    if (cleanupTimer !== null) clearTimeout(cleanupTimer);
    cleanupTimer = null;
    for (const { url } of resident.values()) URL.revokeObjectURL(url);
    resident.clear();
    reading.clear();
    unavailable.clear();
    held.clear();
    emit();
}
