import type Escape_Mapper from './escape_mapper';
import Logger from './logger';

import { getCatSeg, makePercentage,
    valid_category_brackets, 
 } from './utilities'

class Resolver {
    public logger: Logger;
    private escape_mapper: Escape_Mapper;
    public mode: string;

    public word_divider: string;

    public categories: Map<string, string>;

    public pre_transforms: {
        target:string[], result:string[],
        conditions:{ before:string, after:string }[], exceptions:{ before:string, after:string }[],
        line_num:string
    }[];
    public transforms: {
        target:string[], result:string[],
        conditions:{ before:string, after:string }[], exceptions:{ before:string, after:string }[],
        line_num:string
    }[];
    public graphemes: string[];

    private file_line_num = 0;

    public input_words: string[];

    constructor(
        logger: Logger,
        escape_mapper: Escape_Mapper,
        mode: string,
        word_divider: string
    ) {
        this.logger = logger;
        this.escape_mapper = escape_mapper;

        this.mode = mode;
        if (mode !== 'debug' && mode !== 'old-to-new') {
            this.mode = 'word-list';
        }

        this.word_divider = word_divider === "" ? '\n' : word_divider;
        this.word_divider = this.word_divider.replace(new RegExp('\\\\n', 'g'), '\n');
        
        this.categories = new Map;

        this.graphemes = [];

        this.input_words = [];

        this.pre_transforms = [];
        this.transforms = [];
    }

    parse_file(file: string) {

        let transform_mode = false;
        let file_array = file.split('\n');

        for (; this.file_line_num < file_array.length; ++this.file_line_num) {
            let line = file_array[this.file_line_num];
            let line_value = '';

            line = this.escape_mapper.escapeBackslashSpace(line);
            line = line.replace(/(?<!\\);.*/u, '').trim(); // Remove comment unless escaped with backslash

            if (line === '') { continue; } // Blank line !!

            if (transform_mode) { // Lets do transforms !!
                line_value = line;

                if (line_value.startsWith("END")) {
                    transform_mode = false;
                    continue;
                }
                
                if (line.startsWith("% ")) { // Parse clusters
                    this.parse_cluster(file_array);
                    continue;
                }
                
                let [target, result, conditions, exceptions] = this.GetTransform(line_value);

                this.add_transform(target, result, conditions, exceptions, `${this.file_line_num + 1}`);
                continue;
            }

            if (line.startsWith("BEGIN transform:")) {
                transform_mode = true;

            } else if (line.startsWith("graphemes:")) {
                line_value = line.substring(10).trim();
                line_value = this.escape_mapper.escapeBackslashPairs(line_value);

                let graphemes = line_value.split(/[,\s]+/).filter(Boolean);
                if (graphemes.length == 0){
                    this.logger.warn(`\`graphemes\` was introduced but there were no graphemes listed at ${this.file_line_num + 1} -- expected a list of graphemes`);
                }
                this.graphemes = graphemes;

            } else { // It's a category
                line_value = line;
                line_value = this.escape_mapper.escapeBackslashPairs(line_value);

                let [myName, field, valid, isCapital, hasDollarSign] = getCatSeg(line_value);

                if ( !valid || !isCapital ) {
                    this.logger.warn(`Junk ignored at line ${this.file_line_num + 1} -- expected a category, segment, directive, ..., etc`);
                    continue;
                }
                if (hasDollarSign) {
                   
                } else {
                    // CATEGORIES !!!
                    this.categories.set(myName, field);
                }
            }
        }
    }
    
    // CATEGORIES !!!
    expand_categories() {
        for (const [key, value] of this.categories) {
            this.categories.set( key, this.recursiveExpansion(value, this.categories, false) );
        }
    }

    recursiveExpansion(
        input: string,
        mappings: Map<string, string>,
        encloseInBrackets: boolean = false
    ): string {
        const mappingKeys = [...mappings.keys()].sort((a, b) => b.length - a.length);

        const resolveMapping = (str: string, history: string[] = []): string => {
            let result = '', i = 0;

            while (i < str.length) {
                let matched = false;

                for (const key of mappingKeys) {
                    if (str.startsWith(key, i)) {
                        if (history.includes(key)) {
                            this.logger.warn(`A cycle was detected when mapping "${key}"`);
                            result += '🔃';
                        } else {
                            let resolved = resolveMapping(mappings.get(key) || '', [...history, key]);
                            result += encloseInBrackets ? `[${resolved}]` : resolved;
                        }
                        i += key.length;
                        matched = true;
                        break;
                    }
                }
                if (!matched) result += str[i++];
            }
            return result;
        };
        return resolveMapping(input);
    }

    // TRANSFORMS !!!

    // This is run on parsing file. We then have to run resolve_transforms aftter parse file
    GetTransform(input: string): [
    string[], string[],
    { before: string; after: string }[],
    { before: string; after: string }[]
        ] {
        if (input === "") {
            throw new Error("No input");
        }

        const divided = input.split(/->|>|→/);
        if (divided.length === 1) {
            throw new Error(`No arrows in transform at line ${this.file_line_num + 1}`);
        }
        if (divided.length !== 2) {
            throw new Error(`Too many arrows in transform at line ${this.file_line_num + 1}`);
        }

        const target = divided[0].trim();
        if (target === "") {
            throw new Error(`Target is empty in transform at line ${this.file_line_num + 1}`);
        }
        if (!this.valid_transform_brackets(target)) {
            throw new Error("Target had missmatched brackets at line " + (this.file_line_num + 1));
        }
        const target_array = this.set_concurrent_changes(target);

        const slashIndex = divided[1].indexOf('/');
        const bangIndex = divided[1].indexOf('!');

        const delimiterIndex = Math.min(
            slashIndex === -1 ? Infinity : slashIndex,
            bangIndex === -1 ? Infinity : bangIndex
        );

        const result = delimiterIndex === Infinity
            ? divided[1].trim()
            : divided[1].slice(0, delimiterIndex).trim();

        if (result == "") {
            throw new Error(`Result is empty in transform at line ${this.file_line_num + 1}`);
        }
        if (!this.valid_transform_brackets(result)) {
            throw new Error("Result had missmatched brackets at line " + (this.file_line_num + 1));
        }
        const result_array = this.set_concurrent_changes(result);

        // If result array is not the same as target array send error
        if (target_array.length !== result_array.length) {
            throw new Error(`Target and result concurrent changes have different lengths at line ${this.file_line_num + 1}`);
        }

        const environment = delimiterIndex === Infinity
            ? ''
            : divided[1].slice(delimiterIndex).trim();

        const conditions: { before: string; after: string }[] = [];
        const exceptions: { before: string; after: string }[] = [];

        const blocks = environment.split('/').map(s => s.trim()).filter(Boolean);

        for (const block of blocks) {
            const segments = block.split('!').map(s => s.trim()).filter(Boolean);

            for (let i = 0; i < segments.length; i++) {
                const kind = i === 0 ? 'condition' : 'exception';
                const validated = this.validateContext(segments[i], kind);
                if (kind === 'condition') {
                    conditions.push(validated);
                } else {
                    exceptions.push(validated);
                }
            }
        }
        return [target_array, result_array, conditions, exceptions];
    }

    validateContext(segment: string, kind: 'condition' | 'exception'): { before: string; after: string } {
        const parts = segment.split('_');
        if (parts.length !== 2) {
            throw new Error(`${kind} "${segment}" must contain exactly one underscore`);
        }

        const [before, after] = parts;
        if (!before && !after) {
            throw new Error(`${kind} "${segment}" must have content on at least one side of '_'`);
        }

        return {
            before: before || '',
            after: after || ''
        };
    }

    add_transform(target:string[], result:string[], 
        conditions:{ before:string, after:string }[],
        exceptions:{ before:string, after:string }[],
        line_num:string) {
        this.pre_transforms.push( { target:target, result:result,
            conditions:conditions, exceptions:exceptions,
            line_num:line_num} );
    }

    set_concurrent_changes(target_result:string) {
        let result = [];
        let buffer = "";
        let insideBrackets = 0;

        for (let i = 0; i < target_result.length; i++) {
            const char = target_result[i];

            if (char === '[' || char === '(') {
                insideBrackets++;
            } else if (char === ']' || char === ')') {
                insideBrackets--;
            }

            if ((char === ' ' || char === ',') && insideBrackets === 0) {
                if (buffer.length > 0) {
                    result.push(buffer);
                    buffer = "";
                }
            } else {
                buffer += char;
            }
        }

        if (buffer.length > 0) {
            result.push(buffer);
        }

        return result;
    }



    private parse_cluster(file_array:string[]) {
        let line = file_array[this.file_line_num];
        line = line.replace(/;.*/u, '').trim(); // Remove comment!!
        if (line === '') { return; } // Blank line. End clusterfield... early !!
        let top_row = line.split(/[,\s]+/).filter(Boolean);
        top_row.shift();
        const row_length = top_row.length;
        this.file_line_num ++;

        let concurrent_target: string[] = [];
        let concurrent_result: string[] = [];

        for (; this.file_line_num < file_array.length; ++this.file_line_num) {
            let line = file_array[this.file_line_num];
            line = line.replace(/;.*/u, '').trim(); // Remove comment!!
            if (line === '') { break} // Blank line. End clusterfield !!

            let row = line.split(/[,\s]+/).filter(Boolean);
            let column = row[0];
            row.shift();

            if (row.length > row_length) {
                throw new Error(`Clusterfield row too long at line number ${this.file_line_num + 1}`);
            } else if (row.length < row_length) {
                throw new Error(`Clusterfield row too short at line number ${this.file_line_num + 1}`);
            }

            for (let i = 0; i < row_length; ++i) {
                if (row[i] === '+') {
                    continue;
                } else if (row[i] === '-') {
                    concurrent_target.push(column + top_row[i]!);
                    concurrent_result.push('^REJECT')
                } else {
                    concurrent_target.push(column + top_row[i]!);
                    concurrent_result.push(row[i]!);
                }
            }
        }
        this.add_transform(concurrent_target, concurrent_result, 
            [], [], `${this.file_line_num + 1}`);
    }

    resolve_transforms() {
         // Resolve brackets, put categories in transforms etc.
        
        let transforms = [];
        for (let i = 0; i < this.pre_transforms.length; i++) {
            let line_num = this.pre_transforms[i].line_num;

            let target = this.pre_transforms[i].target;

            let result = this.pre_transforms[i].result;

            let exceptions = [];
            for (let j = 0; j < this.pre_transforms[i].exceptions.length; j++) {
                let exception_before = this.pre_transforms[i].exceptions[j].before
                let exception_after = this.pre_transforms[i].exceptions[j].after;

                exceptions.push({ before:exception_before, after:exception_after });
            }

            let conditions = [];
            for (let j = 0; j < this.pre_transforms[i].conditions.length    ; j++) {
                let condition_before = this.pre_transforms[i].conditions[j].before
                let condition_after = this.pre_transforms[i].conditions[j].after;

                conditions.push({ before:condition_before, after:condition_after });
            }
            transforms.push({
                target: target, result: result,
                conditions: conditions, exceptions: exceptions,
                line_num: line_num
            });
        }
        this.transforms = transforms;
    }

    //private parse_target_result(target, result): [string[],string[]] {

    //}

    valid_transform_brackets(str: string): boolean {
        const stack: string[] = [];
        const bracketPairs: Record<string, string> = {
            ')': '(',
            '}': '{',
            ']': '[',
        };
        for (const char of str) {
            if (Object.values(bracketPairs).includes(char)) {
            stack.push(char); // Push opening brackets onto stack
            } else if (Object.keys(bracketPairs).includes(char)) {
            if (stack.length === 0 || stack.pop() !== bracketPairs[char]) {
                return false; // Unmatched closing bracket
            }
            }
        }
        return stack.length === 0; // Stack should be empty if balanced
    }


    create_record(): void {
        let categories = [];
        for (const [key, value] of this.categories) {
            let catField:string[] = [];

            catField.push(`${value}`);

            const category_field:string = `${catField.join(', ')}`;

            categories.push(`  ${key} = ${category_field}`);
        }

        let transforms = [];
        for (let i = 0; i < this.transforms.length; i++) {
            let exceptions = '';
            for (let j = 0; j < this.transforms[i].exceptions.length; j++) {
                exceptions += ` ! ${this.transforms[i].exceptions[j].before}_${this.transforms[i].exceptions[j].after}`;
            }
            let conditions = '';
            for (let j = 0; j < this.transforms[i].conditions.length    ; j++) {
                conditions += ` / ${this.transforms[i].conditions[j].before}_${this.transforms[i].conditions[j].after}`;
            }   
            transforms.push(`  ${this.transforms[i].target.join(", ")} → ${this.transforms[i].result.join(", ")} ${conditions} ${exceptions}`);
        }

        let info:string =
            `~ OPTIONS ~\n` +
            `Mode: ` + this.mode + 
            `\nWord divider: "` + this.word_divider + `"` +

            `\n\n~ FILE ~` +
            `\nCategories {\n` + categories.join('\n') + `\n}` +
            `\nTransforms {\n` + transforms.join('\n') + `\n}` +
            `\nGraphemes: ` + this.graphemes.join(', ');
        info = this.escape_mapper.restorePreserveEscapedChars(info);

        this.logger.info(info);
    }
}

export default Resolver;