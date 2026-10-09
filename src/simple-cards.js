import { brands, footer } from './platform-brands.js';
import { extractLinks, parseSocialUrl } from './previews.js';
import { helperUrl } from './adapters.js';
import { helperModes } from './config.js';
import { instagramPayload, shortCaption, plain, cardHeading } from './instagram-card.js';

const mediaHosts = {
  medal: ['medal.tv', 'cdn.medal.tv'],
  streamable: ['api-f.streamable.com','cdn-cf-east.streamable.com','cdn-cf-west.streamable.com','cdn-cf.streamable.com'],
  imgur: ['i.imgur.com'],
  twitter: ['pbs.twimg.com', 'video.twimg.com'],
  bluesky: ['cdn.bsky.app', 'video.bsky.app'],
  tiktok: ['offload.tnktok.com'],
  reddit: ['i.redd.it', 'v.redd.it', 'preview.redd.it', 'external-preview.redd.it', 'vxreddit.com', 'www.vxreddit.com'],
  twitch: ['clips-media-assets2.twitch.tv', 'production.assets.clips.twitchcdn.net', 'clips-media-assets.twitch.tv'],
  snapchat: ['cf-st.sc-cdn.net'],
  facebook: [], amazon: [], rednote: [], linkedin: ['media.licdn.com'], upscrolled: [], mastodon: []
};
export function validMedia(raw, platform) {
  try {
    const u = new URL(raw);
    return typeof raw === 'string' && raw.length <= 2048 && u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash
      && ((mediaHosts[platform] || []).includes(u.hostname) || (platform === 'facebook' && /^scontent-[a-z0-9-]+\.xx\.fbcdn\.net$/.test(u.hostname)));
  } catch { return false; }
}
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
  const names = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  if (names[entity.toLowerCase()]) return names[entity.toLowerCase()];
  const n = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
});
export function readMeta(html) {
  const tags = new Map();
  for (const match of html.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs = {};
    for (const [, key, , val] of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)) attrs[key.toLowerCase()] = decode(val);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content) tags.set(key, [...(tags.get(key) || []), attrs.content]);
  }
  return tags;
}
export function metadataFromHtml(html, platform) {
  // Medal publishes a direct CDN URL in its public VideoObject metadata.
  // Its og:video endpoint is a redirect that Discord galleries may reject.
  if (platform === 'medal') {
    for (const [, raw] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const item = JSON.parse(raw);
        if (item['@type'] === 'VideoObject' && item.isFamilyFriendly !== false && validMedia(item.contentUrl, platform)
          && new URL(item.contentUrl).hostname === 'cdn.medal.tv' && new URL(item.contentUrl).pathname.endsWith('.mp4')) {
          return {name: typeof item.author?.name === 'string' ? item.author.name : '', title: typeof item.name === 'string' ? item.name : '', caption:'', media:[item.contentUrl]};
        }
      } catch { /* malformed public metadata is not usable */ }
    }
  }
  const tags = readMeta(html), get = name => tags.get(name)?.[0] || '';
  if (platform === 'facebook') {
    if (/temporarily blocked|log in to continue|login required/i.test(html)) return null;
    // Public Open Graph thumbnails only, not private media or playable videos.
    return {media:(tags.get('og:image') || []).filter(url => validMedia(url, platform)).slice(0,1)};
  }
  const type = get('og:video:type') || get('twitter:player:stream:content_type');
  const videos = type === 'video/mp4' ? [...(tags.get('og:video') || []), ...(tags.get('og:video:secure_url') || []), ...(tags.get('twitter:player:stream') || [])] : [];
  const validVideos = videos.filter(url => validMedia(url, platform));
  const media = validVideos.length ? [validVideos[0]] : [...new Set((tags.get('og:image') || []).filter(url => validMedia(url, platform)))].slice(0, 10);
  let videoPage = '';
  let name = '', username = '', caption = get('og:description') || '';
  let title = get('og:title');
  let cardTitle = ['medal','imgur','streamable','reddit','linkedin'].includes(platform) ? title.replace(/ - Clipped .* with Medal\.tv$| \| Streamable$/g, '') : '';
  if (['medal','imgur','streamable'].includes(platform)) caption = '';
  if (caption.trim() === cardTitle.trim()) caption = '';
  if (platform === 'reddit') {
    const author = /^u\/([A-Za-z0-9_-]{1,30}) on r\/[A-Za-z0-9_]+(?: |$)/.exec(get('og:site_name'));
    if (author) username = author[1];
    if (!media.length && /^https:\/\/v\.redd\.it\/[a-z0-9]+\/?$/i.test(caption.trim())) { videoPage = caption.trim(); caption = ''; }
  } else if (platform === 'tiktok') {
    const author = /^(.*?)\s*\(@([^)]*)\)$/.exec(title);
    if (author) [, name, username] = author;
  } else if (platform === 'twitch') {
    const split = title.indexOf(' - ');
    if (split >= 0) { name = title.slice(0, split); cardTitle = title.slice(split + 3); caption = ''; }
  }
  if (cardTitle === 'vxReddit') cardTitle = '';
  return { name, username, title:cardTitle, caption, media, videoPage };
}
export function metadataFromFx(data, platform) {
  const post = data.status || data.tweet;
  if (data.code !== 200 || !post || post.type === 'tombstone' || post.author?.protected) return null;
  const entries = post.media?.all || [...(post.media?.photos || []), ...(post.media?.videos || [])];
  const media = entries.map(item => item.url).filter(url => validMedia(url, platform)).slice(0, 10);
  const q = post.quote;
  const quotedUrl = typeof q?.url === 'string' ? parseSocialUrl(q.url) : null;
  const quote = platform === 'twitter' && q && !q.author?.protected && quotedUrl?.platform === 'twitter' ? {name:q.author?.name || '',username:q.author?.screen_name || '',text:typeof q.text === 'string' ? q.text : '',url:quotedUrl.url} : null;
  return { name: post.author?.name || '', username: post.author?.screen_name || '', caption: post.text || '', media, quote };
}
async function readBounded(url, fetcher) {
  let response;
  try {
    response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: {
      'User-Agent': 'Discordbot (Link Embedder public preview)', Accept: 'text/html, application/json' } });
    if (!response.ok || !/text\/html|application\/json/i.test(response.headers.get('content-type') || '')) return null;
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try {
      while (true) { const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 524288) return null; chunks.push(value); }
    } finally { await reader.cancel().catch(() => {}); }
    return Buffer.concat(chunks).toString('utf8');
  } catch { return null; }
  finally { if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {}); }
}
export function simpleCard(link, metadata = null) {
  const brand = brands[link.platform];
  if (link.platform === 'facebook' && link.kind === 'reel') return {type:17,accent_color:brand.color,components:[{type:10,content:'Facebook reel preview unavailable. Open the link above to watch.'}]};
  const name = typeof metadata?.name === 'string' ? plain(metadata.name).slice(0, 160) : '';
  const user = typeof metadata?.username === 'string' ? plain(metadata.username.replace(/^@/, '')).slice(0, 120) : '';
  const media = (metadata?.media || []).filter(url => validMedia(url, link.platform)).slice(0, 10);
  let title = typeof metadata?.title === 'string' ? metadata.title.trim() : '';
  const community = link.platform === 'reddit' ? /^\/r\/([A-Za-z0-9_]{1,30})\//.exec(new URL(link.url).pathname)?.[1] : '';
  if (community) title = title.replace(new RegExp(`^r/${community}:\\s*`, 'i'), '');
  const authorLine = community ? `**r/${plain(community)}**${user ? ` u/${user}` : ''}`
    : `${name ? `**${name}**` : ''}${user ? `${name ? ' ' : ''}@\u200b${user}` : ''}`;
  const titleLine = title ? plain([...title].slice(0,256).join('')) : '';
  const caption = typeof metadata?.caption === 'string' ? (link.platform === 'twitter' ? plain(metadata.caption) : shortCaption(metadata.caption)) : '';
  const text = content => ({type: 10, content});
  const quote = metadata?.quote;
  const quotedUrl = typeof quote?.url === 'string' ? parseSocialUrl(quote.url) : null;
  const quoteText = link.platform === 'twitter' && quotedUrl?.platform === 'twitter'
    ? `> **${plain(quote.name || 'Quoted post')}**${quote.username ? ` @\u200b${plain(quote.username.replace(/^@/,''))}` : ''}\n> ${shortCaption(quote.text || '').replace(/\n/g,'\n> ')}` : '';
  return { type: 17, accent_color: brand.color, components: [
    ...(cardHeading(link, title) ? [text(cardHeading(link, title))] : titleLine ? [text(`**${titleLine}**`)] : []),
    ...(authorLine ? [text(authorLine)] : []),
    ...(media.length ? [{type:12,items:media.map(url => ({media:{url}}))}] : []),
    ...(caption && caption !== shortCaption(metadata?.title || '') ? [text(caption)] : []),
    ...(!media.length && !caption ? [text(link.platform === 'reddit' && /^https:\/\/v\.redd\.it\/[a-z0-9]+\/?$/i.test(metadata?.videoPage || '') ? `[View video on Reddit ↗](<${metadata.videoPage}>)` : 'Media preview unavailable.')] : []),
    ...(quoteText ? [text(quoteText)] : []),
    text(footer(link.platform))
  ] };
}
export async function simplePayload(content, modes, existingEmbeds = [], fetcher = fetch) {
  const links = extractLinks(content).filter(link => modes[link.platform] && modes[link.platform] !== 'off');
  // Native video players (especially YouTube) cannot be copied into a custom card.
  // Keep native messages intact instead of replacing a playable iframe with a still image.
  if (!links.length || links.some(link => modes[link.platform] === 'native' || (link.platform === 'facebook' && link.kind !== 'reel'))) return null;
  const components = await Promise.all(links.map(async link => {
    if (link.platform === 'instagram' && modes.instagram === 'oginstagram') {
      const payload = await instagramPayload(link.url, modes, fetcher);
      if (payload) return payload.components[0];
    }
    let metadata = null;
    if (modes[link.platform] === helperModes[link.platform] && link.platform !== 'instagram') {
      const original = new URL(link.url);
      let url = helperUrl(link, modes[link.platform]);
      if (link.platform === 'twitter') url = `https://api.fxtwitter.com/2/status/${original.pathname.split('/').pop()}`;
      if (link.platform === 'bluesky') { const p = original.pathname.split('/'); url = `https://api.fxbsky.app/2/status/${encodeURIComponent(p[2])}/${p[4]}`; }
      const body = await readBounded(url, fetcher);
      if (body) {
        try { metadata = ['twitter','bluesky'].includes(link.platform) ? metadataFromFx(JSON.parse(body), link.platform) : metadataFromHtml(body, link.platform); } catch { /* leave original link available */ }
      }
    }
    if (['medal','streamable','imgur','linkedin'].includes(link.platform) || (link.platform === 'facebook' && link.kind === 'photo')) {
      if (link.platform === 'imgur' && new URL(link.url).hostname === 'i.imgur.com') metadata = {media:[link.url]};
      else {
        const body = await readBounded(link.url, fetcher);
        if (body) metadata = metadataFromHtml(body, link.platform);
      }
    }
    if (!metadata) {
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      if (embed) metadata = { name: embed.author?.name || '', title: embed.title || '', caption: embed.description || '', media: [] };
    }
    return simpleCard(link, metadata);
  }));
  const all = [{type:10,content:content.slice(0,2000)},...components];
  const textSize = nodes => nodes.reduce((n,c)=>n+(c.type===10 ? c.content.length : 0)+(c.components ? textSize(c.components):0),0);
  // Never silently truncate long Twitter text; preserve the original/helper route instead.
  if (textSize(all)>4000) return null;
  return { flags:32768, components:all, allowedMentions:{parse:[],repliedUser:false} };
}
