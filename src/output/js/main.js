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

const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
/* eslint-disable */
function onYouTubeIframeAPIReady() {
/* eslint-enable */
  player = new YT.Player(IFRAME_ID, {
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
    }});
}

function onPlayerReady(event) {
  console.log('>>> ready', event);
}

function onPlayerStateChange(event) {
  console.log('>>> stateChange', event);
}

// function onPlayerStateChange() {
//   //...
// }]

// function initPolling(video) {
//   const player = video.player;
//   const startTimes = video.startTimes;
//   setInterval(function() {
//     const currentTime = player.getCurrentTime();
//     if (video.currentTime === currentTime) {
//       return;
//     }
//     video.currentTime = currentTime;
//     for (const i = 0; i !== startTimes.length; ++i) {
//       if (startTimes[i] <= currentTime && startTimes[i + 1] > currentTime) {
//         if (video.currentSpan) {
//           video.currentSpan.classList.remove('current');
//         }
//         const transcript = document.getElementById('transcript_' + video.id);
//         const selector = 'span[data-start="' + startTimes[i] + '"]';
//         video.currentSpan = transcript.querySelector(selector);
//         video.currentSpan.classList.add('current');
//       }
//     }
//   }, 100);
// }

// function addTranscriptClickHandler(span) {
//   const start = span.getAttribute('data-start');
//   span.title = start;
//   span.onclick = function() {
//     videos[videoId].player.seekTo(Math.round(start));
//     // tellPlayer(iframe, 'seekTo', [start]);
//     // tellPlayer(iframe, 'playVideo');
//   };
// }
