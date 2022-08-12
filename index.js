addEventListener('fetch', (ev) => {
  ev.respondWith(handleRequest(ev));
});

// the parsed static content manifest
const manifest = JSON.parse(__STATIC_CONTENT_MANIFEST);

async function handleRequest(ev) {
  const req = new Request(ev.request);
  const url = new URL(req.url);

  // make sure we have an X-Host header
  if (!req.headers.has('x-host')) {
    return new Response('expected an X-Host header to be set', {
      status: 400,
    });
  }

  // grab the original worker origin for self-hosting
  const worker = DEVMODE ? 'http://localhost:8787' : url.origin;

  // replace the incoming URL with the one we're proxying to
  url.protocol = 'https:';
  url.hostname = req.headers.get('x-host');

  // set the referer so we can proxy to these resources
  req.headers.set('referer', url.origin);

  // remove /smx from the front of the url for proxying
  // if (url.pathname.startsWith('/smx')) {
  //   url.pathname = url.pathname.slice(4);
  // }

  const acceptHeader = req.headers.get('accept');

  // see if we're returning a partytown js script
  const cacheKey = url.pathname.replace(/^\/+/, '');
  if (cacheKey in manifest) {
    const headers = new Headers();
    headers.set('Content-Type', 'text/javascript');
    return new Response(await __STATIC_CONTENT.get(manifest[cacheKey]), {
      status: 200,
      headers,
    });
  }

  if (acceptHeader) {
    if (acceptHeader.indexOf('text/html') >= 0) {
      const res = await fetch(url.toString(), req);

      // fetch the partytown script so we can inline it
      const partytownJS = await __STATIC_CONTENT.get(
        // manifest['partytown.js']
        manifest['debug/partytown.js']
      );

      // selector for any scripts that should be handled by partytown
      const writer = new HTMLRewriter();
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
                  el.getAttribute(attr).replace(url.origin, worker)
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
            node.replace(body.replaceAll(url.origin, worker), {
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
          el.prepend(
            `<script>partytown={lib:"/",debug:true}${partytownJS}</script>`,
            {
              html: true,
            }
          );
        },
      });

      return writer.transform(res);
    }
  }

  return fetch(url.toString(), req);
}
