import Word from './word';
import Logger from './logger';

class Transformer {
    public logger: Logger;
   
    public graphemes: string[];
    public transforms: { target:string[], result:string[], line_num:string }[];

    constructor(
        logger: Logger,
        graphemes: string[],
        transforms: { target:string[], result:string[], line_num:string }[]
    ) {
        this.logger = logger;
        this.graphemes = graphemes;
        this.transforms = transforms;
    }

    graphemosis(input: string): string[] {
        const tokens: string[] = [];
        let i = 0;
        while (i < input.length) {
            let matched = false;
            for (const g of this.graphemes.sort((a, b) => b.length - a.length)) {
                if (input.startsWith(g, i)) {
                    tokens.push(g);
                    i += g.length;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                tokens.push(input[i]);
                i++;
            }
        }

        return tokens;
    }

    spanToLength(tokens: string[], targetLength: number): number {
        let total = 0;
        for (let i = 0; i < tokens.length; i++) {
            total += tokens[i].length;
            if (total >= targetLength) return i + 1;
        }
        return tokens.length;
    }


    applyTransform(
    word: Word,
    tokens: string[],
    transform: {
        target: string[];
        result: string[];
        conditions: { before: string; after: string }[];
        exceptions: { before: string; after: string }[];
        line_num: string;
    }
    ): string[] {
        function spanToLength(subTokens: string[], targetLen: number): number {
            let count = 0;
            for (let i = 0; i < subTokens.length; i++) {
                count += subTokens[i].length;
                if (count >= targetLen) return i + 1;
            }
            return subTokens.length;
        }

        function contextMatches(
            full: string,
            startIdx: number,
            rawSearch: string,
            before: string,
            after: string
        ): boolean {
            const targetLen = rawSearch.length;

            // BEFORE anchor
            if (before === "#") {
                if (startIdx !== 0) return false;
            } else if (before.startsWith("#")) {
                const expected = before.slice(1);
                const actualPrefix = full.slice(0, startIdx);
                if (startIdx !== 0 || actualPrefix !== expected) return false;
            } else {
                const actualBefore = full.slice(Math.max(0, startIdx - before.length), startIdx);
                if (actualBefore !== before) return false;
            }

            // AFTER anchor
            if (after === "#") {
                if (startIdx + targetLen !== full.length) return false;
            } else if (after.endsWith("#")) {
                const expected = after.slice(0, -1);
                const actualSuffix = full.slice(startIdx + targetLen);
                if (startIdx + targetLen !== full.length || actualSuffix !== expected) return false;
            } else {
                const actualAfter = full.slice(startIdx + targetLen, startIdx + targetLen + after.length);
                if (actualAfter !== after) return false;
            }

            return true;
        }

        const { target, result, conditions, exceptions } = transform;

        if (target.length !== result.length) {
            throw new Error("Mismatched target/result concurrent set lengths in a transform");
        }

        const replacements: { index: number; length: number; replacement: string }[] = [];
        const fullWord = tokens.join("");

        for (let i = 0; i < target.length; i++) {
            let rawSearch = target[i].replace(/\\/g, "");
            const isDelete = result[i] === "^";
            let replacement = isDelete ? "" : result[i].replace(/\\/g, "");

            if (replacement === "^REJECT") {
                for (let j = 0; j < tokens.length; j++) {
                    const subTokens = tokens.slice(j);
                    const span = spanToLength(subTokens, rawSearch.length);
                    const window = subTokens.slice(0, span).join("");
                    if (window === rawSearch) {
                        word.rejected = true;
                        word.record_transformation(`${rawSearch} → ^REJECT`, transform.line_num, "❌");
                        return tokens;
                    }
                }
            }

            // Hacky way to get escape characters
            rawSearch = rawSearch.replace(/\\/g, "");
            replacement = replacement.replace(/\\/g, "");

            // 🔍 Anywhere match
            for (let j = 0; j < tokens.length; j++) {
                const subTokens = tokens.slice(j);
                const span = spanToLength(subTokens, rawSearch.length);
                const window = subTokens.slice(0, span).join("");

                if (window === rawSearch) {
                    const startIdx = tokens.slice(0, j).join("").length;

                    const passesCondition = conditions.length === 0 || conditions.some(cond =>
                        contextMatches(fullWord, startIdx, rawSearch, cond.before, cond.after)
                    );

                    const blockedByException = exceptions.some(exc =>
                        contextMatches(fullWord, startIdx, rawSearch, exc.before, exc.after)
                    );

                    if (passesCondition && !blockedByException) {
                        replacements.push({ index: j, length: span, replacement });
                    }
                }
            }
        }

        // ✂️ Apply replacements non-destructively
        replacements.sort((a, b) => a.index - b.index);
        const blocked = new Set<number>();
        const resultTokens: string[] = [];

        let i = 0;
        while (i < tokens.length) {
            const match = replacements.find(
                r =>
                    r.index === i &&
                    ![...Array(r.length).keys()].some(k => blocked.has(i + k))
            );
            if (match) {
                if (match.replacement !== "") {
                    resultTokens.push(match.replacement);
                }
                for (let k = 0; k < match.length; k++) {
                    blocked.add(i + k);
                }
                i += match.length;
            } else {
                resultTokens.push(tokens[i]);
                i++;
            }
        }

        const normalized = this.graphemosis(resultTokens.join(""));

        const appliedSet = new Set(
            replacements.map(r => r.replacement === "" ? "^" : r.replacement)
        );
        const matchedTargets: string[] = [];
        const matchedResults: string[] = [];

        for (let i = 0; i < transform.target.length; i++) {
            const expected = transform.result[i] === "^" ? "" : transform.result[i];
            if (appliedSet.has(expected)) {
                matchedTargets.push(transform.target[i]);
                matchedResults.push(transform.result[i]);
            }
        }

        if (matchedTargets.length > 0) {
            word.record_transformation(
                `${matchedTargets.join(", ")} → ${matchedResults.join(", ")}`,
                transform.line_num,
                normalized.join(" ")
            );
        }

        return normalized;
    }

    do_transforms(
        word: Word,
    ): Word {
        if (word.get_last_form() == ''){
            word.rejected = true;
            return word;
        }
        if (this.transforms.length == 0) {
            return word; // No transforms 
        }

        let tokens = this.graphemosis(word.get_last_form());
        word.record_transformation("graphemosis", '', `${tokens.join(" ")}`);

        for (const t of this.transforms) {
            if (word.rejected) {
                break;
            }
            tokens = this.applyTransform(word, tokens, t);
            if (tokens.length == 0) {
                word.rejected = true;
                word.record_transformation(`REJECT NULL WORD`, '', `❌`);
            }
        }

        if (!word.rejected) {
            word.record_transformation("retrographemosis", '', `${tokens.join("")}`);
        }

        return word;
    }
}

export default Transformer;