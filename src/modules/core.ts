import Logger from './logger';

import Resolver from './resolver';
import Word_Bank from './word_bank'
import Transformer from './transformer';
import Escape_Mapper from './escape_mapper';
import Transform_Resolver from './transform_resolver';
import Nesca_Grammar_Stream from './nesca_grammar_stream';
import type { Apply_Mode } from './types'

type apply_options = {
  file: string;
  input_words: string;
  apply_mode?: Apply_Mode;
  word_divider?: string;
};

function apply({
    file,
    input_words,
    apply_mode = 'word-list',
    word_divider = "\n"
}: apply_options): {
    text: string;
    errors: string[];
    warnings: string[];
    infos: string[];
    diagnostics: string[];
} {
    const logger = new Logger();
    let text = '';

    try {
        const build_start = Date.now();

        const escape_mapper = new Escape_Mapper();

        const r = new Resolver( logger, escape_mapper, apply_mode, word_divider );

        r.parse_file(file);
        r.resolve_categories();

        r.resolve_features();

        const nesca_grammar_stream = new Nesca_Grammar_Stream(
            logger, r.graphemes, escape_mapper
        );
        const transform_resolver = new Transform_Resolver(
            logger, nesca_grammar_stream, r.categories, r.transform_pending, r.features
        )
        r.set_transforms(transform_resolver.resolve_transforms());

        if(r.debug) { r.create_record(); }

        const transformer = new Transformer( logger,
            r.graphemes, r.transforms, r.debug
        );

        const b = new Word_Bank(logger, build_start, input_words, r.word_divider, r.input_word_divider, r.debug, r.apply_mode);

        // Yo! this is where we change da words !!
        // Wow. Such change
        for (let i = 0; i < b.words.length; i++) {
            b.words[i] = transformer.do_transforms(b.words[i]);
        }
        text = b.make_text();

    } catch (e: unknown) {
        if (!(e instanceof logger.Validation_Error)) {
            logger.uncaught_error(e as Error);
        }
    }

    return { text:text, errors:logger.errors, warnings:logger.warnings,
        infos:logger.infos, diagnostics:logger.diagnostics };
}

export default apply;