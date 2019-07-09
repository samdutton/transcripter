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

// Interval between checks when transcript
// focus follows video playback.
const POLLING_INTERVAL = 100;

let currentSpan = null;
const iframe = document.getElementById(IFRAME_ID);
let player;
let pollingTimerId;

// used in addSpanHandlers();
const spans = document.querySelectorAll('span[data-start]');

const captionScrollCheckbox = document.getElementById('captionScroll');
captionScrollCheckbox.onchange = (event) => {
  if (event.target.checked) {
    startPolling();
  } else {
    stopPolling();
  }
}
window.onwheel = () => {
  stopPolling();
  captionScrollCheckbox.checked = false;
}

const videoStickyCheckbox = document.getElementById('videoSticky');
videoStickyCheckbox.onchange = (event) => {
  if (event.target.checked) {
    iframe.style.position = 'sticky';
  } else {
    iframe.style.position = 'unset';
  }
}

const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

/* eslint-disable */
function onYouTubeIframeAPIReady() {
  // console.log('>>> onYouTubeIframeAPIReady');
  /* eslint-enable */
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
  // player.time = 0;
  // console.log('>>> ready', event);
  addSpanHandlers();
}

function handlePlayerStateChange(event) {
  // console.log('>>> handlePlayerStateChange', event.data);
  if (event.data === YT.PlayerState.PLAYING && captionScrollCheckbox.checked) {
    startPolling();
    // console.log('>>> stateChange playing', event.data);
  } else if (event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED) {
    stopPolling();
    // console.log('>>> stateChange paused', event.data);
  }
}

function addSpanHandlers() {
  for (const span of spans) {
    const start = span.getAttribute('data-start');
    span.onclick = () => {
      player.seekTo(start, true);
      player.playVideo();
    };
  }
}

function startPolling() {
  if (captionScrollCheckbox.checked) {
    pollingTimerId = setInterval(focusCaption, POLLING_INTERVAL);
  }
}

function stopPolling() {
  clearInterval(pollingTimerId);
}

function focusCaption() {
  const currentTime = player.getCurrentTime();
  if (currentSpan) {
    currentSpan.classList.remove('current');
  }
  for (const span of spans) {
    if (span.dataset.start < currentTime && span.dataset.end > currentTime) {
      span.classList.add('current');
      currentSpan = span;
      if (videoStickyCheckbox.checked) {
        // Need to account for sticky iframe height
        // + the iframe CSS outline + page margin
        span.scrollIntoView({block: 'start'});
        scrollBy(0, -(iframe.offsetHeight + 40));
      } else {
        span.scrollIntoView({block: 'center'});
      }
      break;
    }
  }
}


// function addTranscriptClickHandler(span) {
//   const start = span.getAttribute('data-start');
//   span.title = start;
//   span.onclick = function() {
//     videos[videoId].player.seekTo(Math.round(start));
//     // tellPlayer(iframe, 'seekTo', [start]);
//     // tellPlayer(iframe, 'playVideo');
//   };
// }
