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
        
        error_messages: nesca.errors,
        warning_messages: nesca.warnings,
        info_messages: nesca.infos,
        diagnostic_messages: nesca.diagnostics
    });
}

