# Nesca

[![version][1]][2] [![license][3]][4] [![Tests]][badge-link]
[![issue count][5]][6] [![git activity][7]][8]

![Nesca logo](./img/nesca.svg?raw=true "Nesca")

Nesca is a "sound change applier", it takes a set of transformation rules and applies them to words to simulate historical sound changes or under similar conditions. It also offers other word modification utilities including capitalisation and X-SAMPA to IPA. Nesca is an easy to use but powerful tool for conlangers and linguists.

## Nesca online

Nesca lives online at [neonnaut.neocities.org/nesca][12]

## Documentation

Documentation lives online at [neonnaut.neocities.org/nesca_docs][13]

## API

Install with `npm install nesca`, or `yarn add nesca` and import it with either:

```ts
const nesca = require('nesca'); // CommonJS (Node.js)

import nesca from 'nesca'; // ES modules
```

There are two parts inside this `nesca` instance, the main function `apply()` and `examples`, below is a very minimal use of the program:
```ts
import nesca from 'nesca';
const def = nesca.apply({
    file: nesca.examples.basic
});

console.log(def.text);
console.log(def.warnings.join(", "));
console.log(def.errors.join(", "));
console.log(def.infos.join(", "));
```

The input signature for `nesca.apply()` is:
```ts
type apply_options = {
  file: string;
  input_words: string;
  apply_mode?: Apply_Mode;
  word_divider?: string;
};
```

The properties of the return type of `nesca.apply()` are:
```ts
type apply_output = {
    text: string; // The changed corpus of words.
    errors: string[]; // A list of errors that occurred, that terminated the run.
    warnings: string[]; // A list of warnings that occurred.
    infos: string[]; // Useful information about the run.
    diagnostics: string[]; // Useful information about parsing the file on debug mode.
}
```

There is 1 example to choose from in `nesca.examples`: `default`.

## Development

To build use `npm run build`. For live testing use `npm run dev`.

[1]: https://img.shields.io/npm/v/nesca
[2]: https://www.npmjs.com/package/nesca "npm package"
[3]: https://img.shields.io/npm/l/nesca
[4]: https://github.com/Neonnaut/nesca/blob/master/LICENSE "license text"
[5]: https://img.shields.io/github/issues-raw/Neonnaut/nesca
[6]: https://github.com/Neonnaut/nesca/issues "issues page"
[7]: https://img.shields.io/github/commit-activity/m/Neonnaut/nesca
[8]: https://github.com/Neonnaut/nesca/commits "commit log"

[badge-link]: https://github.com/Neonnaut/nesca/actions/workflows/ci.yml
[Tests]: https://github.com/Neonnaut/nesca/actions/workflows/ci.yml/badge.svg

[12]: https://neonnaut.neocities.org/nesca "deployment"
[13]: https://neonnaut.neocities.org/nesca_docs "docs"