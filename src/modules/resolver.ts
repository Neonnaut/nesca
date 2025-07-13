import type Escape_Mapper from './escape_mapper';
import Logger from './logger';

import { getCatSeg, GetTransform, makePercentage, resolve_nested_categories,
    valid_category_brackets, 
    valid_category_weights
 } from './utilities'

type DiachronicRule = {
  target: string[];
  result: string[];
  condition: string[];
  exception: string[];
};

class Resolver {
    public logger: Logger;
    private escape_mapper: Escape_Mapper;
    public mode: string;

    public word_divider: string;

    private category_strings: Map<string, string>;
    public categories: Map<string, { graphemes:string[], weights:number[]} >;
    
    public transforms: { target:string[], result:string[], line_num:string}[];
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
        
        this.category_strings = new Map;
        this.categories = new Map;

        this.graphemes = [];
        this.transforms = [];

        this.input_words = [];
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
                
                let [target, result, valid] = GetTransform(line_value);

                if ( !valid ) {
                    this.logger.warn(`Malformed transform at line ${this.file_line_num + 1} -- expected \`old → new\` or a clusterfield`);
                    continue;
                } else if ( target.length != result.length ){
                    this.logger.warn(`Malformed transform at line ${this.file_line_num + 1} -- expected an equal amount of concurrent-set targets to concurrent-set results`);
                    continue;
                }

                this.add_transform(target, result, `${this.file_line_num + 1}`);
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
                    this.add_category(myName, field);
                }
            }
        }
    }
    
    add_category(name:string, field:string) {
        this.category_strings.set(name, field);
    }

    add_transform(target:string[], result:string[], line_num:string) {
        this.transforms.push( { target:target, result:result, line_num:line_num} );
    }

    expand_categories() {
        for (const [key, value] of this.category_strings) {
            if (!valid_category_brackets(value)) {
                throw new Error("A category had missmatched brackets");
            }
            if (!valid_category_weights(value)) {
                throw new Error("A category had invalid weights -- expected weights to follow an item and look like `*NUMBER` followed by either `,`, a bracket, or ` `");
            }
            this.category_strings.set( key, this.recursiveExpansion(value, this.category_strings, true) );
        }

        for (const [key, value] of this.category_strings) {
            const newCategoryField: { graphemes:string[], weights:number[]} = resolve_nested_categories(value, 'flat');
            this.categories.set(key, newCategoryField);
        }
    }



    parseDiachronicRule(ruleStr: string): DiachronicRule {
        const [leftSide, ...rhsParts] = ruleStr.split('/').map(s => s.trim());
        const [targetRaw, resultRaw] = leftSide.split('->').map(s => s.trim());

        const target = targetRaw.split(',').map(s => s.trim());
        const result = resultRaw.split(/\s+/).map(s => s.trim());

        const condition: string[] = [];
        const exception: string[] = [];

        for (const part of rhsParts) {
            const subParts = part.split('!').map(s => s.trim());
            if (subParts[0]) condition.push(subParts[0]);
            exception.push(...subParts.slice(1).filter(Boolean));
        }

        // Handle case with exceptions but no '/'
        if (rhsParts.length === 0 && resultRaw.includes('!')) {
            const [rPart, ...rawExceptions] = resultRaw.split('!').map(s => s.trim());
            result.length = 0;
            result.push(...rPart.split(/\s+/).filter(Boolean));
            exception.push(...rawExceptions.filter(Boolean));
        }
        return { target, result, condition, exception };
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
        this.add_transform(concurrent_target, concurrent_result, `${this.file_line_num + 1}`);
    }


    create_record(): void {
        let categories = [];
        for (const [key, value] of this.categories) {
            let catField:string[] = [];
            for (let i = 0; i < value.graphemes.length; i++) {
                catField.push(`${value.graphemes[i]}:${value.weights[i]}`);
            }
            const category_field:string = `${catField.join(', ')}`;

            categories.push(`  ${key} = ${category_field}`);
        }

        let transforms = [];
        for (let i = 0; i < this.transforms.length; i++) {
            transforms.push(`  ${this.transforms[i].target.join(", ")} → ${this.transforms[i].result.join(", ")}`);
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

        this.logger.silent_info(info);
    }
}

export default Resolver;