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
const documentElement = document.documentElement;
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
//  stopPolling();
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
  console.log('>>> handlePlayerStateChange', event.data);
  if (event.data === YT.PlayerState.PLAYING) {
    startPolling();
  } else if (event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED) {
    stopPolling();
  }
}

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
      player.seekTo(start/*, true */);
      player.playVideo();
    };
  }
}

function startPolling() {
  console.log('>>> start polling');
  pollingTimerId = setInterval(focusCaption, POLLING_INTERVAL);
}

function stopPolling() {
  console.log('>>> stop polling');
  clearInterval(pollingTimerId);
}

function focusCaption() {
  const currentTime = player.getCurrentTime();
  if (currentSpan) {
    currentSpan.classList.remove('current');
  }
  for (const span of spans) {
    // Find currentSpan — could be optimized.
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

function ensureVisible(span) {
  console.log(span.textContent);
  // If videoStickyCheckbox is checked, it's necessary to account for
  // iframe height + iframe CSS outline height + page margin.
  if (videoStickyCheckbox.checked) {
      span.scrollIntoView({block: 'start'});
      scrollBy(0, -(iframe.offsetHeight + 40));
  } else {
    span.scrollIntoView({block: 'center'});
  }
}

function inView(element) {
  const r = element.getBoundingClientRect();
  return r.bottom >= 0  && r.right >= 0  &&
    r.top <= documentElement.clientHeight
    r.left <= documentElement.clientWidth;
}
