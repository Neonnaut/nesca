import MyWorker from './worker?worker';

import { get_example } from './examples.ts';

const cm6 = (window as any).cm6; // This was global. Stops TS from complaining

const w = new MyWorker();

function create_file_editor() {
    // Work out content and theme of file editor
    let content = ''; let theme = 'dark'; let filename = ''; let input_words = '';
    if (localStorage.hasOwnProperty('nesca')) {
        try {
            const gotLocalStorage = JSON.parse(localStorage.getItem('nesca') || '[]') as [string, string, string];
            content = gotLocalStorage[0]; 
            input_words = gotLocalStorage[1]; filename = gotLocalStorage[2];
        } catch {
            localStorage.removeItem("nesca");
            content = get_example('basic');
        }
    } else {
        content = get_example('basic');
    }
    if (localStorage.hasOwnProperty('colourScheme')) {
        if (localStorage.getItem('colourScheme') != 'dark-mode') {
            theme = 'light'
        }
    }

    if (filename) {
        setFilename(filename);
    }

    if (input_words) {
        (document.getElementById('nesca-word-input') as HTMLTextAreaElement).value = input_words;
    }

    // Create file editor
    return cm6.createEditorView(
        cm6.createEditorState(content, theme),
        document.getElementById("editor")
    );
}

$(window).on('load', function () {
    const editor = create_file_editor();

    editor.dispatch({
        selection: { anchor: editor.state.doc.length }
    })

    // Watch for dark / light change in system settings for system theme people
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (!localStorage.hasOwnProperty('colourScheme')) {
            let scheme = event.matches ? "dark" : "light";
            if (scheme == "dark") {
                cm6.changeEditorTheme(editor, "dark");
            } else if (scheme == "light") {
                cm6.changeEditorTheme(editor, "light");
            }
        }
    });

    // Generate button
    document.getElementById("apply-button")?.addEventListener("click", function () {
        const generateButton = this as HTMLButtonElement;
        const outputMessage = document.getElementById('voc-output-message') as HTMLDivElement;
        generateButton.disabled = true;

        try {
            w.postMessage({
                file: editor.state.doc.toString(),
                input_words: (document.getElementById('nesca-word-input') as HTMLTextAreaElement)?.value || "",
                mode: (document.querySelector('input[name="mode-type"]:checked') as HTMLInputElement)?.value || "",
                word_divider: (document.getElementById('word-divider') as HTMLInputElement)?.value || ""
            });
            w.onerror = function (e: ErrorEvent) {
                generateButton.disabled = false;
                outputMessage.innerHTML = `<p class='error-message'>${e.message}</p>`;
            };

        } catch (e) {
            generateButton.disabled = false;
            const error_message = e instanceof Error ? e.message : String(e);
            outputMessage.innerHTML = `<p class='error-message'>${error_message}</p>`;
        }
    });

    // After generating words 
    w.onmessage = (e: MessageEvent) => {
        const outputWordsField = document.getElementById('nesca-word-output') as HTMLInputElement;
        const outputMessage = document.getElementById('voc-output-message') as HTMLDivElement;
        const filenameInput = document.getElementById('file-name') as HTMLInputElement;
        const applyButton = document.getElementById("apply-button") as HTMLButtonElement;

        if (outputWordsField) {
            // Transfer words to the output
            outputWordsField.value = e.data.words;
            outputWordsField.focus();
        }

        const filename = filenameInput?.value || "";

        let output_message_html = '';

        if (e.data.warning_messages.length != 0) {
            for (const message of e.data.warning_messages) {
                output_message_html += `<p class='warning-message'>${message}</p>`;
                console.warn(message);
            }
        }
        if (e.data.error_messages.length != 0) {
            for (const message of e.data.error_messages) {
                output_message_html += `<p class='error-message'>${message}</p>`;
                console.error(message);
            }
        }
        if (e.data.info_messages.length != 0) {
            for (const message of e.data.info_messages) {
                output_message_html += `<p class='info-message'>${message}</p>`;
                console.info(message);
            }
        }
        if (e.data.diagnostic_messages.length != 0) {
            for (const message of e.data.info_messages) {
                output_message_html += `<p class='info-message'>${message}</p>`;
                console.debug(message);
            }
        }
        outputMessage.innerHTML = output_message_html;

        // Store file contents in local storage to be retrieved on page refresh
        localStorage.setItem('nesca', JSON.stringify([e.data.file, e.data.input_words, filename]));

        if (applyButton) {
            applyButton.disabled = false;
        }
    };

    // Copy results button
    document.getElementById("nesca-copy")?.addEventListener("click", () => {
        const outputWordsField = document.getElementById("nesca-word-output") as HTMLTextAreaElement;
        
        if (outputWordsField && outputWordsField.value !== "") {
            // Select text for deprecated way and aesthetics
            outputWordsField.select();
            outputWordsField.setSelectionRange(0, 99999); // For mobile devices
            outputWordsField.focus();

            if (!navigator.clipboard) {
                document.execCommand("copy"); // Deprecated way
            } else {
                navigator.clipboard.writeText(outputWordsField.value);
            }
        }
    });

    // Clear button
    const clearButton = document.getElementById("nesca-clear-editor") as HTMLButtonElement | null;
    clearButton?.addEventListener("click", () => {
        const confirmed = window.confirm("Clear ALL FIELDS?");
        if (confirmed) {
            editor.dispatch({
                changes: {
                    from: 0,
                    to: editor.state.doc.length,
                    insert: ''
                }
            });
            setFilename('');
            clearResults();
        }
    });

    // Wrap lines checkbox
    const wrapLinesCheckbox = document.getElementById("editor-wrap-lines") as HTMLInputElement | null;
    wrapLinesCheckbox?.addEventListener("click", () => {
        if (wrapLinesCheckbox.checked) {
            cm6.changeEditorLineWrap(editor, true);
        } else {
            cm6.changeEditorLineWrap(editor, false);
        }
    });

    // Load file button
    const loadButton = document.getElementById("load-file") as HTMLButtonElement | null;

    loadButton?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";

        input.onchange = () => {
            const fileInput = input.files?.[0];
            if (!fileInput) return;

            const reader = new FileReader();
            reader.readAsText(fileInput);

            reader.onloadend = () => {
                const fileText = reader.result;
                if (typeof fileText !== "string") return;

                const filename = fileInput.name.replace(/\.[^/.]+$/, "");
                setFilename(filename);

                editor.dispatch({
                    changes: {
                        from: 0,
                        to: editor.state.doc.length,
                        insert: fileText
                    }
                });

                localStorage.setItem("nesca", JSON.stringify([fileText, filename]));
            };
        };

        input.click();
    });

    // Save file button
    const saveButton = document.getElementById("save-file") as HTMLButtonElement | null;
    const fileNameInput = document.getElementById("file-name") as HTMLInputElement | null;
    saveButton?.addEventListener("click", () => {
        const fileContent = editor.state.doc.toString();
        const blob = new Blob([fileContent], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);

        const rawName = fileNameInput?.value || "";
        const downloadName = rawName === "" ? "nesca.txt" : `${rawName}.txt`;

        link.download = downloadName;
        link.click();
        URL.revokeObjectURL(link.href);

        // Save input text in user's local storage for the next session
        localStorage.setItem("nesca", JSON.stringify([fileContent, rawName]));
    });

    // Examples buttons
    document.querySelectorAll(".nesca-example").forEach((button) => {
        button.addEventListener("click", () => {
            const choice = (button as HTMLElement).getAttribute("value") || '?';
            const text = get_example(choice);
            const confirmed = window.confirm("Replace editor text with example?");
            
            if (confirmed) {
                editor.dispatch({
                    changes: {
                        from: 0,
                        to: editor.state.doc.length,
                        insert: text
                    }
                });
            }

            setFilename('');
            clearResults();
        });
    });    

    // Show keyboard toggle
    document.getElementById("show-keyboard")?.addEventListener("click", () => {
        const keyboardTable = document.getElementById("nesca-keyboard-table") as HTMLDivElement;
        const checkbox = document.getElementById('show-keyboard') as HTMLInputElement;
        
        if (keyboardTable && checkbox) {
            keyboardTable.style.display = checkbox.checked ? "block" : "none";
        }
    });

    // IPA buttons
    document.querySelectorAll(".ipa-button").forEach((button) => {
        button.addEventListener("mousedown", (e) => {
            e.preventDefault();
            editor.dispatch({
                changes: {
                    from: editor.state.selection.main.head,
                    insert: button.getAttribute("value")
                },
                selection: { anchor: editor.state.selection.main.head + 1 },
                scrollIntoView: true,
            })
        });
    });
});

function clearResults(): void {
    (document.getElementById('nesca-output-message') as HTMLInputElement).value = "";
    (document.getElementById('nesca-word-input') as HTMLInputElement).value = "";
    (document.getElementById('nesca-word-output') as HTMLInputElement).value = "";
}

function setFilename(filename: string): void {
    (document.getElementById('file-name') as HTMLInputElement).value = filename;
}

