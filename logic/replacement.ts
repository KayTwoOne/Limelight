/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Patches that report when they match. Equicord accepts a function as a patch's
// replacement and calls it only when the match succeeds, which is the one place a
// production build can learn that a patch applied: it keeps no record itself, and
// a patched module's toString shows Discord's original code. Each tracked
// replacement expands its template exactly as String.prototype.replace would, so
// the patched code is byte for byte what the plain string patch produces
// (tools/tests/replacement.test.ts, and tools/verify-patches.mjs on Discord's
// real modules). Pure: imports nothing.

type ReplaceFn = (...args: any[]) => string;

export interface ReplacementLike {
    match: string | RegExp;
    replace: string | ReplaceFn;
    [key: string]: unknown;
}

export interface PatchLike {
    find: string | RegExp;
    replacement: ReplacementLike | ReplacementLike[];
    group?: boolean;
    all?: boolean;
    [key: string]: unknown;
}

export interface MatchRecord {
    patch: number;
    replacement: number;
    /** Ungrouped: this replacement applied. Grouped: the whole group applied, in one module */
    complete: boolean;
}

// The arguments a replace callback receives: the match, each capture, the
// offset, the whole input, and the named groups when the pattern has any.
function parts(args: readonly unknown[]) {
    const last = args[args.length - 1];
    const named = typeof last === "object" && last !== null ? last as Record<string, string | undefined> : undefined;
    const tail = named ? 3 : 2;
    return {
        match: String(args[0]),
        captures: args.slice(1, args.length - tail) as Array<string | undefined>,
        offset: args[args.length - tail] as number,
        input: args[args.length - tail + 1] as string,
        named
    };
}

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

// String.prototype.replace's substitution rules (GetSubstitution), by hand: $$,
// $&, $`, $', $n and $nn (two digits only when that group exists), $<name>.
export function expandReplacement(template: string, args: readonly unknown[]): string {
    const { match, captures, offset, input, named } = parts(args);
    let out = "";
    for (let i = 0; i < template.length; i++) {
        const c = template[i];
        const n = template[i + 1];
        if (c !== "$" || n === undefined) { out += c; continue; }
        if (n === "$") { out += "$"; i++; continue; }
        if (n === "&") { out += match; i++; continue; }
        if (n === "`") { out += input.slice(0, offset); i++; continue; }
        if (n === "'") { out += input.slice(offset + match.length); i++; continue; }
        if (isDigit(n)) {
            const two = template[i + 2];
            if (isDigit(two)) {
                const nn = Number(n + two);
                if (nn >= 1 && nn <= captures.length) { out += captures[nn - 1] ?? ""; i += 2; continue; }
            }
            const d = Number(n);
            if (d >= 1 && d <= captures.length) { out += captures[d - 1] ?? ""; i++; continue; }
            out += c;
            continue;
        }
        if (n === "<" && named !== undefined) {
            const close = template.indexOf(">", i + 2);
            if (close >= 0) {
                out += named[template.slice(i + 2, close)] ?? "";
                i = close;
                continue;
            }
        }
        out += c;
    }
    return out;
}

const asArray = (r: ReplacementLike | ReplacementLike[]) => Array.isArray(r) ? r : [r];

// Copies of the patches whose replacements report each match through record.
// $self is expanded here, before the template, as Equicord does for a string.
// For a grouped patch a match only completes the group when it continues a chain
// in one module: replacement j's input must be exactly the code replacement j-1
// produced. A lookalike module where only some of the group match never
// completes, even though Equicord calls the ones that do. Recording can never
// change what a patch produces: it runs after the output is decided, inside try.
export function trackPatches<T extends PatchLike>(list: readonly T[], pluginPath: string, record: (r: MatchRecord) => void): T[] {
    return list.map((patch, i) => {
        const reps = asArray(patch.replacement);
        const grouped = Boolean(patch.group) && reps.length > 1;
        let chain: { next: number; text: string; } | null = null;
        const replacement = reps.map((rep, j) => {
            if (typeof rep.replace !== "string") return rep;
            const template = rep.replace.replaceAll("$self", pluginPath);
            const replace = (...args: unknown[]) => {
                const out = expandReplacement(template, args);
                try {
                    if (!grouped) {
                        record({ patch: i, replacement: j, complete: true });
                    } else {
                        const { match, offset, input } = parts(args);
                        const result = input.slice(0, offset) + out + input.slice(offset + match.length);
                        const continues = j === 0 || (chain !== null && chain.next === j && chain.text === input);
                        const complete = continues && j === reps.length - 1;
                        chain = continues && !complete ? { next: j + 1, text: result } : null;
                        record({ patch: i, replacement: j, complete });
                    }
                } catch { /* tracking must never break a patch */ }
                return out;
            };
            return { ...rep, replace };
        });
        return { ...patch, replacement: Array.isArray(patch.replacement) ? replacement : replacement[0] };
    });
}
