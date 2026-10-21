/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The theme dot beside a name in the call chat (spec 8.3, tokens.md 7.3): 8px, the
// colour of the person's tile, lightened where it must be to reach 3:1 against the
// chat surface. It is decoration, so it is hidden from assistive technology: the
// name beside it carries the meaning. It reads the config reactively, so changing
// the look, switching dots off or recolouring a theme updates the dots already on
// screen. Disable all user themes ignores every person's colour (spec 5.6), so a
// dot coloured by one would contradict it: there is none while it is on. chat.css
// shows the dot only under the call chat scope root.

import { UserProfileStore, useStateFromStores } from "@webpack/common";

import { normaliseHex } from "../logic/colour";
import { chatSurface } from "../logic/scrim";
import { dotColour, themeFor } from "../logic/theme";
import { useLimelightConfig } from "../store/configStore";
import { imageAverage, imageLightest, useImageUrl } from "../store/imageStore";

// A person's profile colour as a hex string, or "" when Discord has none: a
// primitive, so the store mapper below can compare it with ===.
function profileColour(userId: string): string {
    const profile = UserProfileStore.getUserProfile(userId);
    const colour = profile?.accentColor ?? profile?.themeColors?.[0];
    return typeof colour === "number" ? normaliseHex("#" + colour.toString(16).padStart(6, "0")) ?? "" : "";
}

interface ThemeDotProps {
    userId: string;
}

export function ThemeDot({ userId }: ThemeDotProps) {
    const config = useLimelightConfig();
    const { theme } = themeFor(config, userId);
    const themeImage = theme.background.type === "image" ? theme.background.imageId : undefined;
    const ownImage = config.chat.own.type === "image" ? config.chat.own.imageId : undefined;
    const everyoneImage = config.everyone.background.type === "image" ? config.everyone.background.imageId : undefined;
    // Subscribed only to re-render when a stored image arrives; the colours are
    // read from the store below.
    useImageUrl(themeImage);
    useImageUrl(ownImage);
    useImageUrl(everyoneImage);
    const profile = useStateFromStores([UserProfileStore], () => profileColour(userId), [userId]);

    if (config.chat.look === "discord" || !config.chat.themeDots || config.display.disableUserThemes) return null;

    const fallback = themeImage ? imageAverage(themeImage) : profile || null;
    const surface = chatSurface(
        config.chat,
        config.everyone,
        ownImage ? imageLightest(ownImage) : null,
        everyoneImage ? imageAverage(everyoneImage) : null
    );
    return <span className="vc-limelight-dot" aria-hidden="true" style={{ background: dotColour(theme, surface, fallback) }} />;
}
