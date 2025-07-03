import gen_words from './modules/core';

onmessage = function (event) {
    const nesca = gen_words(
        event.data.file,
        event.data.num_of_words,
        event.data.mode,
        event.data.sort_words,
        event.data.capitalise_words,
        event.data.remove_duplicates,
        event.data.force_words,
        event.data.word_divider
    );

    postMessage({
        words: nesca.text,
        file: event.data.file,
        
        error_message: nesca.errors,
        warning_message: nesca.warnings,
        info_message: nesca.infos
    });
}

