// This module is pure: it never expands short links or contacts any host.
export const amazonMarkets = new Set([
  'amazon.com', 'amazon.ca', 'amazon.com.mx', 'amazon.com.br',
  'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
  'amazon.nl', 'amazon.se', 'amazon.pl', 'amazon.com.be', 'amazon.ie',
  'amazon.co.jp', 'amazon.in', 'amazon.com.au', 'amazon.sg',
  'amazon.ae', 'amazon.sa', 'amazon.com.tr', 'amazon.eg', 'amazon.co.za'
]);
const socialHosts = new Set([
  'threads.com', 'www.threads.com', 'threads.net', 'www.threads.net',
  'netflix.com', 'www.netflix.com', 'primevideo.com', 'www.primevideo.com',
  'instagram.com', 'www.instagram.com', 'tiktok.com', 'www.tiktok.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch', 'fb.me',
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 'bsky.app',
  'reddit.com', 'www.reddit.com', 'old.reddit.com', 'clips.twitch.tv', 'www.twitch.tv', 'twitch.tv',
  'snapchat.com', 'www.snapchat.com', 'xiaohongshu.com', 'www.xiaohongshu.com', 'rednote.com', 'www.rednote.com',
  'medal.tv', 'www.medal.tv', 'streamable.com', 'www.streamable.com', 'imgur.com', 'www.imgur.com', 'i.imgur.com', 'ifunny.co', 'www.ifunny.co', 'vimeo.com', 'www.vimeo.com', 'giphy.com', 'www.giphy.com', 'tenor.com', 'www.tenor.com',
  'linkedin.com', 'www.linkedin.com', 'share.upscrolled.com', 'mastodon.social', 'mastodon.online'
]);
export function isAmazonHost(host) {
  return amazonMarkets.has(host.replace(/^www\./, ''));
}
export function cleanPublicUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\\\u0000-\u0020]/.test(raw)) return null;
  // Check the raw authority too: URL() normalizes encoded hosts and default ports.
  const authority = /^https:\/\/([^/?#]+)/i.exec(raw)?.[1];
  if (!authority || !/^[a-z0-9.-]+$/i.test(authority)) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port
    || (!socialHosts.has(u.hostname) && !isAmazonHost(u.hostname))) return null;
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_.+|ref|ref_|referrer|referral|tag|ascsubtag|linkcode|camp|creative|creativeasin|affiliate|affiliate_id|aff_id|fbclid|gclid|dclid|msclkid|igsh|igshid|si|feature|pp|mibextid|__tn__|__cft__.*|_r|_t|is_from_webapp|sender_device|share_app_id|share_link_id|share_item_id|share_iid|share_id|tt_from|tt_medium|tt_content|tt_campaign)$/i.test(key)) {
      u.searchParams.delete(key);
    }
  }
  return u.href.length <= 2048 ? u : null;
}

export function parseAmazonProduct(u) {
  if (!isAmazonHost(u.hostname)) return null;
  const match = /^\/(?:[^/]+\/)?dp\/([A-Za-z0-9]{10})(?:\/ref=[^/]*)?\/?$/.exec(u.pathname)
    ?? /^\/gp\/(?:product|aw\/d)\/([A-Za-z0-9]{10})(?:\/ref=[^/]*)?\/?$/.exec(u.pathname);
  if (!match) return null;
  const asin = match[1].toUpperCase();
  return { platform: 'amazon', kind: 'product', asin,
    url: `https://${u.hostname}/dp/${asin}` };
}

// Explicitly authorized source-text cleanup, restricted to supported Netflix routes.
export function cleanNetflixLinks(content) {
  return content.replace(/https:\/\/(?:www\.)?netflix\.com\/[^\s<>]+/gi, raw => {
    const suffix = /[.,!;:)\]}]+$/.exec(raw)?.[0] || '';
    const value = suffix ? raw.slice(0,-suffix.length) : raw;
    const u = cleanPublicUrl(value);
    if (!u || !/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:watch|title)\/\d{1,12}\/?$/.test(u.pathname)) return raw;
    for (const key of [...u.searchParams.keys()]) if (/^(trackId|tctx|trkid|trg|jbv)$/i.test(key)) u.searchParams.delete(key);
    return u.href + suffix;
  });
}

export function primeVideoPath(path) {
  return /^(?:\/region\/[a-z]{2})?\/(?:detail\/(?:[A-Za-z0-9_-]{1,200}\/)?[A-Za-z0-9]{10,30}|storefront\/merch\/[A-Za-z0-9_-]{1,100})\/?$/.test(path);
}
export function cleanPrimeVideoLinks(content) {
  return content.replace(/https:\/\/(?:www\.)?primevideo\.com\/[^\s<>]+/gi, raw => {
    const suffix = /[.,!;:)\]}]+$/.exec(raw)?.[0] || '';
    const u = cleanPublicUrl(suffix ? raw.slice(0,-suffix.length) : raw);
    if (!u || !primeVideoPath(u.pathname)) return raw;
    for (const key of [...u.searchParams.keys()]) if (/^(xdsso|ref_|ref|tag|linkCode)$/i.test(key)) u.searchParams.delete(key);
    return u.href + suffix;
  });

}

export function cleanYouTubeLinks(content) {
  return content.replace(/https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s<>]+/gi, raw => {
    const suffix = /[.,!;:)\]}]+$/.exec(raw)?.[0] || '';
    const value = suffix ? raw.slice(0,-suffix.length) : raw;
    const u = cleanPublicUrl(value);
    if (!u) return raw;
    const host = u.hostname.replace(/^(www\.|m\.)/,'');
    const path = u.pathname.replace(/\/$/,'');
    const id = host === 'youtu.be' ? path.slice(1) : path === '/watch' ? u.searchParams.get('v') : /^\/(?:shorts)\/([\w-]{11})$/.exec(path)?.[1];
    if (!/^[\w-]{11}$/.test(id || '')) return raw;
    // Keep playback fragments and every parameter except the known tracking list.
    const original = new URL(value);
    let changed = false;
    for (const key of [...original.searchParams.keys()]) {
      if (!u.searchParams.has(key)) { original.searchParams.delete(key); changed = true; }
    }
    return changed ? original.href + suffix : raw;
  });
}

export function cleanThreadsLinks(content) {
  return content.replace(/https:\/\/(?:www\.)?threads\.(?:com|net)\/[^\s<>]+/gi, raw => {
    const suffix = /[.,!;:)\]}]+$/.exec(raw)?.[0] || '';
    const u = cleanPublicUrl(suffix ? raw.slice(0,-suffix.length) : raw);
    if (!u || !/^\/(?:@[A-Za-z0-9_.]{1,30}\/post|t)\/[A-Za-z0-9_-]{1,64}\/?$/.test(u.pathname)) return raw;
    return u.href + suffix;
  });
}
