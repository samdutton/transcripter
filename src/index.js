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
const mz = require('mz/fs');
const recursive = require('recursive-readdir');

const {JSDOM} = require('jsdom');

const ERROR_LOG = 'error-log.txt';
const VERSION = '1.0 beta';

let appendOutput = false;
let numErrors = 0;
let numFiles = 0;
let numFilesToProcess = 0;

let inputDirectory = 'input';
let outputDirectory = 'output';

const argv = require('yargs')
  .alias('a', 'append')
  .alias('h', 'help')
  .alias('i', 'input')
  .alias('o', 'output')
  .describe('a', 'Append output to existing files in output directory')
  .describe('i', `Input directory, default is ${inputDirectory}`)
  .describe('o', `Output file, default is ${outputDirectory}`)
  .help('h')
  .argv;

if (argv.a) {
  appendOutput = true;
}

if (argv.i) {
  inputDirectory = argv.i;
}

if (argv.o) {
  outputDirectory = argv.o;
}

if (argv.v) {
  console.log(`${VERSION}`);
  process.exit();
}

// Parse each SRT file in the input directory
recursive(inputDirectory).then((filepaths) => {
  filepaths = filepaths.filter((filename) => {
    // Filename is <YouTube ID>.srt
    if (!filename.match(/[a-zA-Z0-9_-]{11}.srt/)) {
      const message =
        `Input directory ${inputDirectory} contains stray file ${filename}`;
      displayError(message);
      logError(message);
    } else {
      return true;
    }
  });
  numFiles = numFilesToProcess = filepaths.length;
  console.time(`Time to process ${numFiles} transcripts`);
  for (const filepath of filepaths) {
    processSrtFile(filepath);
  }
}).catch((error) =>
  displayError(`Error reading from ${inputDirectory}:`, error));

function processSrtFile(filepath) {
  let srtFileText = fs.readFileSync(filepath, 'utf8').trim();
  srtFileText = tweakSrtFileText(srtFileText);
  console.log(srtFileText);
  if (--numFilesToProcess === 0) {
    console.timeEnd(`Time to process ${numFiles} transcripts`);
  }
}

// Get rid of minor glitches in captions.
function tweakSrtFileText(srtFileText) {
  return srtFileText.
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
    replace(/-- /gm, ' — ').
    replace(/--\n/gm, ' —\n').
    replace(/ - /gm, ' — ');
}

// Correct and capitalize speaker names (Fred Nerk not FRED NERK).
// This is much more of a problem for the older transcripts.
function tweakName(name) {
  name = capitalize(name);
  return name
    .replace('Francois', 'François')
    .replace('Hemperius', 'Hempenius');
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
  return string.toLowerCase()
    .replace(/\b[a-z](?=[a-z]+)/g, function(letter) {
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

