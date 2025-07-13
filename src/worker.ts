import gen_words from './modules/core';

onmessage = function (event) {
    const nesca = gen_words(
        event.data.file,
        event.data.input_words,
        event.data.mode,
        event.data.word_divider
    );

    postMessage({
        words: nesca.text,
        file: event.data.file,
        input_words: event.data.input_words,
        
        error_message: nesca.errors,
        warning_message: nesca.warnings,
        info_message: nesca.infos
    });
}

