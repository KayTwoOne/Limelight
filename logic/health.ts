/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Whether each part of Limelight is working, from facts the runtime gathers:
// which replacements matched (logic/replacement.ts), whether Equicord still has
// the patch waiting for Discord to load its code, whether the part's hook ran or
// threw, and what the probes saw on screen. Pure: the runtime supplies the facts.

export type Health = "working" | "ready" | "waiting" | "broken";

export interface PatchFacts {
    replacements: number;
    grouped: boolean;
    /** Replacements recorded as applied (each one, for an ungrouped patch) */
    matched: ReadonlySet<number>;
    /** A grouped patch applied whole, in one module */
    groupComplete: boolean;
    /** Still in Equicord's pending list: no Discord module has matched the find yet */
    pending: boolean;
    hookSeen: boolean;
    hookFailed: boolean;
    /** The watchdog saw this part's screen without its hook running */
    hookMissing: boolean;
}

// Not working comes first: a hook that threw, a screen shown without the hook,
// or a patch Equicord tried that didn't fully apply (even if one of its hooks ran,
// since then part of it is missing). An all patch never leaves the pending list,
// so for it only a completed match or a hook says anything.
export function patchHealth(f: PatchFacts): Health {
    if (f.hookFailed || f.hookMissing) return "broken";
    const applied = f.grouped ? f.groupComplete : f.matched.size === f.replacements;
    if (!applied && !f.pending) return "broken";
    if (f.hookSeen) return "working";
    if (applied) return "ready";
    return "waiting";
}

export interface ProbeFacts {
    /** Its screen showed long enough to judge */
    judged: boolean;
    found: boolean;
}

export function probeHealth(p: ProbeFacts): Health {
    if (p.found) return "working";
    return p.judged ? "broken" : "waiting";
}

// A probe looks at the screen on every watchdog tick. Found on screen: Working at
// once. Its screen showing without a find for a whole grace period: Not working
// (a gap shorter than that, or leaving the screen, restarts the count). Off
// screen: the last verdict stands, so the settings page can report the last call.
export interface ProbeState extends ProbeFacts {
    notFoundSince: number | null;
}

export function newProbe(): ProbeState {
    return { judged: false, found: false, notFoundSince: null };
}

// Returns true when the verdict changed.
export function stepProbe(s: ProbeState, live: boolean, found: boolean, now: number, graceMs: number): boolean {
    if (!live) {
        s.notFoundSince = null;
        return false;
    }
    if (found) {
        s.notFoundSince = null;
        const changed = !s.judged || !s.found;
        s.judged = true;
        s.found = true;
        return changed;
    }
    if (s.notFoundSince === null) {
        s.notFoundSince = now;
        return false;
    }
    if (now - s.notFoundSince < graceMs) return false;
    const changed = !s.judged || s.found;
    s.judged = true;
    s.found = false;
    return changed;
}

export type ProbeName = "tileThemes" | "chatLooks" | "stagePaint" | "foldPanel" | "chipTiles";

// A computed colour with nothing painted: the stage probe's test of the call
// container, which Discord paints black and the stage clears
export function isClear(colour: string): boolean {
    if (colour === "transparent") return true;
    const m = /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)$/.exec(colour);
    return m !== null && Number(m[1]) === 0;
}
export type Row = { group: string; label: string; when: string; } & ({ hook: string; } | { probe: ProbeName; });

// What the health view lists, in order. when: what to open for the row to be
// checked, shown while it is Ready or Waiting.
export const ROWS: readonly Row[] = [
    { group: "Call grid", label: "Tile themes and name pills", hook: "tiles", when: "Join a call" },
    { group: "Call grid", label: "Theme colours on the tiles", probe: "tileThemes", when: "Join a call with someone off camera" },
    { group: "Call grid", label: "One tile per person while streaming", hook: "fold", when: "Join a call" },
    { group: "Call grid", label: "Watch Stream inside the tile", hook: "watch", when: "Click Watch Stream on a stream" },
    { group: "Call grid", label: "Stream badge when maximised", hook: "badge", when: "Maximise a stream" },
    { group: "Call grid", label: "Palette button", hook: "tray", when: "Join a call" },
    { group: "Call grid", label: "No empty tile when you're alone", hook: "alone", when: "Join a call" },
    { group: "Call grid", label: "Small tiles", hook: "grid", when: "Join a call" },
    { group: "Call grid", label: "Small tiles as chips", probe: "chipTiles", when: "Set Small tile size to Chip, then join a call with someone small" },
    { group: "Call chat", label: "Channel picker", hook: "chat", when: "Open the call chat" },
    { group: "Call chat", label: "Channel links open in the chat", hook: "mention", when: "Click a channel link in the call chat" },
    { group: "Call chat", label: "Chat looks", probe: "chatLooks", when: "Open the call chat" },
    { group: "Elsewhere", label: "Pre-call screen", hook: "precall", when: "Open a voice channel you're not in" },
    { group: "Elsewhere", label: "No Invite to Voice row", hook: "invite", when: "Join a voice channel" },
    { group: "Stage", label: "Stage background", probe: "stagePaint", when: "Pick a stage background, then join a call" },
    { group: "Stage", label: "Channel list button", hook: "foldButton", when: "Switch it on in Stage, then join a call" },
    { group: "Stage", label: "User strip in the server list", probe: "foldPanel", when: "Fold the channel list during a call" }
];

export const STATE_LABEL: Record<Health, string> = {
    working: "Working",
    ready: "Ready",
    waiting: "Waiting",
    broken: "Not working"
};

export interface Summary {
    tone: "broken" | "fine" | "working";
    text: string;
}

export function summary(rows: ReadonlyArray<{ state: Health; }>): Summary {
    const broken = rows.filter(r => r.state === "broken").length;
    if (broken > 0) {
        const parts = broken === 1 ? "1 part of Limelight isn't" : `${broken} parts of Limelight aren't`;
        return { tone: "broken", text: `${parts} working. Discord's own version shows there instead.` };
    }
    if (rows.every(r => r.state === "working")) return { tone: "working", text: "Everything Limelight changes is working." };
    return { tone: "fine", text: "Nothing is broken. Ready and Waiting parts are checked when you open them." };
}

export interface Versions {
    limelight: string;
    discord: string;
    equicord: string;
}

// notes: what the runtime measured when something failed (the channel list fold
// records what it found in Discord's layout), so a report says why, not just what.
export function reportText(rows: ReadonlyArray<Row & { state: Health; }>, v: Versions, notes: readonly string[] = []): string {
    const lines = [`Limelight ${v.limelight} health`, `Discord ${v.discord}`, `Equicord ${v.equicord}`];
    let group = "";
    for (const r of rows) {
        if (r.group !== group) {
            group = r.group;
            lines.push("", group);
        }
        lines.push(`  ${STATE_LABEL[r.state].padEnd(12)}${r.label}`);
    }
    if (notes.length > 0) lines.push("", "Details", ...notes.map(note => `  ${note}`));
    return lines.join("\n");
}
