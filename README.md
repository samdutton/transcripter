# Create readable transcripts from Google developer YouTube captions

This is a Node application that processes caption files from Google, Android and Chrome Developer channels to create readable transcripts.

It could easily be adapted to work with caption files from other playlists.

---

## Installation and usage

1. Clone or download the code.
2. Add `.srt` caption files to the [_input_](src/input) directory.
3. From a terminal `cd` to the `src` directory and run `node index.js`,
optionally setting flags (see below).
4. Progress updates and errors will be logged to the console.
5. When conversion is complete, view the results in the [_output_](src/output)
directory.

### Input and output

* When you clone the repo, the [_input_](src/input) and [_output_](src/output)
directories contain sample files.
* You can customize _input_ and _output_ directories — see flags below.

## Error handling

Check for errors in _error-log.txt_.

## Command line options

```
-a, --append  Append output to existing files in output directory
-c, --index   Create index page linking to HTML output
-h, --help    Show help
-i, --input   Input directory, default is [_input_](src/input)
-o, --output  Output directory, default is [_output_](src/output)
```

## Feedback, feature requests and bug reports

- Please [file an issue](https://github.com/samdutton/multihouse/issues/new)
including input files where relevant.
- See [`TODO`](TODO) for work in progress.

## Known issues

### Google Translate widget

This is [no longer supported](https://translate.google.com/intl/en/about/website).
The language selection popup is not laid out responsively.

Probably best to remove.

---

Please note that this is not an official Google product.

