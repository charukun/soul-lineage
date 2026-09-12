const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
};

function decode(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/');
}

function attrs(tag = '') {
  const out = {};
  const re = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  let match;
  while ((match = re.exec(tag))) out[match[1].toLowerCase()] = decode(match[3]);
  return out;
}

function absolute(value, base) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function parseMetadata(html, url) {
  const meta = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const key = (a.property || a.name || '').toLowerCase();
    if (key && a.content && !meta.has(key)) meta.set(key, a.content.trim());
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonicalMatch = html.match(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  const canonicalAttrs = canonicalMatch ? attrs(canonicalMatch[0]) : {};
  const pageUrl = absolute(meta.get('og:url') || canonicalAttrs.href || url, url) || url;
  const title = meta.get('og:title') || meta.get('twitter:title') || decode(titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || '');
  const description = meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || '';
  const image = absolute(meta.get('og:image:secure_url') || meta.get('og:image') || meta.get('twitter:image'), pageUrl);
  const video = absolute(meta.get('og:video:secure_url') || meta.get('og:video') || meta.get('twitter:player'), pageUrl);
  const siteName = meta.get('og:site_name') || new URL(pageUrl).hostname.replace(/^www\./, '');
  const type = meta.get('og:type') || (video ? 'video' : 'website');
  return { title, description, image, video, siteName, type, url: pageUrl };
}

function youtubePreview(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    if (/youtube\.com$/.test(u.hostname) || u.hostname.endsWith('.youtube.com')) {
      id = u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null);
    }
    if (!id) return null;
    return {
      title: 'YouTube',
      description: '',
      image: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`,
      video: `https://www.youtube.com/embed/${encodeURIComponent(id)}`,
      siteName: 'YouTube',
      type: 'video',
      url,
    };
  } catch {
    return null;
  }
}

async function fetchPreview(url) {
  const yt = youtubePreview(url);
  if (yt) return { ...yt, status: 'ok' };

  const cache = caches.default;
  const cacheKey = new Request(`https://wayfinder-preview.invalid/meta?u=${encodeURIComponent(url)}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  let preview;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'WayfinderRichPreview/1.0 (+https://wayfinder-gallery.c-okamoto.workers.dev/)',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('not html');
    const html = (await response.text()).slice(0, 600_000);
    preview = { ...parseMetadata(html, response.url || url), status: 'ok' };
  } catch (error) {
    preview = {
      title: '', description: '', image: null, video: null,
      siteName: new URL(url).hostname.replace(/^www\./, ''), type: 'website', url,
      status: 'unavailable', reason: String(error?.message || error),
    };
  }

  const response = new Response(JSON.stringify(preview), { headers: { ...JSON_HEADERS, 'cache-control': 'public, max-age=900' } });
  await cache.put(cacheKey, response.clone());
  return preview;
}

async function catalogFromAssets(env, request) {
  const url = new URL('/catalog.json', request.url);
  const response = await env.ASSETS.fetch(new Request(url, request));
  if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
  return response.json();
}

async function enrichItem(item) {
  const primaryUrl = item.previewUrl || item.links?.[0]?.url;
  const fallbackUrl = item.fallbackPreviewUrl;
  let preview = primaryUrl ? await fetchPreview(primaryUrl) : null;
  if ((!preview || preview.status !== 'ok' || (!preview.image && !preview.video)) && fallbackUrl) {
    const fallback = await fetchPreview(fallbackUrl);
    if (fallback?.status === 'ok') preview = {
      ...fallback,
      title: preview?.title || fallback.title,
      description: preview?.description || fallback.description,
      url: item.links?.[0]?.url || fallback.url,
      previewSource: fallbackUrl,
    };
  }
  return { ...item, preview };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/catalog') {
      try {
        const catalog = await catalogFromAssets(env, request);
        const items = await Promise.all((catalog.items || []).map(enrichItem));
        return new Response(JSON.stringify({ ...catalog, items }), { headers: JSON_HEADERS });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error?.message || error) }), {
          status: 502,
          headers: { ...JSON_HEADERS, 'cache-control': 'no-store' },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
