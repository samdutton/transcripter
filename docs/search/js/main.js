/*
Copyright 2019 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/* globals gtag FlexSearch */

// const DATALISTS_FILE = 'data/datalists.json';
const TRANSCRIPT_DIR = 'transcripts';
const INDEX_FILE = 'data/index.json';

const CACHE_NAME = 'cache';
const DEBOUNCE_DELAY = 300;
const QUERY_INPUT_PLACEHOLDER = 'Search for a word or phrase';
// TODO: Replace with real URL
const SEARCH_QUERY_PAGE_LOCATION = `https://foo.com/search?q=`;
const SEARCH_QUERY_PAGE_PATH = `/search?q=`;

const searchIndex = new FlexSearch({
  doc: {
    id: 'id',
    field: ['t'],
  },
});

// const SEARCH_OPTIONS = {
//   fields: {
//     t: {}, // search t field, no special options
//   },
//   bool: 'AND',
//   expand: false, // true means matches are not whole-word-only
// };

// const creditElement = document.getElementById('credit');
const infoElement = document.getElementById('info');
const matchesList = document.getElementById('matches');
const queryInfoElement = document.getElementById('query-info');
const queryInput = document.getElementById('query');
const searchOptionsDetails = document.getElementById('search-options');

// const speakerInput = document.getElementById('speaker');
// const speakersDatalist = document.getElementById('speakers');
const transcriptDiv = document.getElementById('text');
// const titleInput = document.getElementById('title');
// const titlesDatalist = document.getElementById('titles');

let datalists;
let matches;
let startTime;
// let videoTitles;
let timeout = null;

// Log a Google Analytics event when search options is opened.
searchOptionsDetails.ontoggle = (event) => {
  if (event.target.open) {
    gtag('event', 'Search options opened', {
      'event_category': 'Search',
      // 'event_label': 'Search options',
    });
  }
};

// Handle navigation between search results and text display.
window.onpopstate = (event) => {
  if (event.state && event.state.type === 'results') {
    //
  } else {
    //
  }
};

// Respond to URL hash changes.
// A hash value is a search query, video ID, or video ID and time (s or mm:ss)
// For example: /#brazen, /#AB9qSUhlxh8, /#AB9qSUhlxh8?t=1:41
window.onhashchange = handleHashValue;

window.onload = () => {
  // registerServiceWorker();
  getSearchIndex();
};

// Get and load search index data
function getSearchIndex() {
  console.log('Fetching search index...');
  console.time('Fetch search index');
  fetch(INDEX_FILE).then((response) => {
    return response.text();
  }).then((text) => {
    console.timeEnd('Fetch search index');
    console.log('Loading search index...');
    console.time('Load search index');
    searchIndex.import(text);
    // const results = searchIndex.search('search');
    // console.log('>>> Search results:', results);
    console.log(`Search index length: ${searchIndex.length}`);
    console.timeEnd('Load search index');
    queryInput.disabled = false;
    // Get and parse data for video titles and speaker names from datalists.json.
    // Run here to ensure that (for performance) index data is retrieved first.
    window.setTimeout(fetchDatalists, 100);
  }).catch((error) => {
    displayInfo(`There was a problem downloading data.<br>` +
      `Check that you're online, or try refreshing the page.<br><br>`);
    console.error(`Error fetching ${INDEX_FILE}: ${error}`);
  });
}

// Fetch and parse data for speaker names and text titles and abbreviations.
function fetchDatalists() {
  // fetch(DATALISTS_FILE).then((response) => {
  //   return response.json();
  // }).then((json) => {
  //   datalists = json;
  //   for (const speaker of datalists.speakers) {
  //     const option = document.createElement('option');
  //     option.value = speaker.n;
  //     speakersDatalist.appendChild(option);
  //   }
  //   videoTitles = datalists.videoTitles;
  //   const titles = datalists.titles;
  //   for (const title of titles) {
  //     const option = document.createElement('option');
  //     option.value = title;
  //     titlesDatalist.appendChild(option);
  //   }
  //   // NB: handleHashValue() called in checkHashValue()
  //   // depends on data in DATALISTS_FILE
  window.setTimeout(checkHashValue, 100);
  // }).catch((error) => {
  //   displayInfo('There was a problem downloading data.<br><br>' +
  //     'Please check that you\'re online or try refreshing the page.');
  //   console.error(`Error fetching ${DATALISTS_FILE}: ${error}`);
  // });
}

// If the location has a hash value, either do a search or load a text,
// depending on the value. For example: shearch.me#brazen,
// shearch.me#Hamlet, shearch.me#ham or shearch.me#ham.3.1.56
// NB: this function uses data fetched in fetchDatalists()
function checkHashValue() {
  if (location.hash) {
    handleHashValue();
  } else {
    queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
  }
  queryInput.focus();
}

// A hash value implies a search query, video ID, or video ID and time (s or mm:ss)
// For example: /#brazen, /#AB9qSUhlxh8, /#AB9qSUhlxh8?t=1:41
function handleHashValue() {
  // Decode if necessary and replace non-alpha characters with a space
  const hashValue = decodeURI(location.hash.slice(1)).replace(/[^\w.]+/g, ' ');
  // if hash value is a video ID, e.g. /#AB9qSUhlxh8
  // ...
  // else if hash value is a video ID and time, e.g. /#AB9qSUhlxh8?t=1:41
  // ...
  // Otherwise treat the hash value as a query, e.g. /#brazen
  queryInput.value = hashValue;
  doSearch(hashValue);
}

// Search whenever query input changes, with debounce delay
queryInput.oninput = handleQueryInput;

// Do a search if user presses enter/return key
queryInput.onkeydown = () => {
  if (event.key === 'Enter' || event.key === 'Tab') {
    handleQueryInput();
  }
};

// Search whenever query input changes, with debounce delay
function handleQueryInput() {
  const value = queryInput.value;
  if (value.length > 2) {
    // debounce text entry
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      doSearch(value);
    }, DEBOUNCE_DELAY);
  }
}

// Filter matches, if displayed.
// titleInput.oninput = speakerInput.oninput = genderInput.oninput = () => {
//   if (matches && matches.length > 0) {
//     displayMatches();
//   }
// };

// const typeCheckboxes = document.querySelectorAll('div#type input');
// for (const typeCheckbox of typeCheckboxes) {
//   typeCheckbox.onchange = () => {
//     speakerInput.disabled = genderInput.disabled =
//       !typePlayCheckbox.checked;
//     if (matches && matches.length > 0) {
//       displayMatches();
//     }
//   };
// }

function doSearch(query) {
  // Add Google Analytics tracking for searches.
  gtag('config', 'UA-103792298-2', {
    'page_title': 'search',
    'page_location': `${SEARCH_QUERY_PAGE_LOCATION}${query}`,
    'page_path': `${SEARCH_QUERY_PAGE_PATH}${query}`,
  });
  matchesList.textContent = '';
  startTime = window.performance.now();
  console.time(`Do search for '${query}'`);
  matches = searchIndex.search(query); // FlexSearch.js index
  console.timeEnd(`Do search for '${query}'`);

  const elapsed = Math.round(window.performance.now() - startTime) / 1000;
  hide(transcriptDiv); // hide the div for displaying transcript
  show(matchesList); // show search results (matches)

  // sort by video title: doc.t is title
  // matches = matches.sort((a, b) => {
  //   return a.doc.t.localeCompare(b.doc.t);
  // });

  // prefer exact matches
  // matches = matches.sort((a, b) => {
  //   if (a.doc.t.includes(query) && b.doc.t.includes(query)) {
  //     return 0;
  //   } else if (a.doc.t.includes(query)) {
  //     return -1;
  //   } else if (b.doc.t.includes(query)) {
  //     return 1;
  //   } else {
  //     return 0;
  //   }
  // });

  // Scroll back to top.
  // For example, if user taps/double-clicks to search for a word in a result.
  window.scroll(0, 0);

  const message = `Found ${matches.length} match(es) in ${elapsed} seconds`;

  displayInfo(message);
  queryInfoElement.textContent = 'Click on a match to view text';
  displayMatches(query);
}

// Display a list of matched lines, stage directions,
// scene locations and scene descriptions
function displayMatches() {
  hide(infoElement);
  hide(matchesList);
  matchesList.textContent = '';
  hide(queryInfoElement);
  hide(transcriptDiv);
  const filteredMatches = getFilteredMatches();
  if (filteredMatches.length > 0) {
    const query = queryInput.value;
    history.pushState({type: 'results', query}, null,
      `${window.location.origin}#${query}`);
    document.title = `CDS: ${query}`;
    show(infoElement);
    show(matchesList);
    show(queryInfoElement);
    // const exactPhrase = new RegExp(`\b${query}\b`, 'i');
    // keep exact matches only
    // matches = matches.filter(function(match) {
    //   return exactPhrase.test(match.doc.t);
    // });
    //
    for (const match of filteredMatches) {
      addMatch(match);
    }
  } else {
    displayInfo('No matches :^\\');
    queryInfoElement.textContent = '';
  }
}

function getFilteredMatches() {
  const filteredMatches = matches;

  // if a speaker is specified, filter out non-matches
  // if (speakerInput.value) {
  //   filteredMatches = matches.filter((match) => {
  //     return match.doc.s &&
  //       match.doc.s.toLowerCase().includes(speakerInput.value.toLowerCase());
  //   });
  // }

  // if a title is specified, filter out non-matches
  // if (titleInput.value) {
  //   filteredMatches = filteredMatches.filter((match) => {
  //     // check if full play name includes text entered in titleInput
  //     const playAbbreviation = match.doc.l.split('.')[0];
  //     return videoTitles[playAbbreviation].title.toLowerCase().
  //       includes(titleInput.value.toLowerCase());
  //   });
  // }

  const message = `Found ${filteredMatches.length} match(es)`;
  displayInfo(message);
  return filteredMatches;
}

// Add an individual match element to the list of matches
function addMatch(match) {
  // console.log('>>> match', match);
  const matchElement = document.createElement('li');
  matchElement.dataset.speaker = match.sp;
  matchElement.dataset.start = match.st;
  matchElement.dataset.video = match.v;
  matchElement.innerHTML = match.t;
  matchElement.onclick = () => {
    displayText(match);
  };
  matchesList.appendChild(matchElement);
}

// Display the appropriate text and location when a user taps/clicks on a match
function displayText(match) {
  // hide(creditElement);
  hide(infoElement);
  hide(matchesList);
  hide(queryInfoElement);
  // match.l is a citation within a play or poem,
  // e.g. Ham.3.3.2, Son.4.11, Ven.140
  // scene title matches only have act and scene number, e.g. Ham.3.3
  history.pushState({type: 'text'}, null,
    `${window.location.origin}#${match.v}`);
  document.title =
    `CDS: ${match.v}`;
  console.log('>>> transcript file:', `${TRANSCRIPT_DIR}/${match.v}.html`);
  fetch(`${TRANSCRIPT_DIR}/${match.v}.html`).then((response) => {
    return response.text();
  }).then((html) => {
    transcriptDiv.innerHTML = html;
    // transcriptDiv.onmouseover = addWordSearch;
    show(transcriptDiv);
    // show(creditElement);
    highlightMatch(match.v, match.st);
  }).catch((error) => {
    console.error(`Error or timeout fetching ${match.v}: ${error}`);
    displayInfo(`There was a problem downloading ` +
      `<em>${match.v}.</em><br><br>` +
      'Check that you\'re online, or try refreshing the page.<br><br>' +
      'You can download videoTitles when you\'re online by selecting the ' +
      '<strong>Download all</strong> checkboxes from ' +
      '<strong>Search options</strong>.');
  });
}

// Highlight a caption within a video, given a time.
// For example: /#AB9qSUhlxh8?t=1:41
// function highlightTime(time) {
// find line
// add highlight
// scroll into view
// }

function highlightMatch(video, time) {
// highlightTime
// show(transcriptDiv);
}

// Highlight a caption
// function highlightCaption(parent, selector, elementIndex) {
//   const element = parent.querySelectorAll(selector)[elementIndex];
//   element.classList.add('highlight');
//   element.scrollIntoView({block: 'center'});
// }


// Service Worker functions (using Workbox)

// function registerServiceWorker() {
//   if ('serviceWorker' in navigator) {
//   // Use the window load event to keep the page load performant.
//     navigator.serviceWorker.register('./sw.js');
//   } else {
//     displayInfo('This browser cant\'t store downloaded files.<br><br>' +
//       'The app will work, but only when you\'re online.');
//     console.error('Service worker not supported');
//   }
// }

async function addToCache(urls) {
  const cache = await window.caches.open(CACHE_NAME);
  await cache.addAll(urls);
  displayInfo(`Downloaded ${urls.length} file(s).`);
}

async function deleteFromCache(urls) {
  const cache = await window.caches.open(CACHE_NAME);
  for (const url of urls) {
    await cache.delete(url);
  }
  displayInfo(`Deleted ${urls.length} file(s).`);
}

const downloadCheckboxes = document.querySelectorAll('div#download input');
for (const downloadCheckbox of downloadCheckboxes) {
  downloadCheckbox.onchange = () => {
    updateCache(downloadCheckbox.value, downloadCheckbox.checked);
  };
}

// Add or remove videoTitles from the cache.
// type is play, poem or sonnet
function updateCache(type, isRequestToCache) {
  if (isRequestToCache) {
    // datalists[type] is an array of play, poem or sonnet file paths
    addToCache(datalists[type]);
  } else {
    deleteFromCache(datalists[type]);
  }
}

// Utility functions

// From https://gist.github.com/davej/728b20518632d97eef1e5a13bf0d05c7
// function fetchWithTimeout(url, options, timeout = 5000) {
//   return Promise.race([fetch(url, options),
//     new Promise((_, reject) =>
//       setTimeout(() => reject(new Error('Timeout')), timeout))]);
// }

// Display information to the user.
function displayInfo(html) {
  infoElement.innerHTML = html;
  show(infoElement);
}

function hide(element) {
  element.classList.add('hidden');
}

function show(element) {
  element.classList.remove('hidden');
}