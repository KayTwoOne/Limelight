/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import * as Common from "@webpack/common";

import { toastCall, type ToastKind } from "../logic/toastCall";

const logger = new Logger("Limelight");

/** One toast, on Vencord or Equicord. A toast is never worth a crash; a failed one leaves a line in the console. */
export function limelightToast(text: string, kind: ToastKind = "message"): void {
    try {
        const common = Common as any;
        common.showToast(...toastCall(common, text, kind));
    } catch (error) {
        logger.warn("Toast failed", error);
    }
}
