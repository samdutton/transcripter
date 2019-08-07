/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

/* globals importScripts workbox */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js');

workbox.core.skipWaiting();

workbox.core.clientsClaim();

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    'url': 'css/main.css',
    'revision': '1dbbaa8ef8bb13cfad85cbab032d8ae1',
  },
  {
    'url': 'favicon.ico',
    'revision': '667808a26857fdb514f12a48840e232d',
  },
  {
    'url': 'images/icons/icon192.png',
    'revision': 'd793e95b587b8a01334dde5bba88fbb4',
  },
  {
    'url': 'images/icons/icon32.png',
    'revision': '4356b61b6be9a9f13d863ba39e427568',
  },
  {
    'url': 'images/icons/icon512.png',
    'revision': '2c0a4820c4718aee36722eb4ae3efcf8',
  },
  {
    'url': 'images/icons/icon96.png',
    'revision': '52b8dc785b6a68e2945825e6d648c99a',
  },
  {
    'url': 'index.html',
    'revision': '822831dba1c6866a96620dfdac4778e6',
  },
  {
    'url': 'js/main.js',
    'revision': 'eb51f851ae53940fb5ffe06b2716a307',
  },
  {
    'url': 'js/third-party/flexsearch.min.js',
    'revision': 'bdc2dbed628a3bb7a62d58b999dd7123',
  },
  {
    'url': 'manifest.json',
    'revision': '8b66d97820dbc797d21b3b3ab7ec2848',
  },
].concat(self.__precacheManifest || []);
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

workbox.routing.registerRoute(/\/data\/.*.json/,
  new workbox.strategies.CacheFirst({'cacheName': 'json-data',
    'plugins': [new workbox.expiration.Plugin({maxAgeSeconds: 2592000, purgeOnQuotaError: false})]}), 'GET');
workbox.routing.registerRoute(/\/html\/.*.html/,
  new workbox.strategies.CacheFirst({'cacheName': 'html-data',
    'plugins': [new workbox.expiration.Plugin({maxAgeSeconds: 2592000, purgeOnQuotaError: false})]}), 'GET');

workbox.googleAnalytics.initialize({});
