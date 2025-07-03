
// This thing fetches the last item of an array
const get_last = <T = never>(arr: ArrayLike<T> | null | undefined) =>
  arr?.[arr.length - 1];

function capitalise(str: string): string {
    return str[0].toUpperCase() + str.slice(1);
}

const makePercentage = (input: string): number | null => {
  const num = Number(input);
  return Number.isInteger(num) && num >= 1 && num <= 100 ? num : null;
};

function validateCat(str: string): [boolean, boolean] {
    const regex = /^[A-Z\u00C1\u0106\u00C9\u01F4\u00CD\u1E30\u0139\u1E3E\u0143\u00D3\u1E54\u0154\u015A\u00DA\u1E82\u00DD\u0179\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9]$/u;
    const hasDollarSign = str.includes("$");

    return [regex.test(str), hasDollarSign];
}

function getCat(input: string): [string, string, boolean, boolean, boolean] {
    const divider = "=";
  
    if (input === "") {
        return ['', '', false, false, false]; // Handle invalid inputs
    }

    const divided = input.split(divider);
    if (divided.length !== 2) {
        return ['', '', false, false, false]; // Ensure division results in exactly two parts
    }

    const word = divided[0].trim();
    const field = divided[1].trim();
    if (word === "" || field === "") {
        return ['', '', false, false, false]; // Handle empty parts
    }

    const [isValid, hasDollarSign] = validateCat(word);

    return [word, field, true, isValid, hasDollarSign]; // Return word, field, valid, isCapital, hasDollarSign
}

function GetTransform(input: string): [string[], string[], boolean] {
    if (input === "") {
        return [[], [], false]; // Handle invalid inputs
    }

    const divided = input.split(/->|>|→/); 
    if (divided.length !== 2) {
        return [[], [], false]; // Ensure division results in exactly two parts
    }

    let target:any = divided[0].trim();
    let result:any = divided[1].trim();

    if (target === "" || result === "") {
        return [[], [], false]; // Handle empty parts
    }

    target = target.split(/[,\s]+/).filter(Boolean);
    result = result.split(/[,\s]+/).filter(Boolean);

    return [target, result, true]; // Return word, field, valid
}

export {
  get_last, capitalise, makePercentage,
  getCat, GetTransform,  };