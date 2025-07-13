import { get_last } from './utilities'

class Word {
    static mode: string = 'word-list';

    transformations: string[];
    forms: string[];
    rejected: boolean;
    line_nums: string[];

    constructor(skeleton: string, adult: string) {
        this.transformations = [skeleton];
        this.forms = [adult];
        this.rejected = false; // This may be changed in transforms or when the word is ""
        this.line_nums = [''];
    }

    get_last_form(): string { // Gets canonical word. Use this when sorting the words
        let output = get_last(this.forms);
        if (output == undefined) {
            return "undefined";
        }
        return output;
    }

    get_word(): string { // Use this when creating the text
        let output: string | undefined = '';
        if (Word.mode == 'debug') {
            for (let i = 0; i < this.forms.length; i++) {
                output += `⟨${this.transformations[i]}⟩ :${this.line_nums[i]} ⟨${this.forms[i]}⟩\n`;
            }
            return output;
        }
        if (Word.mode == 'old-to-new') {
            output = `${this.forms[0]} => ${get_last(this.forms)}`;
            return output;
        }
        output = get_last(this.forms);
        if (output == undefined) {
            return "undefined";
        }
        return output;
    }

    record_transformation(rule:string, line_num:string, form:string): void {
        this.transformations.push(rule);
        this.forms.push(form);
        this.line_nums.push(line_num);
    }
}

export default Word;