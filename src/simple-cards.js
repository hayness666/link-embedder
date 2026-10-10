import { brands, footer } from './platform-brands.js';
import { extractLinks, parseSocialUrl } from './previews.js';
import { helperUrl } from './adapters.js';
import { helperModes } from './config.js';
import { instagramPayload, shortCaption, plain, cardHeading } from './instagram-card.js';

const mediaHosts = {
  primevideo: ['m.media-amazon.com','images-na.ssl-images-amazon.com'],
  netflix: [],
  medal: ['medal.tv', 'cdn.medal.tv'],
  streamable: ['api-f.streamable.com','cdn-cf-east.streamable.com','cdn-cf-west.streamable.com','cdn-cf.streamable.com'],
  imgur: ['i.imgur.com'],
  twitter: ['pbs.twimg.com', 'video.twimg.com'],
  bluesky: ['cdn.bsky.app', 'video.bsky.app'],
  tiktok: ['offload.tnktok.com'],
  reddit: ['i.redd.it', 'v.redd.it', 'preview.redd.it', 'external-preview.redd.it', 'vxreddit.com', 'www.vxreddit.com'],
  twitch: ['clips-media-assets2.twitch.tv', 'production.assets.clips.twitchcdn.net', 'clips-media-assets.twitch.tv'],
  snapchat: ['cf-st.sc-cdn.net'],
  youtube: ['i.ytimg.com','img.youtube.com'],
  vimeo: ['i.vimeocdn.com'], ifunny: ['img.ifunny.co'],
  giphy: ['media.giphy.com','i.giphy.com','media0.giphy.com','media1.giphy.com','media2.giphy.com','media3.giphy.com','media4.giphy.com'],
  tenor: ['media.tenor.com','c.tenor.com'],
  facebook: [], amazon: ['m.media-amazon.com','images-na.ssl-images-amazon.com'], rednote: [], linkedin: ['media.licdn.com'], upscrolled: [], mastodon: []
};
export function validMedia(raw, platform) {
  try {
    const u = new URL(raw);
    return typeof raw === 'string' && raw.length <= 2048 && u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash
      && ((mediaHosts[platform] || []).includes(u.hostname) || (platform === 'netflix' && /^occ-[a-z0-9-]+\.[0-9]+\.nflxso\.net$/.test(u.hostname)) || (platform === 'threads' && /^(?:scontent|video)-[a-z0-9-]+\.cdninstagram\.com$/.test(u.hostname)) || (['facebook','threads'].includes(platform) && /^scontent-[a-z0-9-]+\.xx\.fbcdn\.net$/.test(u.hostname)));
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
export function metadataFromHtml(html, platform, expectedUrl) {
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
  if (platform === 'primevideo') {
    const canonicalTag = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || '';
    const canonical = parseSocialUrl(decode(canonicalTag.match(/href=["']([^"']+)["']/i)?.[1] || ''));
    const expected = parseSocialUrl(expectedUrl || '');
    if (canonical?.platform !== 'primevideo' || canonical.kind !== 'title' || expected?.kind !== 'title'
      || new URL(canonical.url).pathname.split('/').pop() !== new URL(expected.url).pathname.split('/').pop()) return null;
    const title = decode(html.match(/<title>Prime Video:\s*([^<]+)<\/title>/i)?.[1] || '').trim();
    if (!title || /sign in|login|access denied/i.test(title)) return null;
    return {title, caption:get('description') || get('og:description'), media:(tags.get('og:image') || []).filter(url=>validMedia(url,platform)).slice(0,1)};
  }
  if (platform === 'threads') {
    // A profile image and generic shell are not post media. Require matching
    // public post identity and actual post text before accepting OG images.
    const canonical = parseSocialUrl(get('og:url'));
    if (!expectedUrl || canonical?.platform !== 'threads' || canonical.url !== expectedUrl
      || /log in to continue|login required|content isn't available/i.test(get('og:title') + ' ' + get('og:description'))) return null;
    const caption = get('og:description').trim();
    if (!caption || /^(?:join|log in to|sign up for|view on) threads/i.test(caption)) return null;
    const author = /^(.*?)\s*\(@([A-Za-z0-9_.]{1,30})\) on Threads$/.exec(get('og:title'));
    const video = get('og:video:type') === 'video/mp4'
      ? [get('og:video:secure_url'), get('og:video')].find(url => validMedia(url, platform)) : null;
    // t39.92108 assets are profile pictures, including the observed public shell.
    const images = [...new Set(tags.get('og:image') || [])].filter(url => validMedia(url, platform) && !url.includes('/t39.92108-'));
    return {name:author?.[1] || '', username:author?.[2] || '', caption, media:video ? [video] : images.slice(0,10)};
  }
  if (platform === 'facebook') {
    if (/temporarily blocked|log in to continue|login required/i.test(html)) return null;
    // Public Open Graph thumbnails only, not private media or playable videos.
    return {media:(tags.get('og:image') || []).filter(url => validMedia(url, platform)).slice(0,1)};
  }
  const type = get('og:video:type') || get('twitter:player:stream:content_type');
  const videos = type === 'video/mp4' ? [...(tags.get('og:video') || []), ...(tags.get('og:video:secure_url') || []), ...(tags.get('twitter:player:stream') || [])] : [];
  const validVideos = videos.filter(url => validMedia(url, platform));
  let media = validVideos.length ? [validVideos[0]] : [...new Set((tags.get('og:image') || []).filter(url => validMedia(url, platform)))].slice(0, 10);
  let videoPage = '', destinationUrl = '';
  let name = '', username = '', caption = get('og:description') || '';
  let title = get('og:title');
  let cardTitle = ['medal','imgur','streamable','reddit','linkedin','amazon','youtube','vimeo','ifunny','giphy','tenor'].includes(platform) ? title.replace(/ - Clipped .* with Medal\.tv$| \| Streamable$/g, '') : '';
  if (['medal','imgur','streamable'].includes(platform)) caption = '';
  if (caption.trim() === cardTitle.trim()) caption = '';
  if (platform === 'reddit') {
    const author = /^u\/([A-Za-z0-9_-]{1,30}) on r\/[A-Za-z0-9_]+(?: |$)/.exec(get('og:site_name'));
    if (author) username = author[1];
    try {
      const u = new URL(caption.trim());
      if (/^https:\/\/[^\s<>]+$/.test(caption.trim()) && !u.username && !u.password && !u.port
        && !['v.redd.it','i.redd.it','preview.redd.it'].includes(u.hostname)
        && !/\.(?:gif|jpe?g|png|webp|mp4|webm)$/i.test(u.pathname) && !validVideos.length) {
        destinationUrl = u.href; caption = ''; media = [];
      }
    } catch { /* Ordinary prose remains a caption. */ }

    if (!media.length && /^https:\/\/v\.redd\.it\/[a-z0-9]+\/?$/i.test(caption.trim())) { videoPage = caption.trim(); caption = ''; }
  } else if (platform === 'tiktok') {
    const author = /^(.*?)\s*\(@([^)]*)\)$/.exec(title);
    if (author) [, name, username] = author;
  } else if (platform === 'twitch') {
    const split = title.indexOf(' - ');
    if (split >= 0) { name = title.slice(0, split); cardTitle = title.slice(split + 3); caption = ''; }
  }
  if (cardTitle === 'vxReddit') cardTitle = '';
  return { name, username, title:cardTitle, caption, media, videoPage, destinationUrl };
}
// The approved helper's ActivityPub representation provides post identity and
// attachment types. Never accept login shells, protected or spoiler-marked posts.
export function metadataFromThreads(data, expectedUrl) {
  const expected = parseSocialUrl(expectedUrl || '');
  const actual = parseSocialUrl(typeof data?.url === 'string' ? data.url : '');
  if (expected?.platform !== 'threads' || actual?.platform !== 'threads'
    || new URL(expected.url).pathname.split('/').pop() !== new URL(actual.url).pathname.split('/').pop()
    || data.visibility !== 'public' || data.sensitive !== false || data.spoiler_text
    || data.account?.locked !== false || typeof data.content !== 'string') return null;
  const toText = value => decode(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')).replace(/[\u200a]/g, '').trim();
  // Only strip the helper's final stats block, never ordinary caption numbers.
  const content = data.content.replace(/(?:<br\s*\/?>|\s|\u200a)*<b>\s*[♥❤]\ufe0f?[\d\s,.KMBkmb💬🔄✈️]*<\/b>\s*$/u, '');
  const quoteHtml = content.match(/<blockquote>([\s\S]*?)<\/blockquote>/i)?.[1];
  const quoteMatch = quoteHtml?.match(/^<b>Quote of <a\b[^>]*>@([A-Za-z0-9_.]{1,30})<\/a><\/b>([\s\S]*)$/i);
  const quote = quoteMatch ? {name:'Quoted post',username:quoteMatch[1],text:toText(quoteMatch[2]),threadsQuote:true} : null;
  const caption = toText(content.replace(/<blockquote>[\s\S]*?<\/blockquote>/gi, ''));
  const attachments = Array.isArray(data.media_attachments) ? data.media_attachments : [];
  const media = attachments.filter(item => ['image','video'].includes(item?.type)
    && validMedia(item.url, 'threads') && item.url !== data.account?.avatar && item.url !== data.account?.avatar_static
    && !/\/t\d+\.\d+-19\//.test(new URL(item.url).pathname)).map(item => item.url).slice(0,10);
  if (!caption && !media.length && !quote) return null;
  return {name:typeof data.account.display_name === 'string' ? data.account.display_name : '',
    username:typeof data.account.username === 'string' ? data.account.username : '',caption,media,quote};
}

export function twitterSpaceUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !['x.com','twitter.com','www.x.com','www.twitter.com'].includes(u.hostname)
      || u.username || u.password || u.port || !/^\/i\/spaces\/[A-Za-z0-9]{13}\/?$/.test(u.pathname)) return null;
    return `https://twitter.com${u.pathname.replace(/\/$/,'')}`;
  } catch { return null; }
}

export function metadataFromFx(data, platform) {
  const post = data.status || data.tweet;
  if (data.code !== 200 || !post || post.type === 'tombstone' || post.author?.protected) return null;
  const entries = post.media?.all || [...(post.media?.photos || []), ...(post.media?.videos || [])];
  const media = entries.map(item => item.url).filter(url => validMedia(url, platform)).slice(0, 10);
  const q = post.quote;
  const quotedUrl = typeof q?.url === 'string' ? parseSocialUrl(q.url) : null;
  const quote = ['twitter','bluesky'].includes(platform) && q && !q.author?.protected && quotedUrl?.platform === platform ? {name:q.author?.name || '',username:q.author?.screen_name || '',text:typeof q.text === 'string' ? q.text : '',url:quotedUrl.url} : null;
  const spaceCandidates = platform === 'twitter' ? [
    ...(typeof post.text === 'string' ? post.text.match(/https:\/\/[^\s<>]+/g) || [] : []),
    ...(Array.isArray(post.raw_text?.facets) ? post.raw_text.facets.filter(f=>f.type==='url').map(f=>f.replacement) : [])
  ] : [];
  const spaces = [...new Set(spaceCandidates.map(twitterSpaceUrl).filter(Boolean))].slice(0,3);
  return { name: post.author?.name || '', username: post.author?.screen_name || '', caption: post.text || '', media, quote, spaces };
}
async function readBounded(url, fetcher) {
  let response;
  try {
    response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: {
      'User-Agent': 'Discordbot (Link Embedder public preview)', Accept: 'text/html, application/json, application/activity+json' } });
    if (!response.ok || !/text\/html|application\/(?:json|activity\+json)/i.test(response.headers.get('content-type') || '')) return null;
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
  const spaceUrl = link.platform === 'twitter' && link.kind === 'space' ? twitterSpaceUrl(link.url) : null;
  const textFirst = ['twitter','threads','bluesky','mastodon'].includes(link.platform);
  const name = typeof metadata?.name === 'string' ? plain(metadata.name).slice(0, 160) : '';
  const user = typeof metadata?.username === 'string' ? plain(metadata.username.replace(/^@/, '')).slice(0, 120) : '';
  const media = (metadata?.media || []).filter(url => validMedia(url, link.platform)).slice(0, 10);
  let title = typeof metadata?.title === 'string' ? metadata.title.trim() : '';
  const community = link.platform === 'reddit' ? /^\/r\/([A-Za-z0-9_]{1,30})\//.exec(new URL(link.url).pathname)?.[1] : '';
  if (community) title = title.replace(new RegExp(`^r/${community}:\\s*`, 'i'), '');
  const authorLine = community ? `**r/${plain(community)}**${user ? ` u/${user}` : ''}`
    : `${name ? `**${name}**` : ''}${user ? `${name ? ' ' : ''}@\u200b${user}` : ''}`;
  const titleLine = title ? plain([...title].slice(0,256).join('')) : '';
  const caption = typeof metadata?.caption === 'string' ? (textFirst ? plain(metadata.caption) : shortCaption(metadata.caption)) : '';
  let destination = '';
  try { const u = new URL(metadata?.destinationUrl); if (link.platform === 'reddit' && u.protocol === 'https:' && !u.username && !u.password && !u.port && !/[<>\s]/.test(metadata.destinationUrl)) destination = u.href; } catch {}
  const text = content => ({type: 10, content});
  const quote = metadata?.quote;
  const quotedUrl = typeof quote?.url === 'string' ? parseSocialUrl(quote.url) : null;
  const quoteText = textFirst && (quotedUrl?.platform === link.platform || (link.platform === 'threads' && quote?.threadsQuote === true))
    ? `> **${plain(quote.name || 'Quoted post')}**${quote.username ? ` @\u200b${plain(quote.username.replace(/^@/,''))}` : ''}\n> ${shortCaption(quote.text || '').replace(/\n/g,'\n> ')}` : '';
  return { type: 17, accent_color: brand.color, components: [
    ...(cardHeading(link, title) ? [text(cardHeading(link, title))] : titleLine ? [text(`**${titleLine}**`)] : []),
    {type:14,divider:false,spacing:1},
    ...(authorLine ? [text(authorLine)] : []),
    ...(spaceUrl ? [text(`[Open Space](<${spaceUrl}>)`)] : []),
    ...(textFirst && caption && caption !== shortCaption(metadata?.title || '') ? [text(caption)] : []),
    ...(media.length ? [{type:12,items:media.map(url => ({media:{url}}))}] : []),
    ...(!textFirst && caption && caption !== shortCaption(metadata?.title || '') ? [text(caption)] : []),
    ...(destination ? [text(`<${destination.replace(/[()]/g,c=>c==='('?'%28':'%29')}>`)] : []),
    ...(!spaceUrl && !media.length && !caption && !destination && !metadata?.nativeAvailable && !['youtube','vimeo'].includes(link.platform) ? [text(link.platform === 'reddit' && /^https:\/\/v\.redd\.it\/[a-z0-9]+\/?$/i.test(metadata?.videoPage || '') ? `[View video on Reddit ↗](<${metadata.videoPage}>)` : link.platform === 'facebook' ? `${({reel:'Reel',photo:'Photo',post:'Story',story:'Story',video:'Video',group:'Group',listing:'Listing',event:'Event',album:'Album',profile:'Profile','profile or page':'Profile or page',collection:'Video collection',link:'Link'}[link.kind] || 'Media')} preview unavailable.` : 'Media preview unavailable.')] : []),
    ...(link.platform === 'twitter' ? [...new Set((metadata?.spaces || []).map(twitterSpaceUrl).filter(Boolean))].slice(0,3).map(url=>text(`**[Twitter Space](<${url}>)**`)) : []),
    ...(quoteText ? [text(quoteText)] : []),
    {type:14,divider:true,spacing:1},
    text(footer(link.platform))
  ] };
}
export async function simplePayload(content, modes, existingEmbeds = [], fetcher = fetch) {
  const links = extractLinks(content).filter(link => modes[link.platform] && modes[link.platform] !== 'off');
  // Native video players (especially YouTube) cannot be copied into a custom card.
  // Keep native messages intact instead of replacing a playable iframe with a still image.
  if (!links.length || links.some(link => link.platform === 'facebook' && link.kind !== 'reel')) return null;
  const components = await Promise.all(links.map(async link => {
    if (['netflix','primevideo'].includes(link.platform)) {
      const service = brands[link.platform].name;
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      if (link.platform === 'primevideo' && link.kind === 'title' && !embed) {
        const body = await readBounded(link.url, fetcher);
        const metadata = body ? metadataFromHtml(body, link.platform, link.url) : null;
        if (metadata) return simpleCard(link, metadata);
      }
      return simpleCard(link,{title:typeof embed?.title === 'string' ? embed.title : (link.kind === 'storefront' ? 'Prime Video Storefront' : `View on ${service}`),caption:typeof embed?.description === 'string' ? embed.description : 'Media preview unavailable.',media:[embed?.image?.url || embed?.thumbnail?.url].filter(u=>u && validMedia(u,link.platform))});
    }
    if (link.platform === 'twitter' && ['space','list','community'].includes(link.kind)) {
      // Non-post Twitter resources do not use the approved status endpoint.
      // Reuse only Discord metadata matched to this exact resource.
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      return simpleCard(link, {
        title: typeof embed?.title === 'string' ? embed.title : '',
        name: typeof embed?.author?.name === 'string' ? embed.author.name : '',
        caption: link.kind === 'space'
          ? ''
          : `${link.kind === 'list' ? 'List' : 'Community'} preview unavailable.`
      });
    }
    if (link.platform === 'instagram' && ['story','highlight','profile'].includes(link.kind)) {
      return simpleCard(link,{caption:`${({story:'Story',highlight:'Highlight',profile:'Profile'}[link.kind])} preview unavailable.`});
    }
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
      if (link.platform === 'threads') url = `${url.replace(/\/$/,'')}/activity`;
      const body = await readBounded(url, fetcher);
      if (body) {
        try { metadata = link.platform === 'threads' ? metadataFromThreads(JSON.parse(body),link.url) : ['twitter','bluesky'].includes(link.platform) ? metadataFromFx(JSON.parse(body), link.platform) : metadataFromHtml(body, link.platform, link.url); } catch { /* leave original link available */ }
      }
    }
    if ((link.platform === 'threads' && modes.threads !== 'fzthreads') || ['medal','streamable','imgur','linkedin','amazon','ifunny','giphy','tenor'].includes(link.platform) || (link.platform === 'facebook' && link.kind === 'photo')) {
      if (link.platform === 'imgur' && new URL(link.url).hostname === 'i.imgur.com') metadata = {media:[link.url]};
      else {
        const body = await readBounded(link.url, fetcher);
        if (body) metadata = metadataFromHtml(body, link.platform, link.url);
      }
    }
    if (['youtube','vimeo'].includes(link.platform)) {
      const endpoint = link.platform === 'youtube' ? 'https://www.youtube.com/oembed' : 'https://vimeo.com/api/oembed.json';
      const body = await readBounded(`${endpoint}?url=${encodeURIComponent(link.url)}&format=json`, fetcher);
      if (body) try {
        const data = JSON.parse(body);
        if (typeof data.title === 'string') metadata = {title:data.title,name:typeof data.author_name === 'string' ? data.author_name : '',caption:'',media:[]};
        // Use only a real handle supplied by the provider; do not invent one from a name.
        if (metadata && typeof data.author_url === 'string') {
          const author = new URL(data.author_url);
          if (link.platform === 'youtube' && ['www.youtube.com','youtube.com'].includes(author.hostname) && /^\/@[A-Za-z0-9_.-]+$/.test(author.pathname)) metadata.username=author.pathname.slice(2);
        }
      } catch { /* Native player remains on the original message. */ }
    }
    if (!metadata || (!metadata.title && !metadata.name && !metadata.media?.length && !metadata.caption)) {
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      if (embed && link.platform !== 'threads') metadata = { name: embed.author?.name || '', title: embed.title || '', caption: embed.description || '', media: link.platform === 'amazon' ? [embed.image?.url || embed.thumbnail?.url].filter(u=>u && validMedia(u,'amazon')) : [] };
    }
    // A companion is separate from the untouched source's native player/gallery.
    // Do not add a second thumbnail for sites already showing native media.
    if (link.platform !== 'amazon' && modes[link.platform] === 'native' && existingEmbeds.some(e => parseSocialUrl(e.url || '')?.url === link.url)) {
      if (!metadata) metadata = {};
      metadata = {...metadata,media:[],nativeAvailable:true};
    }
    return simpleCard(link, metadata);
  }));
  const all = [{type:10,content:content.slice(0,2000)},...components];
  const textSize = nodes => nodes.reduce((n,c)=>n+(c.type===10 ? c.content.length : 0)+(c.components ? textSize(c.components):0),0);
  // Never silently truncate long Twitter text; preserve the original/helper route instead.
  if (textSize(all)>4000) return null;
  return { flags:32768, components:all, allowedMentions:{parse:[],repliedUser:false} };
}
