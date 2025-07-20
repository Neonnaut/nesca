import Word from './word';
import Logger from './logger';
import collator from './collator';
import { capitalise } from './utilities';
import type Escape_Mapper from './escape_mapper';

class Word_Bank {
    public logger: Logger;
    public words: Word[];
    private word_divider: string;


    constructor(
        logger: Logger,
        input_words: string,
        word_divider: string = "\n",
        mode: string
    ) {
        this.logger = logger;
        
        this.word_divider = word_divider;
        this.words = [];

        Word.mode = mode;

        if (input_words == '') {
            throw new Error("No input words to transform")
        }
        const input_word_array = input_words.split(this.word_divider);
        for (let i = 0; i < input_word_array.length; i++) {
            if (input_word_array[i] === '') { continue }
            const word = new Word('Input-word', input_word_array[i].trim());
            this.words.push(word);
        }
    }

    make_text() {
        let word_list = [];
        for (let i = 0; i < this.words.length; i++) {
            word_list.push(this.words[i].get_word());
        }
        return word_list.join(this.word_divider);
    }
}

export default Word_Bank;