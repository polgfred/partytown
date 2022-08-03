import partytown_js from './public/partytown.txt';
import partytown_atomics_js from './public/partytown-atomics.txt';
import partytown_media_js from './public/partytown-media.txt';
import partytown_sw_js from './public/partytown-sw.txt';

import debug_partytown_js from './public/debug/partytown.txt';
import debug_partytown_atomics_js from './public/debug/partytown-atomics.txt';
import debug_partytown_media_js from './public/debug/partytown-media.txt';
import debug_partytown_sandbox_sw_js from './public/debug/partytown-sandbox-sw.txt';
import debug_partytown_sw_js from './public/debug/partytown-sw.txt';
import debug_partytown_ww_atomics_js from './public/debug/partytown-ww-atomics.txt';
import debug_partytown_ww_sw_js from './public/debug/partytown-ww-sw.txt';

const statics = {
  // partytown scripts
  '/public/partytown.txt': partytown_js,
  '/public/partytown-atomics.txt': partytown_atomics_js,
  '/public/partytown-media.txt': partytown_sw_js,
  '/public/partytown-sw.txt': partytown_media_js,
  // partydown debug scripts
  '/debug/partytown.txt': debug_partytown_js,
  '/debug/partytown-atomics.txt': debug_partytown_atomics_js,
  '/debug/partytown-media.txt': debug_partytown_media_js,
  '/debug/partytown-sandbox-sw.txt': debug_partytown_sandbox_sw_js,
  '/debug/partytown-sw.txt': debug_partytown_sw_js,
  '/debug/partytown-ww-atomics.txt': debug_partytown_ww_atomics_js,
  '/debug/partytown-ww-sw.txt': debug_partytown_ww_sw_js,
};

addEventListener('fetch', (ev) => {
  ev.respondWith(handleRequest(ev.request));
});

async function handleRequest(req) {
  const url = new URL(req.url);

  // eventually this will come from headers
  url.hostname = 'www.kremp.com';

  // remove /smx from the front of the url for proxying
  // if (url.pathname.startsWith('/smx')) {
  //   url.pathname = url.pathname.slice(4);
  // }

  const acceptHeader = req.headers.get('accept');
  if (acceptHeader) {
    if (acceptHeader.indexOf('text/html') >= 0) {
      // see if we need to return a partytown js script
      if (url.pathname in statics) {
        return new Response(`<script>${statics[url.pathname]}</script>`, 200);
      }

      const res = await fetch(url.toString(), req);
      const writer = new HTMLRewriter();
      // prepend the master partytown script inline to the top of the head
      writer.on('head', {
        element(el) {
          // change to `partytown_js` to run in non-debug mode
          el.prepend(`<script>${debug_partytown_js}</script>`, {
            html: true,
          });
        },
      });
      // selector for any scripts that should be handled by partytown
      writer.on('script[src*="chimpstatic.com"]', {
        element(el) {
          el.setAttribute('type', 'text/partytown');
        },
      });
      return writer.transform(res);
    }
  }

  return fetch(url.toString(), req);
}
