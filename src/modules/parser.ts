import type Escape_Mapper from './escape_mapper';
import Logger from './logger';

import type { Token, Output_Mode } from './types';
import { cappa } from './utilities';

class Parser {
    private logger: Logger;
    private escape_mapper: Escape_Mapper;

    public num_of_words: number;
    public output_mode: Output_Mode;
    public debug: boolean;
    public word_divider: string;
    public input_word_divider: string;

    public category_pending: Map<string, { content:string, line_num:number }>;
    public categories: Map<string, { graphemes:string[] }>;

    public feature_pending: Map<string, { content:string, line_num:number }>;
    public features: Map<string, { graphemes:string[] }>;
    
    public transform_pending: {
        target:string, result:string,
        conditions:string[], exceptions:string[],
        chance:(number|null),
        line_num:number
    }[];
    public transforms: {
        target:Token[][], result:Token[][],
        conditions:{ before:Token[], after:Token[] }[], exceptions:{ before:Token[], after:Token[] }[],
        chance:(number|null),
        line_num:number
    }[];
    public graphemes: string[];

    private file_line_num = 0;

    constructor(
        logger: Logger,
        escape_mapper: Escape_Mapper,
        output_mode: Output_Mode,
        word_divider: string
    ) {
        this.logger = logger;
        this.escape_mapper = escape_mapper;

        this.num_of_words = 0;

        this.output_mode = output_mode;
        this.debug = (output_mode === 'debug');
        this.word_divider = word_divider === "" ? '\n' : word_divider;

        this.word_divider = this.word_divider.replace(new RegExp('\\\\n', 'g'), '\n');
        this.input_word_divider = this.word_divider;

        if (this.debug) {
            this.word_divider = '\n';
        }
        
        this.category_pending = new Map;
        this.categories = new Map;

        this.graphemes = [];
        this.transform_pending = [];
        this.transforms = [];

        this.feature_pending = new Map;
        this.features = new Map;
    }

    
    parse_file(file: string) {

        let transform_mode = false;
        let file_array = file.split('\n');

        for (; this.file_line_num < file_array.length; ++this.file_line_num) {
            let line = file_array[this.file_line_num];
            let line_value = '';

            line = this.escape_mapper.escape_backslash_pairs(line);
            line = line.replace(/;.*/u, '').trim(); // Remove comment!!
            line = this.escape_mapper.escape_named_escape(line);
            if (line.includes('"{')) {
                this.logger.validation_error(`Invalid named escape`, this.file_line_num);
            }

            if (line === '') { continue; } // Blank line !!

            if (transform_mode) { // Lets do transforms !!
                line_value = line;

                if (line_value === "END") {
                    transform_mode = false;
                    continue;
                }
                
                if (line.startsWith("% ")) { // Parse clusterfield
                    this.parse_clusterfield(file_array);
                    continue;
                }

                if (line.startsWith("| ")) { // Engine
                    line_value = line.substring(2).trim().toLowerCase();

                    line_value = line_value.replace(/\bcapitalize\b/g, 'capitalise')

                    for (const engine of line_value.split(/\s+/)) {
                        if (engine == "decompose"||engine == "compose" ||
                            engine == "capitalise" || engine == "decapitalise" ||
                            engine == "to-upper-case" || engine == "to-lower-case" ||
                            engine == "xsampa-to-ipa" || engine == "ipa-to-xsampa"
                        ) {
                            this.transform_pending.push( {
                            target:`|${engine}`, result:'\\',
                            conditions:[], exceptions:[],
                            chance:null, line_num:this.file_line_num} );
                        } else {
                            this.logger.validation_error(
                                `Trash engine '${this.escape_mapper.restore_preserve_escaped_chars(engine)}' found`,
                                this.file_line_num
                            );
                        }
                    }
                    continue;
                }
                
                // Else it's a normal transform rule
                let [target, result, conditions, exceptions, chance] = this.get_transform(line_value);
                
                this.transform_pending.push( {
                    target:target, result:result,
                    conditions:conditions, exceptions:exceptions,
                    chance:chance, line_num:this.file_line_num} );
                continue;
            }

            if (line === "BEGIN transform:") {
                transform_mode = true;

            } else if (line.startsWith("graphemes:")) {
                line_value = line.substring(10).trim();

                let graphemes = line_value.split(/[,\s]+/).filter(Boolean);
                for (let i = 0; i < graphemes.length; i++) {
                    graphemes[i] = this.escape_mapper.restore_escaped_chars(graphemes[i]);
                }
                if (graphemes.length == 0){
                    this.logger.warn(`'graphemes' was introduced but there were no graphemes listed -- expected a list of graphemes`, this.file_line_num);
                }
                this.graphemes = graphemes;

            } else if (line.startsWith("+- ")) {
                this.parse_featurefield(file_array);

            } else { // It's a category or segment or feature
                line_value = line;

                const [key, field, mode] = this.get_cat_seg_fea(line_value);
                if (mode === "trash") {
                    this.logger.warn(`Junk ignored -- expected a category, segment, directive, ..., etc`, this.file_line_num);
                } else if (mode === 'category') {
                    // CATEGORIES !!!
                    this.category_pending.set(key, { content:field, line_num:this.file_line_num });
                } else if (mode === 'feature') {
                    // FEATURES !!!
                    const graphemes = field.split(/[,\s]+/).filter(Boolean);
                    if (graphemes.length == 0) {
                        this.logger.validation_error(`Feature ${key} had no graphemes`, this.file_line_num);
                    }
                    this.feature_pending.set(key, { content:graphemes.join(","), line_num:this.file_line_num });
                }
            }
        }
    }

    get_cat_seg_fea(input: string): [string, string, 'category'|'segment'|'feature'|'trash'] {
        const divider = "=";
    
        if (input === "") {
            return ['', '', 'trash']; // Handle invalid inputs
        }
        const divided = input.split(divider);
        if (divided.length !== 2) {
            return [input, '', 'trash']; // Ensure division results in exactly two parts
        }
        const key = divided[0].trim();
        const field = divided[1].trim();
        if (key === "" || field === "") {
            return [input, '', 'trash']; // Handle empty parts
        }

        // Construct dynamic regexes using cappa
        const categoryRegex = new RegExp(`^${cappa}$`);
        const segmentRegex = new RegExp(`^\\$${cappa}$`);
        const featureRegex = /^(\+|-|>)[a-zA-Z+-]+$/;

        if (categoryRegex.test(key)) {
            return [key, field, 'category'];
        }
        if (segmentRegex.test(key)) {
            return [key, field, 'segment'];
        }
        if (featureRegex.test(key)) {
            return [key, field, 'feature'];
        }
        return [input, '', 'trash'];
    }

    // TRANSFORMS !!!

    // This is run on parsing file. We then have to run resolve_transforms aftter parse file
    private get_transform(input: string): [
        string, string,
        string[],
        string[],
        (number|null)
    ] {
        if (input === "") {
            this.logger.validation_error(`No input`, this.file_line_num)
        }

        input = input.replace(/\/\//g, '!'); // Replace '//' with '!'
        const divided = input.split(/>|->|→|=>|⇒/);
        if (divided.length === 1) {
            this.logger.validation_error(`No arrows in transform`, this.file_line_num)
        }
        if (divided.length !== 2) {
            this.logger.validation_error(`Too many arrows in transform`, this.file_line_num);
        }

        const target = divided[0].trim();
        if (target === "") {
            this.logger.validation_error(`Target is empty in transform`, this.file_line_num);
        }
        if (!this.valid_transform_brackets(target)) {
            this.logger.validation_error(`Target had missmatched brackets`, this.file_line_num);
        }

        const slash_index = divided[1].indexOf('/');
        const bang_index = divided[1].indexOf('!');
        const question_index = divided[1].indexOf('?');

        const delimiter_index = Math.min(
            slash_index === -1 ? Infinity : slash_index,
            bang_index === -1 ? Infinity : bang_index,
            question_index === -1 ? Infinity : question_index
        );

        const result = delimiter_index === Infinity
            ? divided[1].trim()
            : divided[1].slice(0, delimiter_index).trim();

        if (result == "") {
            this.logger.validation_error(`Result is empty in transform`, this.file_line_num);
        }
        if (!this.valid_transform_brackets(result)) {
            this.logger.validation_error(`Result had missmatched brackets`, this.file_line_num);
        }

        const environment = delimiter_index === Infinity
            ? ''
            : divided[1].slice(delimiter_index).trim();

        const { conditions, exceptions, chance } = this.get_environment(environment);

        return [target, result, conditions, exceptions, chance];
    }

    private get_environment(environment_string: string): {
        conditions: string[];
        exceptions: string[];
        chance: number | null;
    } {
        const conditions: string[] = [];
        const exceptions: string[] = [];
        let chance: number | null = null;

        let buffer = "";
        let mode: "condition" | "exception" | "chance" = "condition";

        for (let i = 0; i < environment_string.length; i++) {
            const ch = environment_string[i];

            if (ch === '/') {
                if (buffer.trim()) {
                    const validated = this.validate_environment(buffer.trim(), mode);
                    (mode === "condition" ? conditions : exceptions).push(validated);
                }
                buffer = "";
                mode = "condition";
            } else if (ch === '!') {
                if (buffer.trim()) {
                    const validated = this.validate_environment(buffer.trim(), mode);
                    (mode === "condition" ? conditions : exceptions).push(validated);
                }
                buffer = "";
                mode = "exception";
            } else if (ch === '?') {
                if (buffer.trim()) {
                    const validated = this.validate_environment(buffer.trim(), mode);
                    (mode === "condition" ? conditions : exceptions).push(validated);
                }
                buffer = "";
                mode = "chance";
            } else {
                buffer += ch;
            }
        }

        if (buffer.trim()) {
            const segment = buffer.trim();
            if (mode === "chance") {
                const parsed = parseInt(segment, 10);
                if ( chance != null) {
                    this.logger.validation_error(`Duplicate chance value '${segment}'`, this.file_line_num);
                }
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                    chance = parsed;
                } else {
                    this.logger.validation_error(`Chance value "${segment}" must be between 0 and 100`, this.file_line_num);
                }
            } else {
                const validated = this.validate_environment(segment, mode);
                (mode === "condition" ? conditions : exceptions).push(validated);
            }
        }

        return {
            conditions: conditions,
            exceptions: exceptions,
            chance: chance
        };
    }

    private validate_environment(segment: string, kind: 'condition' | 'exception' | 'chance'): string {
        if (kind === 'chance') {
            const parsed = parseInt(segment, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                return segment;
            } else {
                this.logger.validation_error(`Chance "${segment}" must be a number between 0 and 100`, this.file_line_num);
            }
        }

        const parts = segment.split('_');
        if (parts.length !== 2) {
            this.logger.validation_error(`${kind} "${segment}" must contain exactly one underscore`, this.file_line_num);
        }

        const [before, after] = parts;
        if (!before && !after) {
            this.logger.validation_error(`${kind} "${segment}" must have content on at least one side of '_'`, this.file_line_num);
        }

        return `${before}_${after}`;
    }

    private parse_clusterfield(file_array:string[]) {
        let line = file_array[this.file_line_num];

        line = this.escape_mapper.escape_backslash_pairs(line);
        line = line.replace(/;.*/u, '').trim(); // Remove comment!!
        line = this.escape_mapper.escape_named_escape(line);

        if (line === '') { return; } // Blank line. End clusterfield... early !!
        let top_row = line.split(/[,\s]+/).filter(Boolean);
        top_row.shift();
        const row_length = top_row.length;
        this.file_line_num ++;

        let concurrent_target: string[] = [];
        let concurrent_result: string[] = [];

        let my_conditions: string[] = [];
        let my_exceptions: string[] = [];
        let my_chance: (number|null) = null;

        for (; this.file_line_num < file_array.length; ++this.file_line_num) {
            let line = file_array[this.file_line_num];
            
            line = this.escape_mapper.escape_backslash_pairs(line);
            line = line.replace(/;.*/u, '').trim(); // Remove comment!!
            line = this.escape_mapper.escape_named_escape(line);

            if (line === '') { break} // Blank line. End clusterfield !!

            if (line.startsWith('/') || line.startsWith('!')) {
                const { conditions, exceptions, chance } = this.get_environment(line);
                my_conditions.push(...conditions);
                my_exceptions.push(...exceptions);
                my_chance = chance;
                continue
            }

            let row = line.split(/[,\s]+/).filter(Boolean);
            let column = row[0];
            row.shift();

            if (row.length > row_length) {
                this.logger.validation_error(`Cluster-field row too long`, this.file_line_num);
            } else if (row.length < row_length) {
                this.logger.validation_error(`Cluster-field row too short`, this.file_line_num);
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
        this.transform_pending.push( {
            target:concurrent_target.join(','), result:concurrent_result.join(','),
            conditions:my_conditions, exceptions:my_exceptions,
            chance:my_chance, line_num:this.file_line_num} );
    }

    private parse_featurefield(file_array:string[]) {
        let line = file_array[this.file_line_num];

        line = this.escape_mapper.escape_backslash_pairs(line);
        line = line.replace(/;.*/u, '').trim(); // Remove comment!!
        line = this.escape_mapper.escape_named_escape(line);

        if (line === '') { return; } // Blank line. End clusterfield... early !!
        let top_row = line.split(/[,\s]+/).filter(Boolean);
        top_row.shift(); // Erase +-
        const row_length = top_row.length;
        this.file_line_num ++;

        for (; this.file_line_num < file_array.length; ++this.file_line_num) {
            let line = file_array[this.file_line_num];
            
            line = this.escape_mapper.escape_backslash_pairs(line);
            line = line.replace(/;.*/u, '').trim(); // Remove comment!!
            line = this.escape_mapper.escape_named_escape(line);

            if (line === '') { break} // Blank line. End clusterfield !!

            let row = line.split(/[,\s]+/).filter(Boolean);
            let column = row[0];
            row.shift();

            const featureRegex = /^[a-z]+$/;

            if (!featureRegex.test(column)) {
                this.logger.validation_error(`A feature in a feature-field must be of lowercase letters only.`, this.file_line_num)
            }

            if (row.length > row_length) {
                this.logger.validation_error(`Feature-field row too long`, this.file_line_num);
            } else if (row.length < row_length) {
                this.logger.validation_error(`Feature-field row too short`, this.file_line_num);
            }

            let my_pro_graphemes:string[] = [];
            let my_anti_graphemes:string[] = [];

            for (let i = 0; i < row_length; ++i) {
                if (row[i] === '.') {
                    continue;
                } else if ( row[i] === "+") {
                    my_pro_graphemes.push(top_row[i])
                } else if (row[i] === '-') {
                    my_anti_graphemes.push(top_row[i])
                }
            }
            if (my_pro_graphemes.length > 0 ) {
                this.feature_pending.set(`+${column}`, {content:my_pro_graphemes.join(","), line_num:this.file_line_num})
            }
            if (my_anti_graphemes.length > 0 ) {
                this.feature_pending.set(`-${column}`, {content:my_anti_graphemes.join(","), line_num:this.file_line_num})
            }
        }
    }
    
    private valid_transform_brackets(str: string): boolean {
        const stack: string[] = [];
        const bracket_pairs: Record<string, string> = {
            ')': '(',
            '}': '{',
            ']': '[',
        };
        for (const char of str) {
            if (Object.values(bracket_pairs).includes(char)) {
            stack.push(char); // Push opening brackets onto stack
            } else if (Object.keys(bracket_pairs).includes(char)) {
            if (stack.length === 0 || stack.pop() !== bracket_pairs[char]) {
                return false; // Unmatched closing bracket
            }
            }
        }
        return stack.length === 0; // Stack should be empty if balanced
    }
}

export default Parser;