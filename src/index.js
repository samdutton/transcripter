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
const recursive = require('recursive-readdir');
// const rimraf = require('rimraf');
const subtitle = require('subtitle');
const validator = require('html-validator');

// Errors for validator to ignore.
// <head> errors are mostly to allow validation with FRAGMENT_ONLY
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

let CREATE_TRANSCRIPT_PAGE = true;
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
let numErrors = 0;
let numFiles = 0;
let numFilesToProcess = 0;
let numFilesToWrite = 0;
let searchIndex;
const speakers = new Set();
const videoIds = [];

const DO_VALIDATION = true;
let FRAGMENT_ONLY = false;

let INPUT_DIR = 'input';
// Use ../docs for integration with GitHub Pages.
let OUTPUT_DIR = '../docs';
const SEARCH_DIR = `${OUTPUT_DIR}/search`;
const TRANSCRIPT_DIR = `${OUTPUT_DIR}/transcripts`;
const SEARCH_INDEX_FILEPATH = `${SEARCH_DIR}/data/index.json`;
const SPEAKERS_DATA_FILEPATH = `${SEARCH_DIR}/data/speakers.json`;

const argv = require('yargs')
  .alias('a', 'append')
  .alias('c', 'index')
  .alias('f', 'fragment')
  .alias('h', 'help')
  .alias('i', 'input')
  .alias('o', 'output')
  .describe('a', 'Append output to existing files in output directory')
  .describe('c', `Create index page linking to HTML output, ` +
    `default is ${CREATE_TRANSCRIPT_PAGE}`)
  .describe('f', 'Create HTML fragment only, without adding top.html and ' +
    'bottom.html')
  .describe('i', `Input directory, default is ${INPUT_DIR}`)
  .describe('o', `Output directory, default is ${OUTPUT_DIR}`)
  .describe('s', `Create search index file`)
  .help('h')
  .argv;

// This needs to come first to avoid running any other code.
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
  CREATE_TRANSCRIPT_PAGE = argv.c;
}

if (argv.f) {
  FRAGMENT_ONLY = argv.f;
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

// Parse each SRT file in the input directory
recursive(INPUT_DIR).then((filepaths) => {
  filepaths = filepaths.filter((filename) => {
    // Filename is <YouTube ID>.srt
    if (!filename.match(/[a-zA-Z0-9_-]{11}.srt/)) {
      const message =
        `Input directory ${INPUT_DIR} contains stray file ${filename}`;
      displayError(message);
      logError(message);
    } else {
      return true;
    }
  });
  numFiles = numFilesToProcess = numFilesToWrite =
    filepaths.length;
  console.time(`\nTime to process ${numFiles} transcripts`);
  for (const filepath of filepaths) {
    processSrtFile(filepath);
  }
}).catch((error) =>
  displayError(`Error reading from ${INPUT_DIR}:`, error));

// For each SRT file in ${INPUT_DIR}, i.e. each transcript:
// • get the video ID
// • fix minor textual glitches
// • create an array of captions using subtitle.parse()
//
function processSrtFile(filepath) {
  // Synchronously is fast enough...
  const srtFileText = fs.readFileSync(filepath, 'utf8').trim();
  // console.log(filepath);
  const videoId = filepath.match(/\/(.+).srt/)[1];
  videoIds.push(videoId);
  // console.log(srtFileText);
  // Parse the SRT file to create an array of captions using the
  // subtitle module: npmjs.com/package/subtitle#parsesrt-string---array.
  let captions = subtitle.parse(srtFileText);
  // console.log(captions);
  // Remove empty captions.
  captions = captions.filter((caption) => {
    return caption.text;
  });
  processCaptions(videoId, captions);
  if (--numFilesToProcess === 0) {
    console.timeEnd(`\nTime to process ${numFiles} transcripts`);
    // console.log(`\nStarted writing and validating ${numFiles} HTML files...`);
    console.time(`\nTime to create search index and write and validate ` +
        `${numFiles} transcript files to ` +
        `\x1b[97m${TRANSCRIPT_DIR}\x1b[0m directory`);
    if (CREATE_TRANSCRIPT_PAGE) {
      createTranscriptIndex();
    }
    if (CREATE_SEARCH_INDEX) {
      // const results = searchIndex.search('search');
      // console.log('>>> Search results:', results);
      // const serialized = searchIndex.export();
      // const otherIndex = new FlexSearch({
      //   doc: {
      //     id: 'id',
      //     field: ['t'],
      //   },
      // });
      // otherIndex.import(serialized);
      // const results = searchIndex.search('search');
      // console.log('>>> Search results:', results);
      writeFile(SEARCH_INDEX_FILEPATH, searchIndex.export());
      console.log(`Wrote searchIndex to ${SEARCH_INDEX_FILEPATH}, ` +
          `length ${searchIndex.length}\n`);
    }
    writeFile(SPEAKERS_DATA_FILEPATH, JSON.stringify([...speakers].sort()));
    console.log(`Wrote data for ${speakers.size} speakers to ` +
        `${SPEAKERS_DATA_FILEPATH}\n`);
  }
}

// Create index page linking to transcripts.
function createTranscriptIndex() {
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
  const transcriptIndex = `${TRANSCRIPT_DIR}/index.html`;
  writeFile(transcriptIndex, html);
  console.log(`\nCreated index page linking to transcripts: ` +
      `\x1b[97m${transcriptIndex}\x1b[0m\n`);
}

function processCaptions(videoId, captions) {
  currentSpeaker = undefined;
  let html ='';
  if (!FRAGMENT_ONLY) {
    // ${videoId} is used as a placeholder in top.html.
    html += HTML_TOP.replace(/\${videoId}/g, videoId);
  }
  // Start by opening section and p elements.
  html += '<section>\n<p>';
  console.log(`Processing ${captions.length} captions ` +
    `for \x1b[97m${TRANSCRIPT_DIR}/${videoId}.html\x1b[0m`);
  let numSpans = 0;
  // Randomly set the maximum number of spans allowed in a paragraph.
  let max = getRandom(3, 15);
  for (const caption of captions) {
    // For readability, break up long speeches into paragraphs.
    // Attempt to break only at end of sentences.
    // Sentences almost always start at the beginning of captions.
    if (++numSpans > max && caption.text.match(/^[A-Z]/)) {
      html += '</p>\n<p>';
      numSpans = 0;
      max = getRandom(3, 15);
    }
    caption.text = parseSpeakerNames(caption);
    caption.text = formatCaptionText(caption);
    // Add a paragraph and section break before each new speaker.
    if (caption.text.includes('class="speaker"')) {
      html += '</p>\n</section>\n\n<section>\n<p>';
    }
    html += caption.text;
    if (CREATE_SEARCH_INDEX) {
      const doc = {
        // base 36 to minimise length/storage of the id value
        id: (docNum++).toString(36),
        sp: currentSpeaker,
        st: caption.start,
        // Get rid of HTML added — can't get text before parsing speaker :(.
        t: caption.text.replace(/^.+[>|:]([^\<]+)<.+$/, '$1').trim(),
        v: videoId,
      };
      // Test for stray characters
      // if (/^[^a-zA-Z0-9 .\-?]+$/.test(doc.t)) {
      //   console.log(`>>>>>  |${doc.t}|`);
      // }
      // console.log('>>> doc', doc);
      searchIndex.add(doc, (error) => {
        if (error) {
          logError(`Error creating search index: ${error}`);
        }
      });
      // searchIndex.add(docNum,
      //   caption.text.replace(/^.+[>|:]([^\<]+)<.+$/, '$1').trim());
    }
  }
  // End by closing p and section elements.
  html += '</p>\n</section>';
  if (!FRAGMENT_ONLY) {
    html += HTML_BOTTOM;
  }
  html = fixTextGlitches(html);
  validateThenWrite(videoId, html);
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
    .replace('Francois', 'François')
    .replace('Hemperius', 'Hempenius');
}

// Fix minor glitches in caption text.
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

// Format caption as HTML:
// • Remove line breaks in caption text.
// • Put whole caption in a span with data-start attribute.
function formatCaptionText(caption) {
  caption.text = caption.text.replace(/\n/, ' ');
  // NB: add space at end of every caption (these aren't in the SRT).
  // SRT timings are in milliseconds; YouTube uses seconds.
  caption.text = `<span data-start="${caption.start / 1000}" ` +
      `data-end="${caption.end / 1000}">${caption.text}</span> `;
  return caption.text;
}

// Write a transcript file, validating HTML first if requested.
function validateThenWrite(videoId, html) {
  const filepath = `${TRANSCRIPT_DIR}/${videoId}.html`;
  // If validation not requested, just write the file.
  if (!DO_VALIDATION) {
    writeOutput(filepath, html);
    return;
  }
  const options = {
    data: html,
    format: 'text',
    ignore: VALIDATOR_IGNORE,
    // Alternative validator.
    // validator: 'https://html5.validator.nu'
  };
  validator(options).then((data) => {
    if (data.includes('Error')) {
      displayError(`Validation error for ${filepath}`, data);
    } else {
      console.log(`Validated \x1b[97m${filepath}\x1b[0m`);
      writeOutput(filepath, html);
    }
  }).catch((error) => {
    displayError(`Error validating ${filepath}.html:`, error);
  });
}

function writeOutput(filepath, html) {
  writeFile(filepath, html);
  if (--numFilesToWrite === 0) {
    setTimeout(()=> {
      console.timeEnd(`\nTime to create search index and write and validate ` +
          `${numFiles} transcript files to ` +
          `\x1b[97m${TRANSCRIPT_DIR}\x1b[0m directory`);
      if (numErrors) {
        console.log(`${numErrors} errors: see \x1b[97m${ERROR_LOG}\x1b[0m`);
      }
      console.log('\n');
    }, 500);
  }
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

function writeFile(filepath, data) {
  fs.writeFile(filepath, data, (error) => {
    if (error) {
      displayError(`Error writing ${filepath}:`, error);
    } else {
      console.log(`Created \x1b[97m${filepath}\x1b[0m`);
    }
  });
}

