/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Whose theme the palette popover is editing right now, so the stylesheet can
// preview it live. Plain state with listeners, no React.

let editingUserId: string | null = null;
const listeners = new Set<() => void>();

export function getEditingUserId(): string | null {
    return editingUserId;
}

export function setEditingUserId(id: string | null): void {
    if (id === editingUserId) return;
    editingUserId = id;
    for (const listener of [...listeners]) listener();
}

export function subscribeEditing(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
