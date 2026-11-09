/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Small tiles. Discord's grid gives every tile one size, so with anyone small
// Limelight renders Discord's own grid twice: everyone else in the main grid, the
// small tiles in a strip below or above, sized so a small tile is half (or a
// third) the width of a main one (logic/gridLayout.ts). At Chip, the strip is a
// row of one-line chips instead (ChipStrip.tsx). Each grid measures its own box,
// so the main grid grows into the room the strip leaves. With nobody small, or
// everyone small, it is Discord's grid exactly as it was, unwrapped.

import { React } from "@webpack/common";
import { type ComponentType, type ReactNode } from "react";

import { type TileSettings } from "../logic/config";
import { INNER_PAD, isSmall, solveStrip, STRIP_MIN } from "../logic/gridLayout";
import { getConfig, subscribe } from "../store/configStore";
import { chipHealth, ChipStrip, subscribeChips } from "./ChipStrip";

export interface GridProps {
    className?: string;
    keyExtractor?: (index: number) => unknown;
    paddingTop?: number;
    paddingBottom?: number;
    children?: ReadonlyArray<(width: number) => ReactNode>;
}

interface SplitGridProps {
    Grid: ComponentType<GridProps>;
    gridProps: GridProps;
    participants: unknown;
}

const tilesOf = () => getConfig().tiles;

function useTiles(): TileSettings {
    return React.useSyncExternalStore(subscribe, tilesOf);
}

function part(gridProps: GridProps, indices: readonly number[], top: number, bottom: number): GridProps {
    const children = gridProps.children ?? [];
    const key = gridProps.keyExtractor;
    return {
        ...gridProps,
        paddingTop: top,
        paddingBottom: bottom,
        children: indices.map(i => children[i]),
        keyExtractor: index => (key ? key(indices[index]) : indices[index])
    };
}

export function SplitGrid({ Grid, gridProps, participants }: SplitGridProps) {
    const tiles = useTiles();
    const chips = React.useSyncExternalStore(subscribeChips, chipHealth);
    const [box, setBox] = React.useState({ width: 0, height: 0 });
    const observer = React.useRef<ResizeObserver | null>(null);

    // A callback ref, since the wrapper only exists while the grid is split
    const measure = React.useCallback((node: HTMLDivElement | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!node) return;
        observer.current = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setBox(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
        });
        observer.current.observe(node);
    }, []);
    React.useEffect(() => () => observer.current?.disconnect(), []);

    const list = Array.isArray(participants) ? participants : [];
    const children = gridProps.children ?? [];
    const main: number[] = [];
    const small: number[] = [];
    // A tile past the participants (Discord's activity tile) stays in the main grid
    children.forEach((_, i) => (i < list.length && isSmall(list[i], tiles) ? small : main).push(i));

    if (small.length === 0 || main.length === 0) return <Grid {...gridProps} />;

    const outer = gridProps.paddingTop ?? 64;
    const below = tiles.place === "below";
    const mainGrid = (
        <div className="vc-limelight-split-main">
            <Grid {...part(gridProps, main, below ? outer : INNER_PAD, below ? INNER_PAD : gridProps.paddingBottom ?? 64)} />
        </div>
    );

    // Chip: one line per small person, drawn by Limelight around Discord's tile.
    // A chip that failed its check this session means Third instead.
    if (tiles.size === "chip" && chips !== "broken") {
        return (
            <div className="vc-limelight-split" ref={measure} data-place={tiles.place}>
                {mainGrid}
                <ChipStrip gridProps={gridProps} indices={small} participants={list} place={tiles.place} outer={below ? gridProps.paddingBottom ?? 64 : outer} />
            </div>
        );
    }

    const strip = solveStrip({
        width: box.width,
        height: box.height,
        mainCount: main.length,
        smallCount: small.length,
        ratio: tiles.size === "half" ? 0.5 : 1 / 3
    }) || STRIP_MIN;

    return (
        <div className="vc-limelight-split" ref={measure} data-place={tiles.place}>
            {mainGrid}
            <div className="vc-limelight-split-strip" style={{ height: strip }}>
                <Grid {...part(gridProps, small, below ? INNER_PAD : outer, below ? gridProps.paddingBottom ?? 64 : INNER_PAD)} />
            </div>
        </div>
    );
}
