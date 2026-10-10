// Only canonical content routes. No HTTP fetch, redirect resolution, scraping or cookies.
import { brands } from './platform-brands.js';
import { cleanPublicUrl, isAmazonHost, parseAmazonProduct } from './urls.js';
import { parseAdditional, helperUrl } from './adapters.js';
const hosts = {
  'instagram.com': 'instagram', 'www.instagram.com': 'instagram',
  'tiktok.com': 'tiktok', 'www.tiktok.com': 'tiktok',
  'facebook.com': 'facebook', 'www.facebook.com': 'facebook', 'm.facebook.com': 'facebook', 'fb.watch': 'facebook', 'fb.me': 'facebook'
};
export function parseSocialUrl(raw) {
  const u = cleanPublicUrl(raw);
  if (!u) return null;
  if (isAmazonHost(u.hostname)) return parseAmazonProduct(u);
  const platform = hosts[u.hostname];
  if (!platform) return parseAdditional(u);
  let path = u.pathname.replace(/\/$/, '');
  if (['fb.watch','fb.me'].includes(u.hostname)) return /^\/[A-Za-z0-9_-]{1,100}$/.test(path) ? {platform,kind:'link',url:`https://${u.hostname}${path}`} : null;
  let kind;
  let query = '';
  if (platform === 'instagram' && /^\/(reel|p)\/[A-Za-z0-9_-]{1,100}$/.test(path)) {
    kind = path.startsWith('/reel/') ? 'reel' : 'photo or post';
    const index = u.searchParams.get('img_index');
    if (/^[1-9]\d{0,2}$/.test(index ?? '')) query = `?img_index=${index}`;
  } else if (platform === 'tiktok' && /^\/@[A-Za-z0-9_.]{1,30}\/(video|photo)\/\d{1,30}$/.test(path)) {
    kind = path.includes('/video/') ? 'video' : 'photo';
  } else if (platform === 'facebook' && /^\/reel\/\d{1,30}$/.test(path)) {
    kind = 'reel';
  } else if (platform === 'facebook' && ['/photo', '/photo.php'].includes(path) && /^\d{1,30}$/.test(u.searchParams.get('fbid') ?? '')) {
    kind = 'photo'; query = `?fbid=${u.searchParams.get('fbid')}`; path = '/photo.php';
  } else if (platform === 'facebook' && /^\/[A-Za-z0-9.]+\/photos\/(?:[A-Za-z0-9._-]+\/)?\d{1,30}$/.test(path)) {
    kind = 'photo';
  } else if (platform === 'facebook' && ['/story.php', '/permalink.php'].includes(path)
    && /^\d{1,30}$/.test(u.searchParams.get('id') ?? '')
    && /^(?:\d{1,30}|pfbid[A-Za-z0-9]{1,150})$/.test(u.searchParams.get('story_fbid') ?? '')) {
    kind = 'post';
    query = `?story_fbid=${u.searchParams.get('story_fbid')}&id=${u.searchParams.get('id')}`;
  } else if (platform === 'facebook') {
    const id = '[A-Za-z0-9._-]{1,180}';
    if (/^\/watch$/.test(path) && /^\d{1,30}$/.test(u.searchParams.get('v') || '')) { kind='video'; query=`?v=${u.searchParams.get('v')}`; }
    else if (new RegExp(`^/${id}/videos/(?:${id}/)?\\d{1,30}$`).test(path)) kind='video';
    else if (new RegExp(`^/groups/${id}/posts/${id}$`).test(path) || new RegExp(`^/${id}/posts/(?:${id}/)?${id}$`).test(path)) kind='post';
    else if (new RegExp(`^/groups/${id}$`).test(path)) kind='group';
    else if (/^\/marketplace\/item\/\d{1,30}$/.test(path)) kind='listing';
    else if (new RegExp(`^/events/(?:${id}/)?\\d{1,30}$`).test(path)) kind='event';
    else if (new RegExp(`^/watch/${id}/${id}$`).test(path)) kind='collection';
    else if (/^\/share\/(?:r\/|v\/|p\/)?[A-Za-z0-9_-]{1,100}$/.test(path)) kind='link';
    else if (path === '/profile.php' && /^\d{1,30}$/.test(u.searchParams.get('id') || '')) {kind='profile'; query=`?id=${u.searchParams.get('id')}`;}
    else if (path === '/media/set' && /^a\.\d{1,30}(?:\.\d{1,30})*$/.test(u.searchParams.get('set') || '')) {kind='album'; query=`?set=${u.searchParams.get('set')}`;}
    else if (new RegExp(`^/stories/${id}/${id}$`).test(path)) kind='story';
    else if (/^\/[A-Za-z0-9.]{1,100}$/.test(path) && !/^(?:login|logout|settings|privacy|help|checkpoint|recover|search|watch|share|reel|photo|photos|groups|events|marketplace|gaming|business|ads|dialog|plugins|sharer|sharer.php|login.php|story.php|permalink.php|photo.php|profile.php)$/i.test(path.slice(1))) kind='profile or page';
    else return null;
  } else return null;
  return { platform, kind, url: `https://www.${platform}.com${path}${query}` };
}

export function extractLinks(content) {
  // Honor explicit embed suppression, spoilers and code. Ignore masked links too.
  const visible = content.slice(0, 10000)
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/`[^`]*(?:`|$)/g, ' ')
    .replace(/\|\|[\s\S]*?(?:\|\||$)/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
  const links = new Map();
  for (const match of visible.matchAll(/https:\/\/[^\s<>]+/gi)) {
    const link = parseSocialUrl(match[0].replace(/[.,!?;:)\]}]+$/, ''));
    if (link) links.set(link.url, link);
    if (links.size === 3) break;
  }
  return [...links.values()];
}

export function buildPayload(content, modes, existingEmbeds = []) {
  const proxyModes = ['oginstagram', 'fxtiktok', 'fxembed', 'vxreddit', 'fxtwitch', 'snapchatez', 'fzthreads'];
  const links = extractLinks(content).filter(link => ['card', 'native', ...proxyModes].includes(modes[link.platform]))
    .filter(link => !(modes[link.platform] === 'native' && existingEmbeds.some(embed => parseSocialUrl(embed.url ?? '')?.url === link.url)));
  if (!links.length) return null;
  const native = links.filter(link => modes[link.platform] === 'native');
  const cards = links.filter(link => modes[link.platform] === 'card');
  const helpers = links.filter(link => proxyModes.includes(modes[link.platform]));
  const contentLines = [];
  const addLine = line => { if ([...contentLines, line].join('\n').length <= 1900) contentLines.push(line); };
  for (const link of native) addLine(link.url);
  for (const link of helpers) {
    const helper = helperUrl(link, modes[link.platform]);
    addLine(`${helper}\nOriginal: <${link.url}>`);
  }
  if (!contentLines.length && !cards.length) return null;
  return {
    ...(contentLines.length ? { content: contentLines.join('\n') } : {}),
    embeds: cards.map(link => ({
      title: link.platform === 'instagram' ? 'Instagram' : link.platform === 'amazon' ? `Amazon product · ${link.asin}` : `${brands[link.platform]?.name || link.platform} · ${link.kind}`,
      url: link.url,
      description: link.platform === 'amazon'
        ? `Clean product link: ${link.url}\nProduct details, image, price and availability have not been fetched.`
        : 'Open the original post. Media preview and public availability have not been verified.',
      color: link.platform === 'instagram' ? 0xf359a3 : 0x5865f2,
      footer: { text: link.platform === 'instagram' ? 'via @Link Embedder' : 'Link Embedder · link card · no media fetched' }
    })),
    allowedMentions: { parse: [], repliedUser: false }
  };
}
