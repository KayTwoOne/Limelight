/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The image row of the background editor (spec 9.5, tokens.md 5.11): a thumbnail,
// Choose image and, once there is one, Remove. A choice is decoded, resized and
// stored on this machine before the theme is told about it; a refusal is shown as
// a Discord toast in plain words.

import { Logger } from "@utils/Logger";
import { React } from "@webpack/common";

import { safeImageUrl } from "../logic/theme";
import { limelightToast } from "../runtime/toast";
import { ImageRejected, pickImageFile, processImage } from "../store/imagePipeline";
import { addImage, useImageUrl } from "../store/imageStore";
import { ImageIcon } from "./panelIcons";

const logger = new Logger("Limelight");

interface ImageFieldProps {
    // The image the theme points at, if it points at one.
    imageId: string | undefined;
    // A new image is stored and ready: make the theme use it.
    onChoose(imageId: string): void;
    onRemove(): void;
}

export function ImageField({ imageId, onChoose, onRemove }: ImageFieldProps) {
    const url = safeImageUrl(useImageUrl(imageId));
    const [working, setWorking] = React.useState(false);
    const chooseRef = React.useRef<HTMLButtonElement>(null);
    // Set at once on a click, where state would only change a render later.
    const busy = React.useRef(false);
    const mounted = React.useRef(true);
    // Choosing takes a while, and the theme may change meanwhile; the latest
    // handler, not the one from the click, makes the change.
    const onChooseRef = React.useRef(onChoose);
    onChooseRef.current = onChoose;

    React.useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    async function choose(): Promise<void> {
        if (busy.current) return;
        busy.current = true;
        try {
            // Called before any await, so the browser still ties it to the click.
            const file = await pickImageFile();
            if (!file) return;
            if (mounted.current) setWorking(true);
            const processed = await processImage(file);
            // If the panel was closed meanwhile the image is stored but no theme
            // points at it, and the next tidy removes it.
            await addImage(processed, id => {
                if (mounted.current) onChooseRef.current(id);
            });
        } catch (error) {
            if (error instanceof ImageRejected) {
                limelightToast(error.message, "failure");
            } else {
                logger.error("Could not save the chosen image", error);
                limelightToast("Limelight could not save that image.", "failure");
            }
        } finally {
            busy.current = false;
            if (mounted.current) setWorking(false);
        }
    }

    // Remove goes, so focus moves to the button that stays.
    function remove(): void {
        chooseRef.current?.focus();
        onRemove();
    }

    return (
        <div className="vc-limelight-image-row">
            <div
                className="vc-limelight-image-thumb"
                aria-hidden="true"
                style={url ? { backgroundImage: `url("${url}")` } : undefined}
            >
                {!url && <ImageIcon />}
            </div>
            <div className="vc-limelight-image-side">
                <div className="vc-limelight-image-actions">
                    <button
                        ref={chooseRef}
                        type="button"
                        className="vc-limelight-choose"
                        aria-disabled={working}
                        onClick={() => void choose()}
                    >
                        Choose image
                    </button>
                    {imageId && (
                        <button type="button" className="vc-limelight-outline" aria-label="Remove image" onClick={remove}>
                            Remove
                        </button>
                    )}
                </div>
                <span className="vc-limelight-image-hint" role="status">
                    {working ? "Resizing your image" : "Kept on this PC, resized to fit tiles"}
                </span>
            </div>
        </div>
    );
}
