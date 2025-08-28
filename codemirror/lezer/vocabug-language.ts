/*import { parser } from "./lezer/nesca-parser";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

// Highlighting
const nescaHighlight = styleTags({
  Comment: t.lineComment,
  Escape: t.escape,
  Operator: t.operator,
  Regexp: t.regexp,
  Reject: t.invalid,
  Weight: t.strong,
  ClassName: t.className,
  MacroName: t.definition(t.className),
  DistributionType: t.meta,
  MetaLine: t.meta,
  CategoryLine: t.className,
  SegmentLine: t.className,
  WordToken: t.variableName
});

// Language definition
export const nescaLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [nescaHighlight]
  }),
  languageData: {
    commentTokens: { line: ";" }
  }
});

// Extension
export function NescaSupport() {
  return new LanguageSupport(nescaLanguage);
}*/