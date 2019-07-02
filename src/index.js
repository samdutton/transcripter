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

const ERROR_LOG = 'error-log.txt';
const VERSION = '1.0 beta';

let appendOutput = false;
let numErrors = 0;
let okToStart = true;

let inputDirectory = './input';

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

//  Utility functions

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

