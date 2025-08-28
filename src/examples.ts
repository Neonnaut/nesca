function get_example(example:string):string {
    var choice = '';

    if (example == "basic") {
      choice = `BEGIN categories
C = p t k m n
V = a i e o u
END

a, e -> o, i

% x  y
i ix ^
j -  +

graphemes: x, a, b`;
}

    if (choice == '' || choice == null || choice == undefined) {
        return '?';
    } else {
        return choice;
    }

}

export { get_example };