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

/* global YT */

'use strict';

const IFRAME_ID = 'youtube';

// Interval between checks when transcript focus follows video playback.
const POLLING_INTERVAL = 100;

let currentSpan = null;
const iframe = document.getElementById(IFRAME_ID);
let player;
let pollingTimerId;

// used in addSpanHandlers();
const spans = document.querySelectorAll('span[data-start]');

const captionScrollCheckbox = document.getElementById('captionScroll');
// captionScrollCheckbox.onchange = (event) => {
//   if (event.target.checked) {
//     startPolling();
//   } else {
//     stopPolling();
//   }
// }

// If the user scrolls manually, turn off automatic scrolling.
window.onwheel = window.ontouchmove = () => {
  captionScrollCheckbox.checked = false;
};

// Select whether the iframe position is sticky, or scrolls with the page.
// The initial state is `sticky`.
const videoStickyCheckbox = document.getElementById('videoSticky');
videoStickyCheckbox.onchange = (event) => {
  if (event.target.checked) {
    iframe.style.position = 'sticky';
  } else {
    iframe.style.position = 'unset';
  }
};

// Get the YouTube API script.
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

/* eslint-disable */
function onYouTubeIframeAPIReady() {
  /* eslint-enable */
  // console.log('>>> onYouTubeIframeAPIReady');
  player = new YT.Player(IFRAME_ID, {
    events: {
      'onReady': handlePlayerReady,
      'onStateChange': handlePlayerStateChange,
    },
    // videoId: '25aCD5XL1Jk',
    // host: window.location.host,
  });
}

function handlePlayerReady(event) {
  console.log('>>> ready', event);
  addSpanHandlers();
}

// Start polling when the video starts playing, and vice versa.
function handlePlayerStateChange(event) {
  // console.log('>>> handlePlayerStateChange', event.data);
  if (event.data === YT.PlayerState.PLAYING) {
    startPolling();
  } else if (event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED) {
    stopPolling();
  }
}

// Set the current time of the video when you click on a span.
function addSpanHandlers() {
  for (const span of spans) {
    span.onclick = () => {
      if (currentSpan) {
        currentSpan.classList.remove('current');
      }
      currentSpan = span;
      span.classList.add('current');
      const start = span.getAttribute('data-start');
      // Second parameter is allowSeekAhead.
      player.seekTo(start, true);
      // Will not work until user has manually initiated playback.
      player.playVideo();
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
  for (const span of spans) {
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
  // iframe height + iframe CSS outline height + page margin.
  const iframeOffset = iframe.offsetHeight + 40;
  if (inView(span, iframeOffset)) {
    return;
  }
  if (videoStickyCheckbox.checked) {
    span.scrollIntoView({block: 'start'});
    scrollBy(0, -iframeOffset);
  } else {
    span.scrollIntoView({block: 'center'});
  }
}

function inView(span, iframeOffset) {
  const r = span.getBoundingClientRect();
  return r.top >= iframeOffset &&
      r.bottom < document.documentElement.clientHeight;
}
