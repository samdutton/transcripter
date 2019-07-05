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

const fs = require('fs');
const recursive = require('recursive-readdir');
const subtitle = require('subtitle');
const validator = require('html-validator');
const VALIDATOR_IGNORE = [
  'Error: Bogus comment.',
  'Warning: Section lacks heading. Consider using "h2"-"h6" elements to ' +
    'add identifying headings to all sections.'];

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

// let appendOutput = false;
let numErrors = 0;
let numFiles = 0;
let numFilesToProcess = 0;
let numFilesToWrite = 0;
// const speakers = new Set();

const DO_VALIDATION = true;
// const IS_STANDALONE = false;
let INPUT_DIR = 'input';
let OUTPUT_DIR = 'output';


const argv = require('yargs')
  .alias('a', 'append')
  .alias('h', 'help')
  .alias('i', 'input')
  .alias('o', 'output')
  .describe('a', 'Append output to existing files in output directory')
  .describe('i', `Input directory, default is ${INPUT_DIR}`)
  .describe('o', `Output file, default is ${OUTPUT_DIR}`)
  .help('h')
  .argv;

if (argv.a) {
  appendOutput = true;
}

if (argv.i) {
  INPUT_DIR = argv.i;
}

if (argv.o) {
  OUTPUT_DIR = argv.o;
}

if (argv.v) {
  console.log(`${VERSION}`);
  process.exit();
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
  console.time(`Time to process ${numFiles} transcripts`);
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
  let srtFileText = fs.readFileSync(filepath, 'utf8').trim();
  // console.log(filepath);
  const videoId = filepath.match(/\/(.+).srt/)[1];
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
    console.timeEnd(`Time to process ${numFiles} transcripts`);
    console.log(`Started writing and validating ${numFiles} HTML files...`);
    console.time(`Time to write and validate ${numFiles} HTML files ` +
        `to \x1b[97m${OUTPUT_DIR}\x1b[0m directory`);
  }
}

function processCaptions(videoId, captions) {
  let html = HTML_TOP.replace('${title}', videoId);
  console.log(`Processing ${captions.length} captions ` +
    `for \x1b[97m${OUTPUT_DIR}/${videoId}.html\x1b[0m`);
  for (const caption of captions) {
    // Put caption text in an HTML span.
    caption.text = formatCaptionText(caption);
    // A bit hacky... New section for each change of speaker.
    // The top and bottom HTML fragments start and finish this.
    if (caption.text.includes('class="speaker"')) {
      caption.text = '</section>\n\n<section>' + caption.text;
    }
    html += caption.text;
  }
  html += HTML_BOTTOM;
  html = tweakCaptionText(html);
  validateThenWrite(videoId, html);
}

// Fix minor glitches in caption text.
function tweakCaptionText(html) {
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
// • remove line breaks in caption text
// • put speaker names in a span.speaker
// • put whole caption in a span with data-start attribute
function formatCaptionText(caption) {
  caption.text = caption.text
    .replace(/\n/, ' ')
    // Put each speaker name in a span.speaker.
    .replace(SPEAKER_REGEX, (match, p1) => {
      return `<span class="speaker">${formatName(p1)}</span>: `;
    });
  // NB space at end of every caption (these aren't in SRT).
  caption.text =
    `<span data-start="${caption.start}">${caption.text}</span> `;
  return caption.text;
}

// Correct and capitalize speaker names (Fred Nerk not FRED NERK).
// This is much more of a problem for the older transcripts.
function formatName(name) {
  return capitalize(name)
    .replace('Francois', 'François')
    .replace('Hemperius', 'Hempenius');
}

// Check that a file contains valid HTML
// unless validation is not wanted
function validateThenWrite(videoId, html) {
  const filepath = `${OUTPUT_DIR}/${videoId}.html`;
  if (!DO_VALIDATION) {
    writeFile(filepath, html);
    return;
  }
  const options = {
    data: html,
    format: 'text',
    ignore: VALIDATOR_IGNORE,
    // Alternative validator:
    // validator: 'https://html5.validator.nu'
  };
  validator(options).then((data) => {
    if (data.includes('Error')) {
      displayError(`Validation error for ${filepath}`, data);
    } else {
      console.log(`Validated ${filepath}`);
      writeFile(filepath, html);
    }
  }).catch((error) => {
    displayError(`Error validating ${videoId}.html:`, error);
  });
}

function writeFile(filepath, html) {
  fs.writeFile(filepath, html, (error) => {
    if (error) {
      displayError(`Error writing ${filepath}:`, error);
    } else {
      console.log(`Created ${filepath}`);
    }
  });
  if (--numFilesToWrite === 0) {
    console.timeEnd(`Time to write and validate ${numFiles} HTML files ` +
        `to \x1b[97m${OUTPUT_DIR}\x1b[0m directory`);
  }
}

function split(para, MAXLENGTH) {
  // Split after the end of each sentence.
  // Each sentence ends with a full stop and space followed by a
  // span closing tag.
  const sentences = para.replace(/\. <\/span>/g, '. </span>%^&*').split('%^&*');
  const paras = [];
  const tempPara = '';
  while (sentences.length > 0) {
    tempPara += sentences.shift() + ' ';
    if (tempPara.length > MAXLENGTH) {
      MAXLENGTH = 1000 + Math.floor(Math.random() * 2000); // reset
      paras.push(tempPara);
      tempPara = '';
    }
  }
  paras.push(tempPara); // the last one, not over-length
  return paras;
}

function addParagraphTags(item) {
  // Add speaker class to paragraphs that introduces a speaker.
  // if (item.indexOf('<span class=\"speaker\">') !== -1) {
  if (item.indexOf('<span class') !== -1) {
    return '<p class="speaker">' + item.trim() + '</p>';
  } else {
    return '<p>' + item.trim() + '</p>';
  }
}

function buildTranscript(transcript) {
  // For each new speaker, start a new paragraph.
  // Add @$* string to enable paragraphs to be split into an array below.
  // A bit of a hack, but works OK.
  transcript = transcript.replace(/><span([^\/]+)<span class="speaker">/gm,
    '>@£$<span$1<span class="speaker">');

  // Split into array of paragraphs.
  // If there are no speaker spans, the array will have one long paragraph.
  const paras = transcript.split('@£$');

  // Randomly split long paragraphs into shorter paragraphs
  // to make them more readable. Better than nothing...
  const okParas = [];
  for (const i = 0; i !== paras.length; ++i) {
    const para = paras[i];
    const MAXLENGTH = 1000 + Math.floor(Math.random() * 2000);
    if (para.length < MAXLENGTH) {
      okParas.push(para);
    } else {
      okParas = okParas.concat(split(para, MAXLENGTH));
    }
  }
  return okParas.map(addParagraphTags).join('');
}

function split(para, MAXLENGTH) {
  // Split after the end of each sentence.
  // Each sentence ends with a full stop and space followed by a
  // span closing tag.
  const sentences =
    para.replace(/\. <\/span>/g, '. </span>%^&*').split('%^&*');
  const paras = [];
  const tempPara = '';
  while (sentences.length > 0) {
    tempPara += sentences.shift() + ' ';
    if (tempPara.length > MAXLENGTH) {
      // Reset.
      MAXLENGTH = 1000 + Math.floor(Math.random() * 2000);
      paras.push(tempPara);
      tempPara = '';
    }
  }
  // The last one, not over-length.
  paras.push(tempPara);
  return paras;
}

function addParagraphTags(item) {
  // Add speaker class to paragraphs that introduces a speaker.
  // if (item.indexOf('<span class=\"speaker\">') !== -1) {
  if (item.indexOf('<span class') !== -1) {
    return '<p class="speaker">' + item.trim() + '</p>';
  } else {
    return '<p>' + item.trim() + '</p>';
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

function logError(error) {
  numErrors++;
  displayError(`>>> ${error}`);
  fs.appendFileSync(ERROR_LOG, `${error}\n\n`);
}

