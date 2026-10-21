/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Choosing and preparing a background image (spec 9.5, anchors-panel-chat.md 7):
// the file picker, then decode, resize, WebP encode and colour sampling, all in
// this window. Nothing leaves the machine. The sums live in logic/image.ts.

import { averageColour, fitWithin, isAcceptedType, lightestColour, MAX_BYTES, WEBP_QUALITY } from "../logic/image";

// What a picked image becomes: the encoded picture and two colours sampled from
// it, which the chat stage and the theme dots use.
export interface ProcessedImage {
    blob: Blob;
    average: string | null;
    lightest: string | null;
}

// A refusal whose message is fit to show the person as it stands.
export class ImageRejected extends Error { }

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
// The colour samples come from a copy this many pixels square.
const SAMPLE_PX = 8;

// Opens the system file picker and resolves with the chosen file, or null if the
// picker was cancelled. Equicord's own chooseFile never settles on a cancel. Call
// it straight from a click handler, before any await: the browser only opens the
// picker for a click it can tie to the person's gesture.
export function pickImageFile(): Promise<File | null> {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ACCEPT;
        input.hidden = true;
        const finish = (file: File | null) => {
            input.remove();
            resolve(file);
        };
        input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
        input.addEventListener("cancel", () => finish(null), { once: true });
        document.body.append(input);
        input.click();
    });
}

// A canvas that can be drawn on, read back and encoded. An OffscreenCanvas where
// the window has one, else an ordinary canvas (the way Discord's own image code
// does it).
interface Surface {
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    toWebp(): Promise<Blob>;
}

function surface(width: number, height: number): Surface | null {
    if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        return ctx ? { ctx, toWebp: () => canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY }) } : null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    return ctx
        ? {
            ctx,
            toWebp: () => new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The canvas gave no image")), "image/webp", WEBP_QUALITY);
            })
        }
        : null;
}

// Draws the bitmap at the given size. Smoothing is set to its best so a large
// picture shrunk to a few pixels still averages.
function draw(bitmap: ImageBitmap, width: number, height: number): Surface {
    const made = surface(width, height);
    if (!made) throw new ImageRejected("This window could not prepare the image.");
    made.ctx.imageSmoothingEnabled = true;
    made.ctx.imageSmoothingQuality = "high";
    made.ctx.drawImage(bitmap, 0, 0, width, height);
    return made;
}

export async function processImage(file: File): Promise<ProcessedImage> {
    if (!isAcceptedType(file.type)) throw new ImageRejected("Choose a PNG, JPEG, WebP or GIF image.");

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        throw new ImageRejected("That image could not be read. It may be damaged.");
    }

    try {
        const size = fitWithin(bitmap.width, bitmap.height);
        if (!size) throw new ImageRejected("That image has no size.");

        const blob = await draw(bitmap, size.width, size.height).toWebp();
        if (blob.type !== "image/webp") throw new ImageRejected("This window could not turn the image into WebP.");
        if (blob.size > MAX_BYTES) throw new ImageRejected("That image is still over 2 MB after being resized. Try a smaller or simpler one.");

        const { data } = draw(bitmap, SAMPLE_PX, SAMPLE_PX).ctx.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX);
        return { blob, average: averageColour(data), lightest: lightestColour(data) };
    } finally {
        bitmap.close();
    }
}
