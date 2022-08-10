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
  '/partytown.js': partytown_js,
  '/partytown-atomics.js': partytown_atomics_js,
  '/partytown-media.js': partytown_sw_js,
  '/partytown-sw.js': partytown_media_js,
  // partydown debug scripts
  '/debug/partytown.js': debug_partytown_js,
  '/debug/partytown-atomics.js': debug_partytown_atomics_js,
  '/debug/partytown-media.js': debug_partytown_media_js,
  '/debug/partytown-sandbox-sw.js': debug_partytown_sandbox_sw_js,
  '/debug/partytown-sw.js': debug_partytown_sw_js,
  '/debug/partytown-ww-atomics.js': debug_partytown_ww_atomics_js,
  '/debug/partytown-ww-sw.js': debug_partytown_ww_sw_js,
};

addEventListener('fetch', (ev) => {
  ev.respondWith(handleRequest(ev.request));
});

async function handleRequest(_req) {
  const url = new URL(_req.url);

  // eventually this will come from headers
  // const worker = `${url.protocol}//${url.hostname}`;
  const worker = 'http://localhost:8787'; // use this for `wrangler dev`
  url.hostname = 'www.kremp.com';

  const req = new Request(_req);
  req.headers.set('referer', `https://${url.hostname}`);

  // remove /smx from the front of the url for proxying
  // if (url.pathname.startsWith('/smx')) {
  //   url.pathname = url.pathname.slice(4);
  // }

  const acceptHeader = req.headers.get('accept');

  // see if we need to return a partytown js script
  if (url.pathname in statics) {
    const headers = new Headers();
    headers.set('Content-Type', 'text/javascript');
    return new Response(statics[url.pathname], {
      status: 200,
      headers,
    });
  }

  if (acceptHeader) {
    if (acceptHeader.indexOf('text/html') >= 0) {
      const _res = await fetch(url.toString(), req);
      const res = new Response(_res.body, _res);
      const writer = new HTMLRewriter();
      // selector for any scripts that should be handled by partytown
      writer.on(
        'script[src*="lightboxcdn.com"],script[src*="chimpstatic.com"]',
        {
          element(el) {
            const type = el.getAttribute('type');
            if (!type || type === 'text/javascript') {
              el.setAttribute('type', 'text/partytown');
            }
          },
        }
      );
      // self-host all the things
      writer.on('*', {
        element: (el) => {
          if (!el.removed) {
            for (const attr of ['src', 'data-src', 'href', 'action', 'style']) {
              if (el.hasAttribute(attr)) {
                el.setAttribute(
                  attr,
                  el
                    .getAttribute(attr)
                    .replace(`https://${url.hostname}`, worker)
                );
              }
            }
          }
        },
      });
      let body = '';
      writer.on('script,style', {
        text: (node) => {
          body += node.text;
          if (node.lastInTextNode) {
            node.replace(body.replaceAll(`https://${url.hostname}`, worker), {
              html: true,
            });
            body = '';
          } else {
            node.remove();
          }
        },
      });
      // prepend the master partytown script inline to the top of the head
      writer.on('head', {
        element(el) {
          // change to `partytown_js` to run in non-debug mode
          el.prepend(`<script>${debug_partytown_js}</script>`, {
            html: true,
          });
        },
      });
      return writer.transform(res);
    }
  }

  return fetch(url.toString(), req);
}
