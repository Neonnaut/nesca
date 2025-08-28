//import nesca from '../dist/nesca.es.js';

import nesca from '../src/index'


import { describe, it, expect } from 'vitest';

describe('nesca', () => {
  it('returns changed words', () => {

    for (const [name, example] of Object.entries(nesca.examples)) {

      const run = nesca.apply({
        file: example,
        input_words: "aa",
        apply_mode: "word-list",
        word_divider: ", "
      });
      expect(typeof run.text).toBe('string');
      expect(run.text.length).toBeGreaterThan(0);
      expect(run.errors.length).toBeLessThan(1);
      expect(run.warnings.length).toBeLessThan(1);
      expect(run.infos.length).toBeGreaterThan(0);
      //expect(run.diagnostics.length).toBeGreaterThan(0);
      console.log(`Example: ${name}; words: ${run.text}`);
    }
  });
});