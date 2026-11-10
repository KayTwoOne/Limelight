/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The health view on the plugin's settings page (mockup 2026-11-08-health-mockup):
// every part of Limelight with its state, a one-line summary, and a plain-text
// report to copy. It follows the session live: runtime/health.ts replaces its
// snapshot only when a state changes.

import { copyWithToast } from "@utils/discord";
import { React } from "@webpack/common";

import { reportText, STATE_LABEL, summary } from "../logic/health";
import { getHealth, healthNotes, type HealthRow, subscribeHealth, versions } from "../runtime/health";
import { TickIcon } from "./panelIcons";

const NOTE_BROKEN = {
    changed: "Discord changed this. Its own version shows instead.",
    error: "This hit an error, so Discord's own version shows instead."
};

function note(row: HealthRow): string | null {
    if (row.state === "broken") return "probe" in row ? "Discord changed what this styles." : NOTE_BROKEN[row.cause ?? "changed"];
    if (row.state === "ready" || row.state === "waiting") return row.when;
    return null;
}

function Row({ row }: { row: HealthRow; }) {
    const text = note(row);
    return (
        <li className="vc-limelight-health-row" data-state={row.state}>
            <span className="vc-limelight-health-text">
                <span className="vc-limelight-health-label">{row.label}</span>
                {text && <span className="vc-limelight-health-note">{text}</span>}
            </span>
            {/* Working recedes to a tick, so the badges left are the ones worth reading */}
            {row.state === "working"
                ? <span className="vc-limelight-chip" data-state="working" role="img" aria-label={STATE_LABEL.working} title={STATE_LABEL.working}><TickIcon /></span>
                : <span className="vc-limelight-chip" data-state={row.state}>{STATE_LABEL[row.state]}</span>}
        </li>
    );
}

export function HealthPanel() {
    const { rows, registered } = React.useSyncExternalStore(subscribeHealth, getHealth);
    const head = registered
        ? summary(rows)
        : { tone: "broken" as const, text: "Limelight's patches aren't in place yet. Restart Discord to finish turning it on." };
    const v = versions();

    const groups: Array<{ name: string; rows: HealthRow[]; }> = [];
    for (const row of rows) {
        const last = groups[groups.length - 1];
        if (last?.name === row.group) last.rows.push(row);
        else groups.push({ name: row.group, rows: [row] });
    }

    return (
        <div className="vc-limelight-field vc-limelight-health">
            <div className="vc-limelight-health-head">
                <span className="vc-limelight-section-label">Health</span>
                <button
                    type="button"
                    className="vc-limelight-outline"
                    onClick={() => copyWithToast(reportText(rows, v, healthNotes()), "Limelight's health report is copied")}
                >
                    Copy report
                </button>
            </div>
            <p className="vc-limelight-health-summary" data-tone={head.tone} role="status">
                <span className="vc-limelight-health-dot" aria-hidden="true" />
                <span>{head.text}</span>
            </p>
            <div className="vc-limelight-health-list">
                {groups.map(group => (
                    <React.Fragment key={group.name}>
                        <h4 className="vc-limelight-health-group">{group.name}</h4>
                        <ul className="vc-limelight-health-rows">
                            {group.rows.map(row => <Row key={row.label} row={row} />)}
                        </ul>
                    </React.Fragment>
                ))}
            </div>
            <p className="vc-limelight-health-legend">
                A tick: working, ran this session. Ready: in place, runs when you open it. Waiting: Discord hasn't loaded that part yet.
            </p>
            <p className="vc-limelight-health-versions">
                Limelight {v.limelight} · Discord {v.discord} · Equicord {v.equicord}
            </p>
        </div>
    );
}
