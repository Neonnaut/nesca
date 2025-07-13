function get_example(example:string):string {
    var choice = '';

    if (example == "basic") {
      choice = `Default`;

    } else if (example == "choice 2") {
      choice = `; `;
    }

    if (choice == '' || choice == null || choice == undefined) {
        return '?';
    } else {
        return choice;
    }

}

export { get_example };