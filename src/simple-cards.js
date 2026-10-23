import { facebookReelVideo, facebookReelAttachment, facebookReelAuthor } from './providers/facebook.js';
import {fetchUpscrolled,upscrolledImage} from './providers/upscrolled.js';
import { snapchatAttachment, savedStoryMetadata, publicStorySnapMetadata, savedStoryUrl, publicStorySnapUrl } from './providers/snapchat.js';
import { brands, footer } from './platform-brands.js';
import { extractLinks, parseSocialUrl } from './previews.js';
import { helperUrl } from './adapters.js';
import { helperModes } from './config.js';
import { resolveRedditVideo } from './short-links.js';
import { instagramPayload } from './providers/instagram.js';
import { shortCaption, shortQuote, sourceText, plain, cardHeading, cardSeparator } from './card-format.js';

const mediaHosts = {
  pinterest: ['i.pinimg.com'],
  snapchat: ['bolt-gcdn.sc-cdn.net'],
  twitter: ['pbs.twimg.com', 'video.twimg.com'],
  bluesky: ['cdn.bsky.app', 'video.bsky.app'],
  tiktok: ['offload.tnktok.com'],
  reddit: ['i.redd.it', 'v.redd.it', 'preview.redd.it', 'external-preview.redd.it', 'vxreddit.com', 'www.vxreddit.com'],
  facebook: [], amazon: ['m.media-amazon.com','images-na.ssl-images-amazon.com'], upscrolled: []
};
// FxBluesky's observed public video cache route; no arbitrary paths or redirects.
function blueskyCacheVideo(raw, u) {
  return /^https:\/\/pds-cache\.fxbsky\.app\//.test(raw) && u.hostname === 'pds-cache.fxbsky.app'
    && !u.search && /^\/did:plc:[a-z2-7]{24}\/b[a-z2-7]{20,200}$/.test(u.pathname);
}
export function pinterestAuthor(raw) {
  if(typeof raw !== 'string' || !/^https:\/\/(?:www\.)?pinterest\.com\//i.test(raw))return null;
  try {const u=new URL(raw),match=/^\/([A-Za-z0-9_]{3,30})\/?$/.exec(u.pathname);
    if(!match||u.username||u.password||u.port||u.search||u.hash||['pin','ideas','search','settings','login','signup'].includes(match[1].toLowerCase()))return null;
    return {username:match[1],profileUrl:`https://www.pinterest.com/${match[1]}/`};
  }catch{return null;}
}
export function validMedia(raw, platform) {
  try {
    const u = new URL(raw);
    return typeof raw === 'string' && raw.length <= 2048 && u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash
      && ((platform === 'facebook' && facebookReelVideo(raw)) || (platform === 'upscrolled' && upscrolledImage(raw)) || (platform === 'bluesky' && blueskyCacheVideo(raw, u)) || (mediaHosts[platform] || []).includes(u.hostname) || (platform === 'threads' && /^(?:scontent|video)-[a-z0-9-]+\.cdninstagram\.com$/.test(u.hostname)) || (['facebook','threads'].includes(platform) && /^scontent-[a-z0-9-]+\.xx\.fbcdn\.net$/.test(u.hostname)));
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
// TikTok's generic landing/login metadata is not evidence of a public post.
function tiktokShell(title = '', caption = '') {
  return /^(?:visit tiktok to discover videos!?|tiktok\s*[-–]\s*make your day|this account is private|video (?:currently )?unavailable|could not find video data|sensitive content)$/i.test(title.trim().replace(/^❌\s*/, ''))
    || /^(?:watch, follow, and discover more trending content\.?|this account is private|log in to (?:watch|view|continue))/i.test(caption.trim());
}
export function metadataFromHtml(html, platform, expectedUrl) {
  const tags = readMeta(html), get = name => tags.get(name)?.[0] || '';
  if (platform === 'snapchat') {
    const expected=parseSocialUrl(expectedUrl),actual=parseSocialUrl(get('og:url'));
    if(actual?.platform!=='snapchat'||actual.url.split('/').pop()!==expected?.url.split('/').pop())return null;
    const title=get('og:title'),author=/\|\s*([^|]+?)\s*\(@([A-Za-z0-9._-]{1,30})\)\s*\|/.exec(title);
    const video=get('og:video:secure_url')||get('og:video');
    if(get('og:video:type')!=='video/mp4'||!validMedia(video,'snapchat')||!new URL(video).pathname.startsWith('/u/'))return null;
    return {name:author?.[1]||'',username:author?.[2]||'',caption:get('og:description'),media:[video]};
  }
  if (platform === 'pinterest') {
    if (parseSocialUrl(get('og:url'))?.url !== expectedUrl || /log in|sign up|access denied/i.test(get('og:title'))) return null;
    return {title:get('og:title'),caption:get('og:description'),media:(tags.get('og:image') || []).filter(url=>validMedia(url,platform)).slice(0,1)};
  }
  if (platform === 'amazon' && !amazonProductTitle(get('og:title'))) return null;
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
    const expected=parseSocialUrl(expectedUrl);
    if(expected?.kind==='reel') {
      const actual=parseSocialUrl(get('og:url')),name=get('og:title').trim();
      const video=get('og:video:secure_url')||get('og:video');
      if(actual?.platform!=='facebook'||actual.url!==expected.url||!name
        ||/log in|sign up|unavailable|facebed/i.test(name)||get('og:video:type')!=='video/mp4'||!facebookReelVideo(video))return null;
      return {name,caption:get('og:description'),media:[video]};
    }
    if (/temporarily blocked|log in to continue|login required/i.test(html)) return null;
    // Public Open Graph thumbnails only, not private media or playable videos.
    return {media:(tags.get('og:image') || []).filter(url => validMedia(url, platform)).slice(0,1)};
  }
  if (platform === 'tiktok' && tiktokShell(get('og:title'), get('og:description'))) return null;
  const type = get('og:video:type') || get('twitter:player:stream:content_type');
  const videos = type === 'video/mp4' ? [...(tags.get('og:video') || []), ...(tags.get('og:video:secure_url') || []), ...(tags.get('twitter:player:stream') || [])] : [];
  const validVideos = videos.filter(url => validMedia(url, platform));
  let media = validVideos.length ? [validVideos[0]] : [...new Set((tags.get('og:image') || []).filter(url => validMedia(url, platform)))].slice(0, 10);
  let videoPage = '', destinationUrl = '';
  let name = '', username = '', community = '', caption = get('og:description') || '';
  let title = get('og:title');
  let cardTitle = ['reddit','amazon'].includes(platform) ? title : '';
  if (caption.trim() === cardTitle.trim()) caption = '';
  if (platform === 'reddit') {
    const author = /^u\/([A-Za-z0-9_-]{1,30}) on r\/[A-Za-z0-9_]+(?: |$)/.exec(get('og:site_name'));
    if (author) username = author[1];
    community = / on r\/([A-Za-z0-9_]{1,30})(?: |$)/.exec(get('og:site_name'))?.[1] || '';
    try {
      const u = new URL(caption.trim());
      if (/^https:\/\/[^\s<>]+$/.test(caption.trim()) && !u.username && !u.password && !u.port
        && !['v.redd.it','i.redd.it','preview.redd.it'].includes(u.hostname)
        && !/\.(?:gif|jpe?g|png|webp|mp4|webm)$/i.test(u.pathname) && !validVideos.length) {
        destinationUrl = u.href; caption = ''; media = [];
      }
    } catch { /* Ordinary prose remains a caption. */ }

    if (!validVideos.length && /^https:\/\/v\.redd\.it\/[a-z0-9]+\/?$/i.test(caption.trim())) { videoPage = caption.trim(); caption = ''; media = []; }
  } else if (platform === 'tiktok') {
    const author = /^(.*?)\s*\(@([^)]*)\)$/.exec(title);
    if (author) [, name, username] = author;

  }
  if (cardTitle === 'vxReddit') cardTitle = '';
  return { name, username, community, title:cardTitle, caption, media, videoPage, destinationUrl };
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
  let content = data.content.replace(/(?:<br\s*\/?>|\s|\u200a)*<b>\s*[♥❤]\ufe0f?[\d\s,.KMBkmb💬🔄✈️]*<\/b>\s*$/u, '');
  // fzthreads prepends this exact generated reply header before the body.
  // Match only its leading linked handle and blank line, never ordinary prose.
  const replyHeader = /^⤴️ 正在回覆 <a href="(https:\/\/www\.threads\.com\/@([A-Za-z0-9_.]{1,30}))">@([A-Za-z0-9_.]{1,30})<\/a><br>(?:\u200a)?<br>/.exec(content);
  if (replyHeader && replyHeader[2] === replyHeader[3]) content = content.slice(replyHeader[0].length);
  const quoteHtml = content.match(/<blockquote>([\s\S]*?)<\/blockquote>/i)?.[1];
  // Bind the helper's quote header to its exact Threads profile link and handle,
  // rather than its translated label (for example "Quote of" or "↪ 引用").
  const quoteMatch = quoteHtml?.match(/^\s*<b>[^<]*<a\s+href=["']([^"']+)["']\s*>@([A-Za-z0-9_.]{1,30})<\/a><\/b>([\s\S]*)$/i);
  let quote = null;
  if (quoteMatch) {
    try {
      const profile = new URL(quoteMatch[1]);
      if (profile.protocol === 'https:' && ['www.threads.com','threads.com','www.threads.net','threads.net'].includes(profile.hostname)
        && !profile.username && !profile.password && !profile.port && !profile.search && !profile.hash
        && profile.pathname === `/@${quoteMatch[2]}`) {
        const self = typeof data.account.username === 'string' && data.account.username.replace(/^@/,'').toLowerCase() === quoteMatch[2].toLowerCase();
        const name = self && typeof data.account.display_name === 'string' ? data.account.display_name.trim().slice(0,160) : '';
        quote = {name,username:quoteMatch[2],text:toText(quoteMatch[3]),threadsQuote:true};
      }
    } catch { /* Unverified quote markup stays ordinary body text. */ }
  }
  const caption = toText(quote ? content.replace(/<blockquote>[\s\S]*?<\/blockquote>/i, '') : content);
  const attachments = Array.isArray(data.media_attachments) ? data.media_attachments : [];
  const media = attachments.filter(item => ['image','video'].includes(item?.type)
    && validMedia(item.url, 'threads') && item.url !== data.account?.avatar && item.url !== data.account?.avatar_static
    && !/\/t\d+\.\d+-19\//.test(new URL(item.url).pathname)).map(item => item.url).slice(0,10);
  if (!caption && !media.length && !quote) return null;
  return {name:typeof data.account.display_name === 'string' ? data.account.display_name : '',
    username:typeof data.account.username === 'string' ? data.account.username : '',caption,media,quote};
}

// Only the approved helper's structured profile heading can supply a missing name.
export function threadsProfileName(html, username) {
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(username) || typeof html !== 'string' || Buffer.byteLength(html)>524288) return '';
  const json=/<script\b[^>]*\bid=["']discord:component-embed["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  try {
    const root=JSON.parse(json).component;
    const section=root?.components?.[0];
    const heading=section?.type===9 ? section.components?.[0] : section;
    if(root?.type!==17 || heading?.type!==10 || typeof heading.content!=='string' || heading.content.includes('🔒')) return '';
    const match=/^### \[([^\n]+)\]\((https:\/\/www\.threads\.com\/@[A-Za-z0-9_.]{1,30})\)\n([A-Za-z0-9_.]{1,30})(?:\n|$)/.exec(heading.content);
    if(!match || match[2].toLowerCase()!==`https://www.threads.com/@${username.toLowerCase()}` || match[3].toLowerCase()!==username.toLowerCase()) return '';
    const name=match[1].replace(/\\([\\`*_{}\[\]()<>#+\-.!|~])/g,'$1').trim();
    return name && [...name].length<=160 && !/[<>\r\n]/.test(name) ? name : '';
  } catch { return ''; }
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
async function readBounded(url, fetcher, amazonRecovery = false) {
  let response;
  try {
    const maxBytes = savedStoryUrl(url) || publicStorySnapUrl(url) ? 2 * 1024 * 1024 : 524288;
    const signal = AbortSignal.timeout(8000);
    const options = { redirect: amazonRecovery ? 'manual' : 'error', signal, headers: {
      'User-Agent': 'Discordbot (Link Embedder public preview)', Accept: 'text/html, application/json, application/activity+json' } };
    response = await fetcher(url, options);
    let recoveredUrl = '';
    if (amazonRecovery && response.status === 301) {
      const source = parseSocialUrl(url);
      const expected = source?.platform === 'amazon' ? `https://${new URL(url).hostname}/clp/${source.asin}` : '';
      if (!expected || response.headers.get('location') !== expected) return null;
      await response.body?.cancel().catch(() => {});
      recoveredUrl = expected;
      response = await fetcher(expected, {...options, redirect:'error'});
    }
    if (response.redirected || (response.url && response.url !== String(url) && !recoveredUrl)) return null;
    if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel().catch(()=>{}); return null; }
    if (!response.ok || !/text\/html|application\/(?:json|activity\+json)/i.test(response.headers.get('content-type') || '')) return null;
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try {
      while (true) { const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength; if (size > maxBytes) return null; chunks.push(value); }
    } finally { await reader.cancel().catch(() => {}); }
    const html = Buffer.concat(chunks).toString('utf8');
    if (amazonRecovery && /robot check|captcha|automated access|access denied/i.test(html)) return null;
    if (recoveredUrl) {
      const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || '';
      const identity = decode(canonical.match(/href=["']([^"']+)["']/i)?.[1] || '');
      const title = readMeta(html).get('og:title')?.[0];
      if (identity !== recoveredUrl || !amazonProductTitle(title)) return null;
    }
    return html;
  } catch { return null; }
  finally { if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {}); }
}
export function simpleCard(link, metadata = null) {
  const brand = brands[link.platform];
  const spaceUrl = link.platform === 'twitter' && link.kind === 'space' ? twitterSpaceUrl(link.url) : null;
  const textFirst = ['twitter','threads','bluesky','upscrolled'].includes(link.platform);
  const name = typeof metadata?.name === 'string' ? plain(metadata.name).slice(0, 160) : '';
  const user = typeof metadata?.username === 'string' ? plain(metadata.username.replace(/^@/, '')).slice(0, 120) : '';
  const media = (metadata?.media || []).filter(url => validMedia(url, link.platform)).slice(0, 10);
  let title = typeof metadata?.title === 'string' ? metadata.title.trim() : '';
  const community = link.platform === 'reddit' ? /^\/r\/([A-Za-z0-9_]{1,30})\//.exec(new URL(link.url).pathname)?.[1] || (/^[A-Za-z0-9_]{1,30}$/.test(metadata?.community || '') ? metadata.community : '') : '';
  if (community) title = title.replace(new RegExp(`^r/${community}:\\s*`, 'i'), '');
  const profile=link.platform==='pinterest'?pinterestAuthor(metadata?.profileUrl):null;
  const authorLine = profile ? `${name ? `**${name}** ` : ''}[@${profile.username}](<${profile.profileUrl}>)` : community ? `**r/${plain(community)}**${user ? ` u/${user}` : ''}`
    : `${name ? `**${name}**` : ''}${user ? `${name ? ' ' : ''}@\u200b${user}` : ''}`;
  const titleLine = title ? plain([...title].slice(0,256).join('')) : '';
  const caption = typeof metadata?.caption === 'string' ? (textFirst ? sourceText(metadata.caption) : shortCaption(metadata.caption)) : '';
  let destination = '';
  try { const u = new URL(metadata?.destinationUrl); if (link.platform === 'reddit' && u.protocol === 'https:' && !u.username && !u.password && !u.port && !/[<>\s]/.test(metadata.destinationUrl)) destination = u.href; } catch {}
  const text = content => ({type: 10, content});
  const quote = metadata?.quote;
  const quotedUrl = typeof quote?.url === 'string' ? parseSocialUrl(quote.url) : null;
  const quoteText = textFirst && (quotedUrl?.platform === link.platform || (link.platform === 'threads' && quote?.threadsQuote === true))
    ? `> **${plain(quote.name || 'Quoted post')}**${quote.username ? ` @\u200b${plain(quote.username.replace(/^@/,''))}` : ''}\n> ${shortQuote(quote.text || '').replace(/\n/g,'\n> ')}` : '';
  return { type: 17, accent_color: brand.color, components: [
    ...(cardHeading(link, title) ? [text(cardHeading(link, title))] : titleLine ? [text(`**${titleLine}**`)] : []),
    ...(authorLine ? [text(authorLine)] : [cardSeparator()]),
    ...(spaceUrl ? [text(`[Open Space ↗](<${spaceUrl}>)`)] : []),
    ...(textFirst && caption && caption !== shortCaption(metadata?.title || '') ? [text(caption)] : []),
    ...(media.length ? [{type:12,items:media.map(url => ({media:{url}}))}] : []),
    ...(!textFirst && caption && caption !== shortCaption(metadata?.title || '') ? [text(caption)] : []),
    ...(destination ? [text(`<${destination.replace(/[()]/g,c=>c==='('?'%28':'%29')}>`)] : []),
    ...(!spaceUrl && !media.length && !caption && !destination && !metadata?.nativeAvailable ? [text(link.platform === 'reddit' && /^https:\/\/v\.redd\.it\/[a-z0-9]+\/?$/i.test(metadata?.videoPage || '') ? `[View video on Reddit ↗](<${metadata.videoPage}>)` : link.platform === 'facebook' ? `${({reel:'Reel',photo:'Photo',post:'Story',story:'Story',video:'Video',group:'Group',listing:'Listing',event:'Event',album:'Album',profile:'Profile','profile or page':'Profile or page',collection:'Video collection',link:'Link'}[link.kind] || 'Media')} preview unavailable.` : 'Media preview unavailable.')] : []),
    ...(link.platform === 'twitter' ? [...new Set((metadata?.spaces || []).map(twitterSpaceUrl).filter(Boolean))].slice(0,3).map(url=>text(`**[Twitter Space](<${url}>)**`)) : []),
    ...(quoteText ? [text(quoteText)] : []),
    cardSeparator(true),
    text(footer(link.platform))
  ] };
}
export function amazonProductTitle(title) {
  return typeof title === 'string' && title.trim() && !/^amazon(?:\.[a-z.]+)?(?:\s*[-:|]\s*.*)?$/i.test(title.trim()) ? title : '';
}
export function mergeAmazonEmbeds(previous, incoming) {
  const result = [...previous];
  for (const item of incoming) {
    const link = parseSocialUrl(item.url || '');
    if (link?.platform !== 'amazon') { if (!result.includes(item)) result.push(item); continue; }
    const index = result.findIndex(e => parseSocialUrl(e.url || '')?.url === link.url);
    const old = index < 0 ? {} : result[index];
    const media = [...(amazonProductTitle(item.title) ? [item.image,item.thumbnail] : []),
      ...(amazonProductTitle(old.title) ? [old.image,old.thumbnail] : [])].find(m => m?.url && validMedia(m.url,'amazon'));
    const merged = {...(old.toJSON?.() || old), ...(item.toJSON?.() || item),
      title: amazonProductTitle(item.title) || amazonProductTitle(old.title) || '',
      description: item.description || old.description || '', image: media, thumbnail: undefined};
    if (index < 0) result.push(merged); else result[index] = merged;
  }
  return result;
}
export function incompletePinterestEmbeds(links, embeds) {
  return links.filter(link => link.platform === 'pinterest').some(link => {
    const embed = embeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
    return !embed || /log in|sign up|access denied/i.test(embed.title || '')
      || ![embed.image?.url,embed.thumbnail?.url].some(url => url && validMedia(url,'pinterest'));
  });
}
export function incompleteAmazonEmbeds(links, embeds) {
  return links.filter(link => link.platform === 'amazon').some(link => {
    const embed = embeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
    return !amazonProductTitle(embed?.title) || !embed?.description
      || ![embed?.image?.url,embed?.thumbnail?.url].some(url => url && validMedia(url,'amazon'));
  });
}
export async function simplePayload(content, modes, existingEmbeds = [], fetcher = fetch) {
  const links = extractLinks(content).filter(link => modes[link.platform] && modes[link.platform] !== 'off');
  // Native video players cannot be copied into a custom card.
  // Keep native messages intact instead of replacing a playable iframe with a still image.
  if (!links.length || links.some(link => link.platform === 'facebook' && link.kind !== 'reel')) return null;
  const files = [];
  let attachmentSlots = 10;
  const mediaBudget = {remaining:8 * 1024 * 1024};
  const components = await Promise.all(links.map(async (link, linkIndex) => {
    // Resolution already ran with bounded, same-platform redirects. Preserve an
    // unresolved TikTok share as a usable link with an honest fallback card.
    if (link.platform === 'upscrolled') return simpleCard(link,await fetchUpscrolled(link.url,fetcher));
    if (link.platform === 'tiktok' && link.kind === 'share') return simpleCard(link);
    if (link.platform === 'snapchat' && ['saved story','story snap'].includes(link.kind)) {
      const body = await readBounded(link.url, fetcher);
      const metadata = body ? (link.kind === 'story snap' ? publicStorySnapMetadata(body,link.url) : savedStoryMetadata(body, link.url)) : null;
      if (!metadata) return simpleCard(link,{caption:'Story preview unavailable.'});
      const count = Math.min(metadata.entries.length, attachmentSlots);
      attachmentSlots -= count;
      const downloaded = await Promise.all(metadata.entries.slice(0,count).map(async (entry,index) => {
        const value = await snapchatAttachment(entry.url,fetcher,mediaBudget,`story-${entry.type}`);
        if (!value) return null;
        const name = `story-${linkIndex}-${index}.${entry.type==='video'?'mp4':value.ext}`;
        return {attachment:entry.type==='video'?value:value.data,name,contentType:entry.type==='video'?'video/mp4':value.mime};
      }));
      // Preserve sequence: no partial Story when an individual download fails.
      if (!count || downloaded.some(x=>!x)) return simpleCard(link,{...metadata,caption:'Story preview unavailable.'});
      files.push(...downloaded);
      const card = simpleCard(link,{...metadata,nativeAvailable:true});
      const footerIndex = card.components.findIndex(c=>c.type===14 && c.divider);
      card.components.splice(footerIndex<0?card.components.length:footerIndex,0,
        {type:12,items:downloaded.map(file=>({media:{url:`attachment://${file.name}`}}))},
        ...(metadata.total>count ? [{type:10,content:`Showing ${count} of ${metadata.total} Snaps. [View full Story](<${link.url}>)`}] : []));
      return card;
    }
    if (link.platform === 'pinterest') {
      const body = await readBounded(link.url, fetcher);
      const meta = body ? metadataFromHtml(body, 'pinterest', link.url) : null;
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      const safeEmbed = embed && !/log in|sign up|access denied/i.test(embed.title || '') ? embed : null;
      return simpleCard(link, {title:meta?.title || safeEmbed?.title || '', caption:meta?.caption || safeEmbed?.description || '', name:safeEmbed?.author?.name || '', ...(pinterestAuthor(safeEmbed?.author?.url)||{}), media:meta?.media?.length ? meta.media : [safeEmbed?.image?.url,safeEmbed?.thumbnail?.url].filter(u=>u && validMedia(u,'pinterest')).slice(0,1)});
    }
    if (link.platform === 'twitter' && ['space','list'].includes(link.kind)) {
      // Non-post Twitter resources do not use the approved status endpoint.
      // Reuse only Discord metadata matched to this exact resource.
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      return simpleCard(link, {
        title: typeof embed?.title === 'string' ? embed.title : '',
        name: typeof embed?.author?.name === 'string' ? embed.author.name : '',
        caption: link.kind === 'space'
          ? ''
          : 'List preview unavailable.'
      });
    }
    if (link.platform === 'instagram' && ['story','highlight'].includes(link.kind)) {
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
    if (link.platform === 'facebook' && link.kind === 'reel' && modes.facebook === 'facebed' && metadata?.media?.length) {
      const author=await facebookReelAuthor(link.url,fetcher);
      if(author)metadata={...metadata,...author};
    }
    if (link.platform === 'threads' && modes.threads === 'fzthreads' && metadata?.quote && !metadata.quote.name) {
      const username=metadata.quote.username;
      if (/^[A-Za-z0-9_.]{1,30}$/.test(username)) {
        const profile=await readBounded(`https://fzthreads.com/@${username}`,fetcher);
        if(profile) metadata.quote.name=threadsProfileName(profile,username);
      }
    }
    if (link.platform === 'reddit' && metadata?.videoPage && modes.reddit === 'vxreddit') {
      const source = await resolveRedditVideo(metadata.videoPage, fetcher);
      if (source) {
        const body = await readBounded(helperUrl({platform:'reddit',url:source}, 'vxreddit'), fetcher);
        const parent = body ? metadataFromHtml(body, 'reddit', source) : null;
        // Preserve the shared crosspost's title and attribution; borrow media only.
        if (parent?.media?.some(url => new URL(url).pathname.endsWith('.mp4'))) metadata = {...metadata,media:parent.media,videoPage:''};
      }
      // The approved helper also supports public Reddit video IDs directly.
      // Keep its exact endpoint; never accept a user-supplied media host.
      if (metadata.videoPage) {
        const id = /^https:\/\/v\.redd\.it\/([a-z0-9]{1,30})\/?$/i.exec(metadata.videoPage)?.[1];
        if (id) metadata = {...metadata, media:[`https://vxreddit.com/redditvideo.mp4?id=${id}`],videoPage:''};
      }
    }
    if ((link.platform === 'threads' && modes.threads !== 'fzthreads') || ['snapchat','amazon'].includes(link.platform) || (link.platform === 'facebook' && link.kind === 'photo')) {
      {
        const body = await readBounded(link.url, fetcher, link.platform === 'amazon');
        if (body) metadata = metadataFromHtml(body, link.platform, link.url);
      }
    }
    if (link.platform === 'amazon') {
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      if (embed) {
        metadata = {...metadata,
          title: amazonProductTitle(metadata?.title) || amazonProductTitle(embed.title) || '',
          name: metadata?.name || embed.author?.name || '',
          caption: metadata?.caption || embed.description || '',
          media: metadata?.media?.length ? metadata.media : (amazonProductTitle(embed.title) ? [embed.image?.url,embed.thumbnail?.url] : []).filter(u=>u && validMedia(u,'amazon')).slice(0,1)};
      }
    }
    if (!metadata || (!metadata.title && !metadata.name && !metadata.media?.length && !metadata.caption)) {
      const embed = existingEmbeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
      if (embed && link.platform !== 'amazon' && link.platform !== 'threads' && !(link.platform === 'tiktok' && tiktokShell(embed.title, embed.description))) metadata = { name: embed.author?.name || '', title: embed.title || '', caption: embed.description || '', media: link.platform === 'amazon' ? [embed.image?.url || embed.thumbnail?.url].filter(u=>u && validMedia(u,'amazon')) : [] };
    }
    // A companion is separate from the untouched source's native player/gallery.
    // Do not add a second thumbnail for sites already showing native media.
    if (link.platform !== 'amazon' && modes[link.platform] === 'native' && existingEmbeds.some(e => parseSocialUrl(e.url || '')?.url === link.url)) {
      if (!metadata) metadata = {};
      metadata = {...metadata,media:[],nativeAvailable:true};
    }
    if (['snapchat','facebook'].includes(link.platform) && metadata?.media?.length && (link.platform !== 'facebook' || link.kind === 'reel')) {
      if (attachmentSlots <= 0) return simpleCard(link,{...metadata,media:[]});
      attachmentSlots--;
      const source = metadata.media[0];
      const data = await (link.platform === 'facebook' ? facebookReelAttachment : snapchatAttachment)(source, fetcher, mediaBudget);
      if (!data) return simpleCard(link, {...metadata,media:[]});
      const name = `${link.platform === 'facebook' ? 'facebook-reel' : 'spotlight'}-${linkIndex}.mp4`;
      files.push({attachment:data,name,contentType:'video/mp4'});
      const card = simpleCard(link, metadata);
      for (const component of card.components || []) {
        if (component.type === 12) for (const item of component.items) {
          if (item.media.url === source) item.media.url = `attachment://${name}`;
        }
      }
      return card;
    }
    return simpleCard(link, metadata);
  }));
  const all = [{type:10,content:content.slice(0,2000)},...components];
  const textSize = nodes => nodes.reduce((n,c)=>n+(c.type===10 ? c.content.length : 0)+(c.components ? textSize(c.components):0),0);
  // Never silently truncate long Twitter text; preserve the original/helper route instead.
  if (textSize(all)>4000) return null;
  return { flags:32768, components:all, ...(files.length ? {files} : {}), allowedMentions:{parse:[],repliedUser:false} };
}
