import Word from './word';
import Logger from './logger';

import { final_sentence } from './utilities';

class Word_Bank {
    public logger: Logger;
    public build_start: number;
    public words: Word[];
    private word_divider: string;
    private input_word_divider: string;

    private debug: boolean;

    private num_of_rejects = 0;
    private num_of_transformed = 0;
    private num_of_passed = 0;

    constructor(
        logger: Logger,
        build_start: number,
        input_words: string,
        word_divider: string = "\n",
        input_word_divider: string = "\n",
        debug: boolean,
        apply_mode: string
    ) {
        this.logger = logger;

        this.build_start = build_start;

        this.num_of_rejects = 0
        
        this.word_divider = word_divider;
        this.input_word_divider = input_word_divider;
        this.debug = debug;
        
        this.words = [];

        Word.apply_mode = apply_mode;

        if (input_words == '') {
            this.logger.validation_error("No input words to transform");
        }
        const input_word_array = input_words.split(this.input_word_divider);
        for (let i = 0; i < input_word_array.length; i++) {
            if (input_word_array[i] === '') { continue }
            const word = new Word(input_word_array[i].trim());
            this.words.push(word);
        }
    }

    make_text() {
        let word_list:string[] = [];
        for (let i = 0; i < this.words.length; i++) {
            const my_word = this.words[i];
            if (my_word.rejected) {
                this.num_of_rejects ++;
                if (this.debug) {
                    word_list.push(my_word.get_word());
                }
            } else {
                word_list.push(my_word.get_word());
                if (my_word.transformations.length > 1) {
                    this.num_of_transformed ++;
                } else {
                    this.num_of_passed ++;
                }
            }
        }
        this.create_record();
        return word_list.join(this.word_divider);
    }

    create_record() {
        // Send some good info about the results
        let ms:any = Date.now() - this.build_start;
        const display = ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s` : `${ms} ms`;
        
        let records:string[] = [];
        
        if (this.num_of_transformed == 1) {
            records.push(`1 word had transformations`);
        } else if (this.num_of_transformed > 1) {
            records.push(`${this.num_of_transformed} words had transformations`);
        }

        if (this.num_of_passed == 1) {
            records.push(`1 word unchanged`);
        } else if (this.words.length > 1) {
            records.push(`${this.num_of_passed} words unchanged`);
        }

        if (this.num_of_rejects == 1) {
            records.push(`1 word was rejected`);
        } else if (this.num_of_rejects > 1) {
            records.push(`${this.num_of_rejects} words rejected`);
        }
        this.logger.info(`${final_sentence(records)} -- in ${display}`);
    }
}

export default Word_Bank;