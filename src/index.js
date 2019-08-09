/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const FlexSearch = require('flexsearch');
const fs = require('fs');
const fsPromises = require('fs').promises;
const recursive = require('recursive-readdir');
// const rimraf = require('rimraf');
const subtitle = require('subtitle');
const validator = require('html-validator');

// Errors for validator to ignore.
// <head> errors are mostly to allow validation when not writing complete page.
const VALIDATOR_IGNORE = [
  'Error: Bad value “https://www.youtube.com/embed/${videoId}?enablejsapi=1” ' +
    'for attribute “src” on element “iframe”: Illegal character in path ' +
    'segment: “{” is not allowed.',
  'Error: Bogus comment.',
  'Error: Element “head” is missing a required instance of child element “title”.',
  'Error: Start tag seen without seeing a doctype first. Expected “<!DOCTYPE html>”.',
  'Start tag seen without seeing a doctype first. Expected “<!DOCTYPE html>”.',
  'Error: Stray doctype.',
  'Warning: Section lacks heading. Consider using "h2"-"h6" elements to ' +
    'add identifying headings to all sections.'];

let CREATE_STANDALONE_HOMEPAGE = true; // index page linking to standalone transcripts
let CREATE_SEARCH_INDEX = false;
const ERROR_LOG = 'error-log.txt';
const VERSION = '1.0 beta';

// Get the boilerplate text fragments for the top and bottom
// of a standalone HTML page.
const HTML_TOP = fs.readFileSync('./html-fragments/top.html', 'utf8');
const HTML_BOTTOM = fs.readFileSync('./html-fragments/bottom.html', 'utf8');

// Used to put each speaker in a span.speaker.
// This is done after the caption text is put in a span,
// hence the > before the match
const SPEAKER_REGEX = /^([A-Z1-9 \-]+): */;

let currentSpeaker;
let docNum = 0;
let numCaptions = 0;
let numErrors = 0;
let numSrtFiles = 0;
let numSrtFilesProcessed = 0;
let numTranscriptsWritten = 0;
let searchIndex;
const speakers = new Set();
const videoIds = [];

const DO_VALIDATION = true;

let INPUT_DIR = 'input';
// Use ../docs for integration with GitHub Pages.
let OUTPUT_DIR = '../docs';
const SEARCH_DIR = `${OUTPUT_DIR}/search`;
const SEARCH_TRANSCRIPTS_DIR = `${OUTPUT_DIR}/search/transcripts`;
const STANDALONE_DIR = `${OUTPUT_DIR}/standalone`;
const STANDALONE_TRANSCRIPTS_DIR = `${OUTPUT_DIR}/standalone/transcripts`;
const SEARCH_INDEX_FILEPATH = `${SEARCH_DIR}/data/index.json`;
const SPEAKERS_DATA_FILEPATH = `${SEARCH_DIR}/data/speakers.json`;

const argv = require('yargs')
  .alias('a', 'append')
  .alias('c', 'index')
  .alias('h', 'help')
  .alias('i', 'input')
  .alias('o', 'output')
  .describe('a', 'Append/overwrite: don\'t delete existing files in output directory')
  .describe('c', `Create index page linking to HTML output, ` +
    `default is ${CREATE_STANDALONE_HOMEPAGE}`) // index page for standalone transcripts
  .describe('i', `Input directory, default is ${INPUT_DIR}`)
  .describe('o', `Output directory, default is ${OUTPUT_DIR}`)
  .describe('s', `Create search index file`)
  .help('h')
  .argv;

// To avoid running other code when getting the app version, this must go first.
if (argv.v) {
  console.log(`${VERSION}`);
  process.exit();
}

// // Unless appending output, remove all HTML files from the output directory.
// if (!argv.a) {
//   // rimraf(`${OUTPUT_DIR}/*.html`, (error) => {
//   //   if (error) {
//   //     displayError('Error removing HTML files from ${OUTPUT_DIR}:', error);
//   //     return;
//   //   }
//   // });
//   // console.log(`Deleted old files from ${OUTPUT_DIR}/*.html`);
// }

if (argv.c) {
  CREATE_STANDALONE_HOMEPAGE = argv.c; // index page for standalone transcripts
}

if (argv.i) {
  INPUT_DIR = argv.i;
}

if (argv.o) {
  OUTPUT_DIR = argv.o;
}

if (argv.s) {
  CREATE_SEARCH_INDEX = true;
  searchIndex = new FlexSearch({
    doc: {
      // See creation of docs (one for each caption) for explanation of fields
      id: 'id',
      field: ['t'],
    },
  });
  console.log('Creating search index');
}

// Parse each SRT caption file in the input directory.
recursive(INPUT_DIR).then((filepaths) => {
  filepaths = filepaths.filter((filename) => {
    // Filename is <YouTubeID>.srt
    if (!filename.match(/[a-zA-Z0-9_-]{11}.srt/)) {
      const message =
        `Input directory ${INPUT_DIR} contains stray file ${filename}`;
      displayError(message);
      logError(message);
    } else {
      return true;
    }
  });
  // These variables are used to check when all SRT files have been processed.
  numSrtFiles = filepaths.length;
  console.time(`from ${numSrtFiles} transcripts`);
  console.log('\n');
  console.time(`\nTime to create search index and write and validate HTML ` +
    `for ${numSrtFiles} transcripts`);
  for (const filepath of filepaths) {
    processSrtFile(filepath);
  }
}).catch((error) => displayError(`Error reading from ${INPUT_DIR}:`, error));

// For each SRT caption file in ${INPUT_DIR}, i.e. each transcript:
// • Get the video ID.
// • Parse the text.
async function processSrtFile(filepath) {
  try {
    const data = await fsPromises.readFile(filepath, {encoding: 'utf8'});
    const videoId = filepath.match(/\/(.+).srt/)[1];
    videoIds.push(videoId);
    processSrtText(videoId, data.trim());
  } catch (error) {
    displayError(`Error reading file ${filepath}:`, error);
  }
}

// Parse each SRT file to get the captions.
// Once all the files have been processed, create a homepage for the
// standalone transcripts and write the serialised search index file.
function processSrtText(videoId, text) {
  // Parse the SRT file to create an array of captions using the
  // subtitle module: npmjs.com/package/subtitle#parsesrt-string---array.
  let captions = subtitle.parse(text);

  // Remove empty captions.
  captions = captions.filter((caption) => {
    return caption.text; // filter out captions without a text value
  });

  // Create HTML from captions and add a search index doc for each caption.
  processVideoData(videoId, captions);

  // When all SRT files have been parsed:
  // • Create an HTML homepage linking to standalone transcript files.
  // • Write the serialized search index to a file.
  if (++numSrtFilesProcessed === numSrtFiles) {
    console.log(`\nTime to process ${numCaptions} captions`);
    console.timeEnd(`from ${numSrtFiles} transcripts`);
    if (CREATE_STANDALONE_HOMEPAGE) { // page linking to standalone transcripts
      createStandaloneHomePage();
    }
    if (CREATE_SEARCH_INDEX) {
      writeFile(SEARCH_INDEX_FILEPATH, searchIndex.export());
      console.log(`Wrote searchIndex to \x1b[97m${SEARCH_INDEX_FILEPATH}\x1b[0m, ` +
          `length ${searchIndex.length}\n`);
    }
    writeFile(SPEAKERS_DATA_FILEPATH, JSON.stringify([...speakers].sort()));
    console.log(`\nWrote data for ${speakers.size} speakers to ` +
        `\x1b[97m${SPEAKERS_DATA_FILEPATH}\x1b[0m\n`);
  }
}

// Process the captions or each video:
// • Create an HTML version of the transcript.
// • Add a doc to the search index.
function processVideoData(videoId, captions) {
  // Start by opening section and p elements.
  let html = '<section>\n<p>';
  numCaptions += captions.length;
  console.log(`Processing ${captions.length} captions ` +
    `for \x1b[97m${STANDALONE_DIR}/transcripts/${videoId}.html\x1b[0m`);

  html += processCaptions(videoId, captions);

  // End whole transcript by adding closing tags for p and section elements.
  html += '</p>\n</section>';
  html = fixTextGlitches(html);

  // ${videoId} is used as a placeholder in top.html.
  const htmlStandalone =
      HTML_TOP.replace(/\${videoId}/g, videoId) +
      html +
      HTML_BOTTOM;
  const standaloneFilepath = `${STANDALONE_TRANSCRIPTS_DIR}/${videoId}.html`;
  const searchFilepath = `${SEARCH_TRANSCRIPTS_DIR}/${videoId}.html`;
  // If validation not requested, just write the file.
  validateThenWrite(standaloneFilepath, htmlStandalone);
  validateThenWrite(searchFilepath, html);
}

function processCaptions(videoId, captions) {
  let html = '';
  let numSpans = 0;
  // Randomly set the maximum number of spans allowed in a paragraph.
  let max = getRandom(3, 15);
  for (const caption of captions) {
    // Replace line breaks in the captions and remove any stray whitespace.
    // caption.plainText is used for search indexing.
    caption.plainText = caption.text = caption.text.replace(/\n/, ' ').trim();
    // Test for dodgy characters, just in case.
    if (/^[^a-zA-Z0-9 .\-?]+$/.test(caption.text)) {
      logError(`Found unexpected character in caption: |${caption.text}|`);
    }

    // Add a search index document for each caption, indexing caption.plainText
    addSearchIndexDoc(videoId, caption);

    // For readability, break up long speeches into paragraphs.
    // Attempt to break only at end of sentences.
    // Sentences almost always start at the beginning of captions.
    if (++numSpans > max && caption.text.match(/^[A-Z]/)) {
      html += '</p>\n<p>';
      numSpans = 0;
      max = getRandom(3, 15); // reset
    }

    // Check for a change of speaker and add markup to speaker names.
    caption.text = parseSpeakerNames(caption);

    // NB: This must come after parseSpeakerNames() is called.
    // Add space at end of every caption (these aren't in the SRT) to ensure
    // space between words, and after sentence endings.
    // Note that SRT timings are in milliseconds whereas YouTube uses seconds.
    caption.text = `<span data-start="${caption.start / 1000}" ` +
      `data-end="${caption.end / 1000}">${caption.text}</span> `;
    // Add a paragraph and section break before each new speaker.
    if (caption.text.includes('class="speaker"')) {
      html += '</p>\n</section>\n\n<section>\n<p>';
    }
    html += caption.text;
  } // end processing captions
  return html;
}

function addSearchIndexDoc(videoId, caption) {
  // NB: This must come after parseSpeakerNames() is called.
  if (CREATE_SEARCH_INDEX) {
    const doc = {
      // base 36 to minimise length/storage of the id value
      id: (docNum++).toString(36),
      sp: currentSpeaker, // reset in parseSpeakerNames() called above
      st: caption.start,
      t: caption.plainText,
      v: videoId,
    };
    searchIndex.add(doc, (error) => {
      if (error) {
        logError(`Error creating search index: ${error}`);
      }
    });
  }
}

// Create index page linking to transcripts.
function createStandaloneHomePage() {
  let html =
    `<html lang="en">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="images/icons/icon192.png">
    <style>
    body {
      font-family: Google Sans, sans-serif;
      margin: 40px;
    }
    </style>
    `;
  for (const videoId of videoIds) {
    html += `<p><a href="${videoId}.html">${videoId}</a><p>\n`;
  }
  const standaloneIndex = `${STANDALONE_DIR}/index.html`;
  writeFile(standaloneIndex, html);
  console.log(`\nCreated index page linking to standalone transcripts: ` +
      `\x1b[97m${standaloneIndex}\x1b[0m\n`);
}

// Whenever the current speaker changes:
// • Reset the currentSpeaker value.
// • Add HTML formatting.
function parseSpeakerNames(caption) {
  return caption.text.replace(SPEAKER_REGEX, (match, p1) => {
    currentSpeaker = formatName(p1);
    speakers.add(currentSpeaker);
    // The top and bottom HTML fragments open and close the tags added.
    return `<span class="speaker">${currentSpeaker}</span>: `;
  });
}

// Correct and capitalize speaker names (Fred Nerk not FRED NERK).
// This is much more of a problem for the older transcripts.
function formatName(name) {
  return capitalize(name)
    // TODO: Fixe these in the YouTube captions
    .replace('Francois', 'François')
    .replace('Hemperius', 'Hempenius')
    .replace('Speaker 1', 'Paul Lewis')
    .replace('Speaker 2', 'Timothy Jordan');
}

// Fix minor glitches in caption text.
// These are present in older transcripts (not the CDS ones).
function fixTextGlitches(html) {
  return html.
    replace(/>>> /gm, 'Audience member: ').
    replace(/&gt;&gt; ?/gm, '').
    replace(/&amp;gt;&amp;gt; ?/gm, '').
    replace(/&amp;gt; ?/gm, '').
    replace(/AUDIENCE/, 'Audience').
    replace(/AUDIENCE MEMBER/, 'Audience member').
    replace(/^>+/gm, '').
    replace(/&#39;/gm, '\'').
    replace(/&amp;#39;/gm, '\'').
    replace(/&quot;/gm, '\'').
    replace(/&amp;quot;/gm, '\'').
    replace(/--/gm, ' — ').
    replace(/ - /gm, ' — ');
}

//  Utility functions

// From stackoverflow.com/questions/17200640/javascript-capitalize-
// first-letter-of-each-word-in-a-string-only-if-lengh-2?rq=1
function capitalize(string) {
  return string.toLowerCase().replace(/\b[a-z](?=[a-z]+)/g,
    function(letter) {
      return letter.toUpperCase();
    });
}

function displayError(...args) {
  const color = '\x1b[31m'; // red
  const reset = '\x1b[0m'; // reset color
  console.error(color, '>>> Error:', reset, ...args);
}

// Thank you https://developer.mozilla.org.
function getRandom(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function logError(error) {
  numErrors++;
  displayError(`>>> ${error}`);
  fs.appendFileSync(ERROR_LOG, `${error}\n\n`);
}

// Write an HTML file, validating first if requested.
function validateThenWrite(filepath, html) {
  if (!DO_VALIDATION) {
    writeFile(filepath, html);
  }
  const options = {
    data: html,
    format: 'text',
    ignore: VALIDATOR_IGNORE,
    // validator: 'https://html5.validator.nu' // alternative
  };
  validator(options).then((data) => {
    if (data.includes('Error')) {
      displayError(`Validation error for ${filepath}`, data);
    } else {
      console.log(`Validated \x1b[97m${filepath}\x1b[0m`);
      writeFile(filepath, html);
      // TODO: take this out of this function...
      checkIfComplete();
    }
  }).catch((error) => {
    displayError(`Error validating ${filepath}`, error);
  });
}

function writeFile(filepath, data) {
  try {
    fsPromises.writeFile(filepath, data);
    console.log(`Created \x1b[97m${filepath}\x1b[0m`);
  } catch (error) {
    displayError(`Error writing ${filepath}:`, error);
  }
}

// Check if all transcripts have been written.
// TODO: make this less hacky...
function checkIfComplete() {
  // Count files written to both standalone and search transcript directories.
  if (++numTranscriptsWritten === numSrtFiles * 2) {
    console.timeEnd(`\nTime to create search index and write and validate HTML ` +
    `for ${numSrtFiles} transcripts`);
    console.log('\n');
  }
  if (numErrors) {
    displayError(`Completed with ${numErrors} errors.`);
  }
}

// Check if all transcript HTML files have been written.
// async function checkIfComplete() {
// try {
//   let filenames = await fsPromises.readdir(SEARCH_TRANSCRIPTS_DIR);
//   console.log('>>>', filenames.length);
//   filenames = filenames.filter((filename) => {
//     filename.match(/.+\.html$/);
//   });
// } catch (error) {
//   displayError('Error checking ${SEARCH_TRANSCRIPTS_DIR}', error);
// }
// }

