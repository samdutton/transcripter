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

'use strict';

const containerDiv = document.getElementById('container');

const videos = {};

const videoId = location.search.split('id=')[1];
if (videoId) {
  const match = videoId.match(/[\w-]{11}/);
  if (match) {
    getAndDisplayTranscript();
  } else {
    window.alert('That doesn\'t seem to be a valid YouTube ID:\n\n ' + videoId);
  }
} else {
  window.alert('No video ID. \n\nThe URL should look like this:\n\n' +
    'simpl.info/s/t?id=ngBy0H_q-GY');
  console.log('No video ID. URL should look like this: ' +
    'simpl.info/s/t?id=ngBy0H_q-GY');
}

function getAndDisplayTranscript() {
  // to enable testing
  const baseUrl = location.host === 'localhost' ?
    'https://localhost:8080' : 'https://shearch-me.herokuapp.com';
  const url = baseUrl + '/' + videoId;
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      const responseText = xhr.responseText;
      if (xhr.status === 200) {
        const data = JSON.parse(responseText);
        handleTranscriptRequest(data);
      } else {
        console.log('Error getting transcript: ', responseText);
      }
    }
  };
  xhr.send();
}

function handleTranscriptRequest(results) {
  for (const i = 0; i !== results.length; ++i) {
    const video = results[i];
    videos[videoId] = {
      currentTime: 0,
      id: videoId,
      startTimes: []
    };

    const h1 = document.createElement('h1');
    h1.innerHTML = video.title;
    containerDiv.appendChild(h1);

    if (video.speakers) {
      const h2 = document.createElement('h2');
      h2.textContent = video.speakers.join(', ');
      containerDiv.appendChild(h2);
    }
    const iframe = document.createElement('iframe');
    let iframeId = 'yt' + videoId;
    iframe.id = iframeId;
    iframe.src = 'https://www.youtube.com/embed/' +
    videoId + '?enablejsapi=1&html5=1';
    iframe.classList.add('youtube-player');
    iframe.height = 270;
    iframe.width = 480;
    containerDiv.appendChild(iframe);

    iframe.onload = handleIframeLoad.bind(undefined, videos[videoId], iframeId);

    if (video.transcript) {
      const transcript = document.createElement('div');
      transcript.id = 'transcript_' + videoId;
      transcript.classList.add('transcript');
      transcript.innerHTML = video.transcript;
      containerDiv.appendChild(transcript);
      const spans = transcript.querySelectorAll('span[data-start]');
      for (const j = 0; j !== spans.length; ++j) {
        addTranscriptClickHandler(spans[j], videoId);
        videos[videoId].startTimes.push(spans[j].title); // title is start time
      }
    } else {
      const p = document.createElement('p');
      p.textContent = 'No transcript for video ID ' + videoId;
      containerDiv.appendChild(p);
    }
  }
}

function handleIframeLoad(video, iframeId) {
  /* globals YT */
  const player = new YT.Player(iframeId, {
    // events: {
    //   'onReady': function(event) {
    //     console.log('>>>>> ready: ', event, iframeId);
    //   },
    //   'onStateChange': function(event) {
    //     console.log('>>>>> stae change: ', event);
    //   }
    // }
  });
  player.time = 0;
  video.player = player;
  // TODO: something better — seems to need setup time :^\
  setTimeout(function() {
    initPolling(video);
  }, 1000);
}

// function onYouTubeIframeAPIReady() {
//   console.log('>>>>>>>> ready');
// }

function initPolling(video) {
  const player = video.player;
  const startTimes = video.startTimes;
  setInterval(function() {
    const currentTime = player.getCurrentTime();
    if (video.currentTime === currentTime) {
      return;
    }
    video.currentTime = currentTime;
    for (const i = 0; i !== startTimes.length; ++i) {
      if (startTimes[i] <= currentTime && startTimes[i + 1] > currentTime) {
        if (video.currentSpan) {
          video.currentSpan.classList.remove('current');
        }
        const transcript = document.getElementById('transcript_' + video.id);
        const selector = 'span[data-start="' + startTimes[i] + '"]';
        video.currentSpan = transcript.querySelector(selector);
        video.currentSpan.classList.add('current');
      }
    }
  }, 100);
}

function addTranscriptClickHandler(span) {
  const start = span.getAttribute('data-start');
  span.title = start;
  span.onclick = function() {
    videos[videoId].player.seekTo(Math.round(start));
    // tellPlayer(iframe, 'seekTo', [start]);
    // tellPlayer(iframe, 'playVideo');
  };
}
