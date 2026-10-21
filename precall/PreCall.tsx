/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The screen Discord shows before you join a voice channel (its own name for it
// is ChannelCallEmpty): a stage that a chosen look paints behind Discord's
// content, and a Limelight button beside Join Voice that opens the palette on
// its Pre-call tab. The patch (patches.ts) hands these components Discord's own
// background and Button, and index.tsx wraps each factory in guard().
//
// Discord's own parts are never inside one of Limelight's error boundaries: the
// background and Join Voice render beside ours, so a failure here costs the
// stage or the button and never the screen's own controls.

import ErrorBoundary from "@components/ErrorBoundary";
import { Popout, React } from "@webpack/common";
import { type ComponentType, type CSSProperties, type ReactNode } from "react";

import { preCallBackdrop, type PreCallButtonColours, preCallButtonColours } from "../logic/precallButton";
import { Popover } from "../panel/PaletteButton";
import { useLimelightConfig } from "../store/configStore";
import { imageAverage, imageLightest, imageUrl, useImageUrl } from "../store/imageStore";
import { LimelightMark } from "../tiles/icons";

// The stage sits above Discord's animated background and paints only when the
// generated sheet gives it a background, which it does for Follow grid and for
// Own (once its image, if any, has loaded). Until then it is a transparent layer
// and Discord's background shows, so the screen never goes blank. The Discord
// look renders no stage at all.
function PreCallStage() {
    const { preCall } = useLimelightConfig();
    if (preCall.look === "discord") return null;
    return <div className="vc-limelight-precall-stage" aria-hidden="true" />;
}

interface PreCallBackgroundProps {
    // Discord's background component, and its prop.
    Original: ComponentType<any>;
    disableAnimation: boolean;
}

// Discord's background first and always, then the stage after it. The stage is
// in its own boundary and the original is outside it, in one fragment, so a
// look change adds or removes the stage without remounting Discord's animation.
export function PreCallBackground({ Original, disableAnimation }: PreCallBackgroundProps) {
    return (
        <>
            <Original disableAnimation={disableAnimation} />
            <ErrorBoundary noop>
                <PreCallStage />
            </ErrorBoundary>
        </>
    );
}

// Discord's Button builds its icon from a component: it renders it with a colour,
// a className and a size token ("refresh_sm", which Discord's own icons read as
// 20px). The mark draws its own colours and takes a number, so this keeps the
// className and passes the size itself.
function PreCallIcon({ className }: { className?: string; }) {
    return <LimelightMark size={20} className={className} strong />;
}

// The button's fill and ink: the screen's theme, checked against what is behind
// the button (logic/precallButton.ts). Read through the live config and the same
// image store the stylesheet reads, so changing the look, the colours or the
// picture while the screen is open recolours the button with it. The image URLs
// are subscribed only so that an image arriving works the colours out again; the
// colours themselves are read from the store inside the memo. Only the image the
// current look reads is subscribed to (Own's for Own, Everyone's for Follow grid),
// so a picture the look ignores is neither read nor waited for.
function usePreCallButtonColours(): PreCallButtonColours {
    const config = useLimelightConfig();
    const { preCall, everyone } = config;
    const ownUrl = useImageUrl(preCall.look === "own" && preCall.own.type === "image" ? preCall.own.imageId : undefined);
    const everyoneUrl = useImageUrl(preCall.look === "follow" && everyone.background.type === "image" ? everyone.background.imageId : undefined);
    return React.useMemo(
        () => preCallButtonColours(preCallBackdrop({ config, imageUrl, imageAverage, imageLightest })),
        [config, ownUrl, everyoneUrl]
    );
}

interface PreCallButtonProps {
    Button: ComponentType<any>;
}

// The Limelight button. The span is the Popout's target, so the panel opens
// above this button and not above the row. The popover opens on its Pre-call tab
// without changing the tab the call's palette last showed. The span also carries
// the button's colours, which precall.css lays over Discord's variant (it keeps
// Discord's Button, its size, radius, focus ring and placement).
function PreCallButton({ Button }: PreCallButtonProps) {
    const targetRef = React.useRef<HTMLSpanElement>(null);
    const { fill, ink } = usePreCallButtonColours();

    return (
        <Popout
            position="top"
            align="center"
            spacing={16}
            animation={Popout.Animation.FADE}
            targetElementRef={targetRef}
            renderPopout={({ closePopout }) => (
                <ErrorBoundary noop>
                    <Popover onClose={closePopout} initialTab="precall" />
                </ErrorBoundary>
            )}
        >
            {({ onClick }, { isShown }) => (
                <span
                    ref={targetRef}
                    className="vc-limelight-precall-button"
                    data-open={isShown}
                    style={{ "--ll-pc-fill": fill, "--ll-pc-ink": ink } as CSSProperties}
                >
                    <Button
                        variant="overlay-primary"
                        icon={PreCallIcon}
                        aria-label="Limelight: theme this screen"
                        aria-haspopup="dialog"
                        aria-expanded={isShown}
                        onClick={onClick}
                    />
                </span>
            )}
        </Popout>
    );
}

interface PreCallButtonsProps {
    // Discord's Button, and the props it was about to be rendered with.
    Button: ComponentType<any>;
    props: Record<string, unknown>;
}

// Join Voice, exactly as Discord builds it, with the Limelight button beside it.
export function PreCallButtons({ Button, props }: PreCallButtonsProps) {
    return (
        <div className="vc-limelight-precall-row">
            <Button {...props} />
            <ErrorBoundary noop>
                <PreCallButton Button={Button} />
            </ErrorBoundary>
        </div>
    );
}

// What the patch inserts for the background and for the button row.
export function preCallBackground(Original: ComponentType<any>, disableAnimation: boolean): ReactNode {
    return <PreCallBackground Original={Original} disableAnimation={disableAnimation} />;
}

export function preCallButtons(Button: ComponentType<any>, props: Record<string, unknown>): ReactNode {
    return <PreCallButtons Button={Button} props={props} />;
}
