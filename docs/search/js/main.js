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

/* globals gtag FlexSearch YT */

const CACHE_NAME = 'cache';

// const DATALISTS_FILE = 'data/datalists.json';
const IFRAME_ID = 'youtube';
// Interval between checks when transcript focus follows video playback.
const POLLING_INTERVAL = 100;

const SEARCH_INDEX_FILE = 'data/index.json';
const TRANSCRIPT_DIR = 'transcripts';

const DEBOUNCE_DELAY = 300;
const QUERY_INPUT_PLACEHOLDER = 'Search for a word or phrase';
// TODO: Replace with real URL
const SEARCH_QUERY_PAGE_LOCATION = `https://developer.chrome.com/devsummit/search?q=`;
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
const iframe = document.getElementById(IFRAME_ID);
const infoElement = document.getElementById('info');
const matchesList = document.getElementById('matches');
const topSection = document.getElementById('top');
const queryInfoElement = document.getElementById('query-info');
const queryInput = document.getElementById('query');
const searchOptionsDetails = document.getElementById('search-options');

// const speakerInput = document.getElementById('speaker');
// const speakersDatalist = document.getElementById('speakers');
const transcriptDiv = document.getElementById('transcript');
// const titleInput = document.getElementById('title');
// const titlesDatalist = document.getElementById('titles');

const baseUrl = `${window.location.origin}${window.location.pathname}`;

let captionSpans;
let currentSpan = null;
let currentVideo;
let datalists;
let matches;
let player;
let pollingTimerId;
let startTime;
// let videoTitles;
let timeout = null;


const captionScrollCheckbox = document.getElementById('captionScroll');
captionScrollCheckbox.checked = localStorage.captionScroll === 'true';
captionScrollCheckbox.onchange = (event) => {
  localStorage.captionScroll = event.target.checked;
};
// If the user scrolls manually, turn off automatic scrolling.
window.onwheel = window.ontouchmove = () => {
  captionScrollCheckbox.checked = false;
};

// Select whether the top section (search, video and page options) should be
// sticky. Otherwise it scrolls with the page. The initial state is `sticky`.
const videoStickyCheckbox = document.getElementById('videoSticky');
// Check the video checkbox unless it's previously been unchecked.
// In other words, the default state is checked/sticky.
videoStickyCheckbox.checked =
    localStorage.videoSticky === 'false' ? false : true;

videoStickyCheckbox.onchange = (event) => {
  // TODO: change to use class
  topSection.style.position = event.target.checked ? 'sticky' : 'unset';
  localStorage.videoSticky = event.target.checked;
};

// Get the YouTube API script.
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);


// When the video starts playing, start polling (to focus the current caption).
// Stop polling when video is paused or ended.
function handlePlayerStateChange(event) {
  // console.log('>>> handlePlayerStateChange', event.data);
  if (event.data === YT.PlayerState.PLAYING) {
    startPolling();
  } else if (event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED) {
    stopPolling();
  }
}

// Set the current time of the video when you tap/click on a caption.
function addCaptionSpanHandlers() {
  captionSpans = document.querySelectorAll('span[data-start]');
  for (const span of captionSpans) {
    span.onclick = () => {
      if (currentSpan) {
        currentSpan.classList.remove('current');
      }
      currentSpan = span;
      span.classList.add('current');
      const start = span.getAttribute('data-start');
      // Used to not work without rounded number :/...
      player.seekTo(Math.round(start));
      // Will not work until user has manually initiated playback.
      player.playVideo();
      const state = {type: 'caption', v: currentVideo, t: start};
      const title = `Caption: ${start}`;
      const url = `${baseUrl}?v=${currentVideo}&t=${start}`;
      history.pushState(state, title, url);
      document.title = `Caption: ${start}`;
    };
  }
}

function startPolling() {
  pollingTimerId = setInterval(focusCaption, POLLING_INTERVAL);
}

function stopPolling() {
  clearInterval(pollingTimerId);
}

// Set visual focus on the current caption.
function focusCaption() {
  const currentTime = player.getCurrentTime();
  if (currentSpan) {
    currentSpan.classList.remove('current');
  }
  for (const span of captionSpans) {
    // Find currentSpan — could be optimized.
    if (span.dataset.start < currentTime && span.dataset.end > currentTime) {
      span.classList.add('current');
      currentSpan = span;
      if (captionScrollCheckbox.checked) {
        ensureVisible(span);
      }
      break;
    }
  }
}

// If necessary, scroll the current span into view.
function ensureVisible(span) {
  // If videoStickyCheckbox is checked, it's necessary to account for
  // the height of section#top
  // topSectionHeight depends on the size of the viewport.
  if (inView(span)) {
    return;
  }
  // TODO: MVC rather than saving state in UI.
  if (videoStickyCheckbox.checked) {
    span.scrollIntoView({block: 'start'});
    // 40 is magic number to cope with margins.
    scrollBy(0, -(topSection.offsetHeight + 40));
  } else {
    span.scrollIntoView({block: 'center'});
  }
}

// Check if an element, such as a caption span, is in view.
function inView(element) {
  const elementRect = element.getBoundingClientRect();
  const topSectionRect = topSection.getBoundingClientRect();
  // 40 is magic number to cope with margins.
  return elementRect.top >= (topSectionRect.bottom + 40) &&
      elementRect.bottom < document.documentElement.clientHeight;
}

// Log a Google Analytics event when search options is opened.
searchOptionsDetails.ontoggle = (event) => {
  if (event.target.open) {
    gtag('event', 'Search options opened', {
      'event_category': 'Search',
      // 'event_label': 'Search options',
    });
  }
};

// Respond to URL pop.
// A hash value is a search query, video ID, or video ID and time (s or mm:ss)
// For example: /?q=brazen, /?v=AB9qSUhlxh8, /?v=AB9qSUhlxh8&t=1:41
window.onpopstate = handleQueryParams;

window.onload = () => {
  // registerServiceWorker();
  getSearchIndex();
};

// Get and load search index data
function getSearchIndex() {
  console.log('Fetching search index...');
  console.time('Fetch search index');
  fetch(SEARCH_INDEX_FILE).then((response) => {
    return response.text();
  }).then((text) => {
    console.timeEnd('Fetch search index');
    console.log('Loading search index...');
    console.time('Load search index');
    searchIndex.import(text);
    // const results = searchIndex.search('search');
    console.log(`Search index length: ${searchIndex.length}`);
    console.timeEnd('Load search index');
    queryInput.disabled = false;
    queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
    queryInput.focus();
    // Get and parse data for video titles and speaker names from datalists.json.
    // Run here to ensure that (for performance) index data is retrieved first.
    window.setTimeout(fetchDatalists, 100);
  }).catch((error) => {
    displayInfo(`There was a problem downloading data.<br>` +
      `Check that you're online, or try refreshing the page.<br><br>`);
    console.error(`Error fetching ${SEARCH_INDEX_FILE}: ${error}`);
  });
}

// Fetch and parse data for speaker names, etc.
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
  //   // NB: handleQueryParams() called in checkForQueryParams()
  //   // depends on data in DATALISTS_FILE
  window.setTimeout(checkForQueryParams, 100);
  // }).catch((error) => {
  //   displayInfo('There was a problem downloading data.<br><br>' +
  //     'Please check that you\'re online or try refreshing the page.');
  //   console.error(`Error fetching ${DATALISTS_FILE}: ${error}`);
  // });
}

// If the location has query params, do a search of load a video
function checkForQueryParams() {
  if (location.search) {
    handleQueryParams();
  }
}

// Query paramters mean a search query, video ID, or video ID and time (s or mm:ss)
// For example: /?q=brazen, /?v=AB9qSUhlxh8, /?v=AB9qSUhlxh8&t=1:41
function handleQueryParams() {
  const params = new URLSearchParams(window.location.search);
  let query = params.get('q');
  const video = params.get('v');
  if (query) {
    // Decode if necessary and replace non-alpha characters with a space
    query = decodeURI(query).replace(/[^\w.]+/g, ' ');
    if (query.length > 2) {
      queryInput.value = query;
    } else {
      queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
    }
    doSearch(query);
  } else if (video) {
    const startTime = params.get('t') || '0';
    const location = {
      st: startTime,
      v: video,
    };
    displayCaption(location);
  }
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
    const state = {type: 'query', value: value};
    const title = `Query: ${value}`;
    const url = `${baseUrl}?q=${value}`;
    history.pushState(state, title, url);
    document.title = `Search: ${value}`;
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
  queryInfoElement.textContent = 'Click on a match to view video';
  displayMatches(query);
}

// Display a list of matched captions
function displayMatches() {
  hide(iframe);
  hide(infoElement);
  hide(matchesList);
  matchesList.textContent = '';
  hide(queryInfoElement);
  hide(transcriptDiv);
  const filteredMatches = getFilteredMatches();
  if (filteredMatches.length > 0) {
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
  const matchElement = document.createElement('li');
  matchElement.dataset.speaker = match.sp;
  matchElement.dataset.start = match.st;
  matchElement.dataset.video = match.v;
  matchElement.innerHTML = match.t;
  matchElement.title = match.sp;
  matchElement.onclick = () => {
    displayCaption(match);
  };
  matchesList.appendChild(matchElement);
}

// Display the appropriate video and caption when a user taps/clicks on a match
// or opens a URL with a video and (optionally) a time parameter
function displayCaption(match) {
  // hide(creditElement);
  hide(infoElement);
  hide(matchesList);
  hide(queryInfoElement);
  show(topSection);
  currentVideo = `${match.v}`;
  if (iframe.src === '') {
    iframe.src = `https://www.youtube.com/embed/${match.v}?enablejsapi=1&html5=1` +
        `&start=${match.st}&autoplay=1&mute=1`;
    iframe.onload = () => {
      player = new YT.Player(IFRAME_ID, {
        events: {
          'onStateChange': handlePlayerStateChange,
          'onReady': () => {
            player.time = match.st; // start time
            player.seekTo(Math.round(match.st));
          },
        },
      });
    };
  } else {
    player.loadVideoById({
      videoId: match.v,
      startSeconds: Math.round(match.st),
    });
  }

  show(iframe);
  const state = {type: 'caption', v: match.v, t: match.t};
  const title = `Caption: ${match.v, match.st}`;
  const url = `${baseUrl}?v=${match.v}&t=${match.st}`;
  history.pushState(state, title, url);
  document.title = title;
  const transcriptFilepath = `${TRANSCRIPT_DIR}/${match.v}.html`;
  fetch(transcriptFilepath).then((response) => {
    return response.text();
  }).then((html) => {
    transcriptDiv.innerHTML = html;
    addCaptionSpanHandlers();
    // transcriptDiv.onmouseover = addWordSearch;
    show(transcriptDiv);
    // show(creditElement);
    highlightCaption(match.st);
  }).catch((error) => {
    console.error(`Error or timeout fetching ${transcriptFilepath}: ${error}`);
    displayInfo(`There was a problem downloading the transcript for ` +
      `<em>${transcriptFilepath}.</em><br><br>` +
      'Check that you\'re online, or try refreshing the page.<br><br>' +
      'You can download transcripts when you\'re online by selecting the ' +
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

// Highlight a caption, given a start time, and make sure it's visible.
function highlightCaption(startTime) {
  const captionSpan = document.querySelector(`span[data-start="${startTime}"]`);
  captionSpan.classList.add('current');
  ensureVisible(captionSpan);
  // const start = captionSpan.getAttribute('data-start');
  // player.seekTo(Math.round(start)); // used to need rounded time
  // Will not work until user has manually initiated playback.
  // player.play();
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
