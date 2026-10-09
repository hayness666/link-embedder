import { extractLinks, parseSocialUrl } from './previews.js';
import { helperUrl } from './adapters.js';
import { footer, brands } from './platform-brands.js';

const LIMIT = 262144;
const text = content => ({ type: 10, content });
export function shortCaption(value) {
  const normalized = value.replace(/#[\p{L}\p{N}_]+/gu, tag => {
    const small = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';
    return [...tag.normalize('NFKC')].map(c => {
      const i = small.indexOf(c);
      return i < 0 ? c : 'abcdefghijklmnopqrstuvwxyz'[i];
    }).join('');
  });
  const clean = normalized.replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]*\)/g, '$1').trim().replace(/\s+/gu, ' ');
  const chars = [...clean];
  return plain(chars.length > 250 ? chars.slice(0, 249).join('').trimEnd() + '…' : clean);
}
// Helper Markdown is untrusted display data. Keep labels, never provider buttons or links.
export function plain(value) {
  return value.replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/\\([\\*_~`|\[\]<>:#@.])/g, '$1')
    .replace(/[*_~`|\\]/g, c => '\\' + c)
    .replace(/@/g, '@\u200b').replace(/https?:\/\//g, '$&\u200b');
}

export function cardHeading(link, title = '') {
  const canonical = parseSocialUrl(link.url || '');
  if (!canonical || canonical.platform !== link.platform) return '';
  const kind = canonical.platform === 'amazon' ? 'Product' : canonical.platform === 'twitter' ? 'Tweet' : canonical.kind === 'reel' ? 'Reel'
    : canonical.kind === 'clip' ? 'Clip' : canonical.kind === 'video' ? 'Video' : 'Post';
  const brand = brands[link.platform]?.name || link.platform;
  const isShort = canonical.platform === 'youtube' && /\/shorts\//.test(link.url);
  const label = title || (canonical.platform === 'twitter' ? 'Tweet on Twitter' : isShort ? 'YouTube Short' : `${brand} ${kind}`);
  const safe = plain([...label].slice(0,256).join('').replace(/\s+/g,' ')).replace(/[\[\]]/g,c=>'\\'+c);
  return `**[${safe}](<${canonical.url.replace(/[()]/g,c=>encodeURIComponent(c).replace('(', '%28').replace(')', '%29'))}>)**`;
}

export function parseInstagramCard(html, link) {
  const json = /<script\b[^>]*\bid=["']discord:component-embed["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!json || json.length > LIMIT) return null;
  try {
    const root = JSON.parse(json).component;
    if (root?.type !== 17 || !Array.isArray(root.components)) return null;
    const children = root.components;
    const gallery = children.find(c => c.type === 12);
    if (!gallery?.items?.length || gallery.items.length > 10) return null;
    const code = new URL(link.url).pathname.split('/')[2];
    const items = gallery.items.map(item => {
      const raw = item?.media?.url;
      const u = new URL(raw);
      if (raw.length > 2048 || u.protocol !== 'https:' || u.hostname !== 'oginstagram.com'
        || u.port || u.username || u.password || u.hash
        || !new RegExp(`^/offload/${code}/[1-9][0-9]*$`).test(u.pathname)) throw new Error('Invalid media');
      return { media: { url: raw } };
    });
    const header = children[0]?.type === 9 ? children[0].components?.[0]?.content : children[0]?.content;
    const author = typeof header === 'string' ? plain(header.split('\n\n')[0].replace(/\*\*/g, '').replace(/\n+/g, ' ')).slice(0, 300) : '';
    const authorParts = author.split(/ (?=@\u200b)/);
    const authorLine = authorParts.length > 1 ? `**${authorParts[0]}** ${authorParts.slice(1).join(' ')}` : `**${author}**`;
    const caption = children.slice(1, children.indexOf(gallery)).find(c => c.type === 10)?.content;
    return { type: 17, accent_color: 0xe1306c, components: [
      text(cardHeading(link)),
      {type:14,divider:false,spacing:1},
      ...(author ? [text(authorLine)] : []),
      { type: 12, items },
      ...(typeof caption === 'string' && caption ? [text(shortCaption(caption).slice(0, 3000))] : []),
      {type:14,divider:true,spacing:1},
      text(footer('instagram'))
    ] };
  } catch { return null; }
}

// One bounded request to the explicitly approved helper; no cookies or redirect following.
// This only builds the initial message. No delayed checks or edits remove working previews.
export async function instagramPayload(content, modes, fetcher = fetch) {
  const links = extractLinks(content);
  if (modes.instagram !== 'oginstagram' || links.length !== 1 || links[0].platform !== 'instagram') return null;
  const link = links[0];
  const url = new URL(helperUrl(link, 'oginstagram'));
  url.searchParams.set('e', 'c');
  let response;
  try {
    response = await fetcher(url.href, { redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Discordbot (Link Embedder public preview)', Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) return null;
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const card = parseInstagramCard(Buffer.concat(chunks).toString('utf8'), link);
    if (!card) return null;
    return { flags: 32768, components: [card], allowedMentions: { parse: [], repliedUser: false } };
  } catch { return null; }
  finally { if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {}); }
}
