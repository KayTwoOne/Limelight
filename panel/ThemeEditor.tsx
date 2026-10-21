/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The theme editor the People and Everyone tabs share (spec 6.4, tokens.md 5.7,
// 5.8, 5.10): a live preview, the background (Profile, Solid, Gradient or Image),
// the spotlight and the speaking ring. It owns no state of its own: every control
// hands the whole next theme to onChange, and the tab writes it through
// updateConfig, so a change reaches the real tile at once and is saved a moment
// later. The background section is exported on its own for the Chat tab's Own
// look, which has no Profile option.

import { React } from "@webpack/common";
import { type CSSProperties } from "react";

import { type Background, type BackgroundType, type SpotlightLevel, type Theme } from "../logic/config";
import { backgroundCss, SPOTLIGHT_OPACITY } from "../logic/theme";
import { useImageUrl } from "../store/imageStore";
import { ImageField } from "./ImageField";
import { Segmented, type SegmentOption } from "./Segmented";
import { FROM_COLOURS, RING_COLOURS, Swatches, TO_COLOURS } from "./Swatches";

// What a Profile background looks like in a preview. A person's own colour is
// their profile colour; where nothing is known, the neutral the mockup uses.
// Everyone has no single profile colour, so its preview shows three bands.
export const PROFILE_FALLBACK = "#232428";
const PROFILE_BANDS = "linear-gradient(90deg, #6b1518 0%, #6b1518 33%, #31475a 33%, #31475a 66%, #5d4436 66%)";

// The CSS background a preview or a theme swatch shows. A Profile background
// (or an image that has not loaded) shows `profile`, or the bands when that is
// null.
export function previewBackground(background: Background, imageUrl: string | null, profile: string | null): string {
    return backgroundCss(background, imageUrl) ?? profile ?? PROFILE_BANDS;
}

const BACKGROUND_OPTIONS: ReadonlyArray<SegmentOption<BackgroundType>> = [
    { id: "profile", label: "Profile" },
    { id: "solid", label: "Solid" },
    { id: "gradient", label: "Gradient" },
    { id: "image", label: "Image" }
];

const SPOTLIGHT_OPTIONS: ReadonlyArray<SegmentOption<SpotlightLevel>> = [
    { id: "off", label: "Off" },
    { id: "soft", label: "Soft" },
    { id: "bright", label: "Bright" }
];

interface LivePreviewProps {
    // A CSS background value.
    background: string;
    spotlight: SpotlightLevel;
    ring: string;
    label: string;
}

// The 92px preview (tokens.md 5.7): the background, the spotlight over it, a disc
// standing for the avatar with the ring around it, and a chip naming what it is.
// It repeats what the real tile shows, so it is hidden from assistive technology.
function LivePreview({ background, spotlight, ring, label }: LivePreviewProps) {
    return (
        <div className="vc-limelight-preview" aria-hidden="true" style={{ background }}>
            <div className="vc-limelight-preview-spot" style={{ opacity: SPOTLIGHT_OPACITY[spotlight] }} />
            <span className="vc-limelight-preview-disc" style={{ "--ll-preview-ring": ring } as CSSProperties} />
            <span className="vc-limelight-preview-chip">{label}</span>
        </div>
    );
}

interface BackgroundEditorProps {
    background: Background;
    onChange(next: Background): void;
    // The Chat tab's Own look has no Profile to follow.
    allowProfile?: boolean;
}

export function BackgroundEditor({ background, onChange, allowProfile = true }: BackgroundEditorProps) {
    const angleLabel = React.useId();
    const { type, imageId } = background;
    const options = allowProfile ? BACKGROUND_OPTIONS : BACKGROUND_OPTIONS.filter(option => option.id !== "profile");
    // Image was picked on a background that has no image yet. A background cannot
    // be Image without an image, so the empty image field is shown from here and
    // the theme keeps what it had until a file is chosen. It is remembered against
    // the background it was opened over (its signature), so it is over the moment
    // anything about that background changes, from here or from outside: the
    // pressed segment can never disagree with the saved theme for long.
    const signature = [type, background.from, background.to, background.angle, imageId ?? ""].join("|");
    const [choosingFor, setChoosingFor] = React.useState<string | null>(null);
    const choosing = choosingFor === signature;
    const showingImage = type === "image" || choosing;

    function pick(id: BackgroundType): void {
        if (id === "image") {
            if (type === "image") return;
            // A theme that still holds its image gets it back; otherwise the empty
            // field opens.
            if (imageId) onChange({ ...background, type: "image" });
            else setChoosingFor(signature);
            return;
        }
        setChoosingFor(null);
        onChange({ ...background, type: id });
    }

    return (
        <div className="vc-limelight-field">
            <span className="vc-limelight-section-label">Background</span>
            <Segmented
                label="Background"
                options={options}
                value={showingImage ? "image" : type}
                onChange={pick}
            />

            {type === "profile" && !choosing && (
                <p className="vc-limelight-caption">Their Discord profile colours, exactly as Discord shows them today.</p>
            )}

            {(type === "solid" || type === "gradient") && !choosing && (
                <Swatches
                    key="from"
                    colours={FROM_COLOURS}
                    value={background.from}
                    onChange={from => onChange({ ...background, from })}
                    label={type === "solid" ? "Colour" : "From"}
                />
            )}

            {type === "gradient" && !choosing && (
                <>
                    <Swatches
                        key="to"
                        colours={TO_COLOURS}
                        value={background.to}
                        onChange={to => onChange({ ...background, to })}
                        label="To"
                    />
                    <label className="vc-limelight-angle">
                        <span className="vc-limelight-angle-head">
                            <span id={angleLabel}>Angle</span>
                            <span className="vc-limelight-angle-value">{background.angle} degrees</span>
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            step={5}
                            value={background.angle}
                            aria-labelledby={angleLabel}
                            aria-valuetext={`${background.angle} degrees`}
                            onChange={event => onChange({ ...background, angle: event.currentTarget.valueAsNumber })}
                        />
                    </label>
                </>
            )}

            {showingImage && (
                <ImageField
                    imageId={imageId}
                    onChoose={chosen => onChange({ ...background, type: "image", imageId: chosen })}
                    onRemove={() => onChange({ ...background, type: allowProfile ? "profile" : "gradient", imageId: undefined })}
                />
            )}
        </div>
    );
}

interface ThemeEditorProps {
    theme: Theme;
    onChange(next: Theme): void;
    // What a Profile background looks like in the preview: this person's profile
    // colour, or null for Everyone, where it differs from person to person.
    profile: string | null;
}

export function ThemeEditor({ theme, onChange, profile }: ThemeEditorProps) {
    const { background, spotlight, ring } = theme;
    const varies = profile === null && background.type === "profile";
    const imageUrl = useImageUrl(background.type === "image" ? background.imageId : undefined);

    return (
        <>
            <LivePreview
                background={previewBackground(background, imageUrl, profile)}
                spotlight={spotlight}
                ring={ring}
                label={varies ? "Varies by person" : "Live preview"}
            />

            <BackgroundEditor background={background} onChange={next => onChange({ ...theme, background: next })} />

            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Spotlight</span>
                <Segmented
                    label="Spotlight"
                    options={SPOTLIGHT_OPTIONS}
                    value={spotlight}
                    onChange={next => onChange({ ...theme, spotlight: next })}
                />
            </div>

            <div className="vc-limelight-field">
                <span className="vc-limelight-section-label">Speaking ring</span>
                <Swatches
                    colours={RING_COLOURS}
                    value={ring}
                    onChange={next => onChange({ ...theme, ring: next })}
                    label="Speaking ring"
                    round
                    hideLabel
                />
            </div>
        </>
    );
}
