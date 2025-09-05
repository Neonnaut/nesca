import Logger from './logger';

import Word_Bank from './word_bank'
import Transformer from './transformer';
import Escape_Mapper from './escape_mapper';
import type { Output_Mode } from './types'

import Parser from './parser';
import CategoryResolver from './resolvers/category_resolver';
import FeatureResolver from './resolvers/feature_resolver';
import Nesca_Grammar_Stream from './resolvers/nesca_grammar_stream';
import Transform_Resolver from './resolvers/transform_resolver'

type apply_options = {
  file: string;
  input_words: string;
  apply_mode?: Output_Mode;
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

        const p = new Parser(
            logger, escape_mapper, apply_mode, word_divider
        );
        p.parse_file(file);

        const category_resolver = new CategoryResolver(
            logger, p.output_mode, escape_mapper, p.category_pending,);

        const feature_resolver = new FeatureResolver(
            logger, p.output_mode, escape_mapper, p.feature_pending, p.graphemes);

        const nesca_grammar_stream = new Nesca_Grammar_Stream(
            logger, p.graphemes, escape_mapper);

        const transform_resolver = new Transform_Resolver(
            logger, p.output_mode, nesca_grammar_stream, category_resolver.trans_categories,
            p.transform_pending, feature_resolver.features);
        
        // Phew! done resolving things

        const transformer = new Transformer( logger,
            p.graphemes, transform_resolver.transforms, p.output_mode
        );

        const b = new Word_Bank(logger, build_start, input_words, p.word_divider, p.input_word_divider, p.output_mode);

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