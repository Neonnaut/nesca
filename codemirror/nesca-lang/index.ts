import { StreamLanguage } from '@codemirror/language';
import { StreamParser } from '@codemirror/language';


/***********************
 * Syntax highlighting *
 ***********************/

const cappa = "[A-Z" +
    // Latin acute
    "\u00C1\u0106\u00C9\u01F4\u00CD\u1E30\u0139\u1E3E\u0143\u00D3\u1E54\u0154\u015A\u00DA\u1E82\u00DD\u0179" +
  
    // Diaeresis
    "\u00C4\u00CB\u1E26\u00CF\u00D6\u00DC\u1E84\u1E8C\u0178" +

    // Caron
    "\u01CD\u010C\u010E\u011A\u01E6\u021E\u01CF\u01E8\u013D\u0147\u01D1\u0158\u0160\u0164\u01D3\u017D" +

    // Grave
    "\u00C0\u00C8\u00CC\u01F8\u00D2\u00D9\u1E80\u1EF2" +

    // Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω
    "\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9]";

const nescaEngineRules = [
  { token: "operator",     regex: /\s+(compose|decompose|capitalise|decapitalise|capitalize|decapitalize|to-upper-case|to-lower-case|xsampa-to-ipa|ipa-to-xsampa)(?!\S)/ }
];
const nescaListRules = [
  { token: "escape",   regex: /\\.|@\{(?:Space|Acute|DoubleAcute|Grave|DoubleGrave|Circumflex|Caron|Breve|InvertedBreve|TildeAbove|TildeBelow|Macron|Dot|DotBelow|Diaeresis|DiaeresisBelow|Ring|RingBelow|Horn|Hook|CommaAbove|CommaBelow|Cedilla|Ogonek)\}/ },
  { token: "link",     regex: /,/ }
];

const nescaCategoryRules = [
  { token: "escape",   regex: /\\.|@\{(?:Space|Acute|DoubleAcute|Grave|DoubleGrave|Circumflex|Caron|Breve|InvertedBreve|TildeAbove|TildeBelow|Macron|Dot|DotBelow|Diaeresis|DiaeresisBelow|Ring|RingBelow|Horn|Hook|CommaAbove|CommaBelow|Cedilla|Ogonek)\}/ },
  { token: "link",     regex: /,|=/ },
  { token: "operator", regex: /\^|∅/ }
];

const nescaFeatureRules = [
  { token: "escape",   regex: /\\.|@\{(?:Space|Acute|DoubleAcute|Grave|DoubleGrave|Circumflex|Caron|Breve|InvertedBreve|TildeAbove|TildeBelow|Macron|Dot|DotBelow|Diaeresis|DiaeresisBelow|Ring|RingBelow|Horn|Hook|CommaAbove|CommaBelow|Cedilla|Ogonek)\}/ },
  { token: "link",     regex: /,|=/ }
];

const nescaTransformRules = [
  { token: "escape",   regex: /\\.|@\{(?:Space|Acute|DoubleAcute|Grave|DoubleGrave|Circumflex|Caron|Breve|InvertedBreve|TildeAbove|TildeBelow|Macron|Dot|DotBelow|Diaeresis|DiaeresisBelow|Ring|RingBelow|Horn|Hook|CommaAbove|CommaBelow|Cedilla|Ogonek)\}/ },
  { token: "link",     regex: />|->|→|=>|⇒|\/|!|\?|,|_/ },
  { token: "operator", regex: /\^REJECT|\^R|\^|∅|~/ }, // > and ;
  { token: "regexp",   regex: /\[|\]|\(|\)|\{|\}|#|\+|\*|:|…|&|</ }
];

const nescaClusterRules = [
  { token: "escape",   regex: /\\.|@\{(?:Space|Acute|DoubleAcute|Grave|DoubleGrave|Circumflex|Caron|Breve|InvertedBreve|TildeAbove|TildeBelow|Macron|Dot|DotBelow|Diaeresis|DiaeresisBelow|Ring|RingBelow|Horn|Hook|CommaAbove|CommaBelow|Cedilla|Ogonek)\}/ },
  { token: "link",     regex: /,|\/|!|\?|_|\+/ },
  { token: "operator", regex: /\-|\^REJECT|\^R|\^|∅/ }, // > and ;
  { token: "regexp",   regex: /\[|\]|\(|\)|\{|\}|#|\+|\*|:|…|&/ }
];

const nescaFeatureFieldRules = [
  { token: "escape",   regex: /\\.|@\{(?:Space|Acute|DoubleAcute|Grave|DoubleGrave|Circumflex|Caron|Breve|InvertedBreve|TildeAbove|TildeBelow|Macron|Dot|DotBelow|Diaeresis|DiaeresisBelow|Ring|RingBelow|Horn|Hook|CommaAbove|CommaBelow|Cedilla|Ogonek)\}/ },
  { token: "link",     regex: /,|\./ },
  { token: "operator", regex: /\+/ },
  { token : "regexp",   regex: /-/ }
];

type State = {
  mode: string;
  feature_matrix: boolean;
  transform: boolean;
  doIndent: boolean;
  blanko: boolean;
  classList: string[];
  featureList: string[];
};

const nescaParser: StreamParser<State> = {

    name: "Nesca",
    startState: (i): State => { return {
        mode: 'none',
        feature_matrix: false,
        transform: false,
        doIndent: false,
        blanko: false,
        classList: [],
        featureList: []
    }},
    blankLine: function (state){
        if (!state.blanko && ( state.mode == 'clusterBlock' || state.mode == 'featureField') ) {
            state.blanko = true;
        };},
    token: function (stream, state) {
        // Comment / GREEN /
        if (stream.match(/\s*;.*$/)) {
            if (state.mode == 'clusterBlock'){
                state.mode = 'transform';
            } else if (state.mode != 'transform' && state.mode != 'wordsBlock') {
                state.mode = 'none';
            }
            if (state.blanko) {state.blanko = false};
            return "comment";
        }
        if (stream.sol()) {
            state.feature_matrix = false;
            // No more clusterblock we reached line with blankspaces
            if (stream.string.trim() == "" && ( state.mode == 'clusterBlock' || state.mode == 'featureField' )) { 
                state.blanko = true;
            }

            if (state.mode == 'engine') {
                state.mode = 'transform';
            } else if (stream.string.trim() && state.mode != 'clusterBlock' && state.mode != 'transform' && state.mode != 'wordsBlock' && state.mode != 'featureField') {
                state.mode = 'none';
            }

        }
        if (state.blanko && state.mode == 'clusterBlock')  {
            // No more clusterblock we reached blank line
            state.mode = 'transform';
            state.blanko = false;
        }
        if (state.blanko && state.mode == 'featureField')  {
            // No more clusterblock we reached blank line
            state.mode = 'none';
            state.blanko = false;
        }

        if (state.doIndent) {
            stream.match(/:/);
            state.doIndent = false;
            return "link";
        }

        if (state.mode == 'none') {
            if (stream.sol()){
                stream.match(/\s*/);
                
                // Graphemes
                if (stream.match(/(graphemes)(?=:)/)) {
                    state.mode = 'listLine';
                    state.doIndent = true;
                    return "meta";
                }
                // Transform
                if (stream.match(/BEGIN transform(?=:\s*(?:;|$))/)) {
                    state.mode = "transform";
                    state.doIndent = true;
                    return "meta";
                }

                if (stream.match(/\+- /)) {
                    state.mode = "featureField";
                    return "meta";
                }

                // Class
                const ClassRegex = new RegExp(`(${cappa})(?=\\s*=)`, "u");
                const match = stream.match(ClassRegex) as RegExpMatchArray;
                if (match) {
                    state.classList.push(match[1]);
                    state.mode = 'categoryLine';
                    return "tagName";
                }

                // Feature
                let Fmatch = stream.match(/[-+_][a-z]+(?=\s*=)/)
                if (Fmatch) {
                    state.featureList.push(Fmatch[0]);
                    state.mode = 'featureLine';
                    return "tagName";
                }
            }
        }

        if (state.mode == 'transform') {
            // Inside Feature matrix
            if (state.feature_matrix) {
                for (let featuro of state.featureList) {
                    if (stream.match(featuro)) {
                        return "tagName";
                    }
                }
                if (stream.match(/,/)) {
                    return "link";
                }
                if (stream.match(/}/)) {
                    state.feature_matrix = false;
                    return "regexp"
                }
                
            }

            // Feature matrix
            if (stream.match(/@{(?=\+|\-)/)) {
                state.feature_matrix = true;
                return "regexp";
            }

            // End Transform
            if (stream.match(/END(?=\s*;|\s*$)/)) {
                state.mode = 'none';
                return "meta";
            }
            // Clusterfield
            if (stream.match(/%\s/)) {
                state.mode = 'clusterBlock';
                return "meta";
            }
            // Engine
            if (stream.match(/\|(?= )/)) {
                state.mode = 'engine';
                return "meta";
            }

            for (let classo of state.classList) {
                if (stream.match(classo)) {
                    return "tagName";
                }
            }

            for (let rule of nescaTransformRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
        }

        if (state.mode == 'listLine') {
            for (let rule of nescaListRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
        }

        if (state.mode == 'categoryLine') {
            for (let classo of state.classList) {
                if (stream.match(classo)) {
                    return "tagName";
                }
            }

            for (let rule of nescaCategoryRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
        }

        if (state.mode == 'featureLine') {
            for (let featuro of state.featureList) {
                if (stream.match(featuro)) {
                    return "tagName";
                }
            }
            for (let rule of nescaFeatureRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
        }

        if (state.mode == 'featureField') {
            // End Transform
            if (stream.match(/END(?=\s*;|\s*$)/)) {
                state.mode = 'none';
                return "meta";
            }

            for (let featuro of state.featureList) {
                if (stream.match(featuro)) {
                    return "tagName";
                }
            }

            for (let rule of nescaFeatureFieldRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
        }

        if (state.mode == 'engine') {
            for (let rule of nescaEngineRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
            state.mode = 'transform';
        }

        if (state.mode == 'clusterBlock') {
            // End Transform
            if (stream.match(/END(?=\s*;|\s*$)/)) {
                state.mode = 'transform';
                return "meta";
            }

            for (let rule of nescaClusterRules) {
                if (stream.match(rule.regex)) {
                    return rule.token;
                }
            }
        }
        stream.next();
        return null;
    }
};

const nescaStream = StreamLanguage.define(nescaParser);

export { nescaStream };