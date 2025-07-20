import Logger from './logger';

import Resolver from './resolver';
import Word_Bank from './word_bank'
import Transformer from './transformer';
import Escape_Mapper from './escape_mapper';

function gen_words(
    file: string,
    input_words: string,
    mode: string = 'word-list',
    word_divider: string = "\n"
): { text:string, errors:string[], warnings:string[], infos:string[], diagnostics:string[] } {
    const logger = new Logger();
    let text = '';

    try {
        const build_start = Date.now();
        
        const escape_mapper = new Escape_Mapper();

        const r = new Resolver( logger, escape_mapper, mode, word_divider );
        r.parse_file(file);

        r.expand_categories();

        r.resolve_transforms();
        r.create_record();

        const b = new Word_Bank(logger, input_words, r.word_divider, r.mode);

        const transformer = new Transformer( logger, r.graphemes, r.transforms );

        // Yo! this is where we change da words !!
        // Wow. Such change
        for (let i = 0; i < b.words.length; i++) {
            b.words[i] = transformer.do_transforms(b.words[i]);
        }
        text = b.make_text();

    } catch (e: unknown) {
        if (!(e instanceof logger.ValidationError)) {
            logger.uncaught_error(e as Error);
        }
    }

    return { text:text, errors:logger.errors, warnings:logger.warnings,
        infos:logger.infos, diagnostics:logger.diagnostics };
}

export default gen_words;