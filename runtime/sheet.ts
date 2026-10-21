/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Owns the one <style id="limelight-sheet"> that carries every theme and Display
// setting. It is rebuilt from the config, the images and the editing target
// whenever any of them changes, at most once per animation frame. An image that
// is still being read from storage has no URL yet; the store announces it when it
// arrives and the sheet is rebuilt then.

import { Logger } from "@utils/Logger";

import { buildSheet } from "../logic/styleSheet";
import { getConfig, subscribe } from "../store/configStore";
import { imageAverage, imageLightest, imageUrl, subscribe as subscribeImages } from "../store/imageStore";
import { getEditingUserId, subscribeEditing } from "./editing";

const logger = new Logger("Limelight");
const STYLE_ID = "limelight-sheet";

let element: HTMLStyleElement | null = null;
let unsubscribe: Array<() => void> = [];
let frame = 0;

function write(): void {
    frame = 0;
    if (!element) return;
    try {
        element.textContent = buildSheet({ config: getConfig(), imageUrl, imageAverage, imageLightest, editingUserId: getEditingUserId() });
    } catch (error) {
        logger.error("Could not build the stylesheet; the last one stays.", error);
    }
}

function schedule(): void {
    if (frame !== 0 || !element) return;
    frame = requestAnimationFrame(write);
}

export function startSheet(): void {
    if (element) return;
    element = document.createElement("style");
    element.id = STYLE_ID;
    document.head.append(element);
    unsubscribe = [subscribe(schedule), subscribeImages(schedule), subscribeEditing(schedule)];
    write();
}

export function stopSheet(): void {
    for (const off of unsubscribe) off();
    unsubscribe = [];
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    element?.remove();
    element = null;
}
