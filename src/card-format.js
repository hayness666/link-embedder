import {displayUrl} from './url-display.js';
import { parseSocialUrl } from './previews.js';
import { brands } from './platform-brands.js';

function normalizedCaption(value) {
  const normalized = value.replace(/#[\p{L}\p{N}_]+/gu, tag => {
    const small = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';
    return [...tag.normalize('NFKC')].map(c => {
      const i = small.indexOf(c);
      return i < 0 ? c : 'abcdefghijklmnopqrstuvwxyz'[i];
    }).join('');
  });
  const clean = normalized.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]*)\)/g, (_, label, url) => /^#[\p{L}\p{N}_]+$/u.test(label) ? label : url).trim().replace(/\s+/gu, ' ');
  return clean;
}
export const CAPTION_LIMIT = 300;
export const QUOTE_LIMIT = CAPTION_LIMIT;
function shortCardText(value) {
  return sourceText(normalizedCaption(value), CAPTION_LIMIT);
}
// Only source body text gets links; names, headings, and generated controls stay plain.
export function sourceText(value, limit = Infinity) {
  const clean = value.replace(/\[([^\]]*)\]\((https?:\/\/[^\s]+?)\)/gi, '$2').replace(/<[^>]*>/g, '');
  const chars = [...clean], clipped = chars.length > limit;
  const visible = clipped ? chars.slice(0, limit).join('') : clean;
  const escape = text => plain(text).replace(/[\[\]]/g, c => '\\' + c);
  let result = '', end = 0;
  for (const match of clean.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    const start = match.index;
    if (start >= visible.length) break;
    result += escape(visible.slice(end, start));
    let raw = match[0].replace(/[.,!;:?]+$/, '');
    while (/[)\]}]$/.test(raw)) {
      const close = raw.at(-1), open = {')':'(',']':'[','}':'{'}[close];
      if (raw.split(close).length <= raw.split(open).length) break;
      raw = raw.slice(0,-1);
    }
    const stop = start + raw.length;
    if (stop > visible.length) {
      result += escape(visible.slice(start)); end = visible.length; break;
    }
    let destination;
    try {
      const u = new URL(raw);
      if (!['http:','https:'].includes(u.protocol) || !u.hostname || u.username || u.password || /[\\\u0000-\u0020\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(raw)) throw new Error('unsafe');
      const recognized = parseSocialUrl(raw);
      if (recognized) destination = recognized.url;
      else {
        // Arbitrary external and signed URLs are not provider share links.
        const signed = [...u.searchParams.keys()].some(key => /^(signature|sig|token|x-amz-.+|x-goog-.+|policy|key-pair-id)$/i.test(key));
        if (!signed) for (const key of [...u.searchParams.keys()]) if (/^(utm_.*|fbclid|gclid|dclid|msclkid)$/i.test(key)) u.searchParams.delete(key);
        destination = u.href;
      }
      destination = destination.replace(/[()<>]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    } catch { destination = null; }
    result += destination ? displayUrl(destination) : escape(raw);
    end = stop;
  }
  return result + escape(visible.slice(end)) + (clipped ? '…' : '');
}
export function shortCaption(value) { return shortCardText(value); }
export function shortQuote(value) { return shortCardText(value); }
// Helper Markdown is untrusted display data. Keep labels, never provider buttons or links.
export function plain(value) {
  return value.replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/\\([\\*_~`|\[\]<>:#@.])/g, '$1')
    .replace(/[*_~`|\\]/g, c => '\\' + c)
    // Source punctuation must not become Discord lists, headings, or blockquotes.
    .replace(/^([ \t]*)([-+>]|#{1,6})(?=[ \t])/gm, (_, indent, marker) => indent + marker.replace(/./g, c => '\\' + c))
    .replace(/^([ \t]*\d{1,9})([.)])(?=[ \t])/gm, '$1\\$2')
    .replace(/@/g, '@\u200b').replace(/https?:\/\//g, '$&\u200b');
}

export function shortTitle(value) {
 const text=value.replace(/\s+/g,' ').trim();
 if([...text].length<=256)return text;
 const head=[...text].slice(0,255).join('');
 const cut=head.lastIndexOf(' ');
 return (cut>0 ? head.slice(0,cut) : head).trimEnd()+'…';
}

export function cardHeading(link, title = '') {
  const canonical = parseSocialUrl(link.url || '');
  if (!canonical || canonical.platform !== link.platform) return '';
  const kind = canonical.platform === 'pinterest' ? 'Pin' : canonical.platform === 'amazon' ? 'Product' : canonical.kind === 'reel' ? 'Reel'
    : canonical.kind === 'clip' ? 'Clip' : canonical.kind === 'video' ? 'Video' : 'Post';
  const brand = brands[link.platform]?.name || link.platform;
  const facebookKind = canonical.platform === 'facebook' ? ({photo:'Photo',post:'Post',story:'Story',profile:'Profile','profile or page':'Profile or Page',group:'Group',listing:'Marketplace Listing',event:'Event',collection:'Video Collection',album:'Album',link:'Link',video:'Video'}[canonical.kind]) : null;
  const instagramKind = canonical.platform === 'instagram' ? ({story:'Story',highlight:'Highlight',profile:'Profile'}[canonical.kind]) : null;
  const snapchatLabel = canonical.platform === 'snapchat' ? (canonical.kind === 'spotlight' ? 'Snapchat Spotlight' : 'Snapchat Story') : '';
  const label = title || snapchatLabel || (instagramKind ? `Instagram ${instagramKind}` : '') || (facebookKind ? `Facebook ${facebookKind}` : '') || (canonical.platform === 'twitter' ? (({space:'Twitter Space',list:'Twitter List',community:'Twitter Community'}[canonical.kind] || 'Twitter Post')) : canonical.platform === 'bluesky' ? 'Bluesky Post' : `${brand} ${kind}`);
  const safe = plain(shortTitle(label)).replace(/[\[\]]/g,c=>'\\'+c);
  return `**[${safe}](<${canonical.url.replace(/[()]/g,c=>encodeURIComponent(c).replace('(', '%28').replace(')', '%29'))}>)**`;
}


// Shared small spacing and footer rule for every card family.
export function cardSeparator(divider = false) {
  return {type: 14, divider, spacing: 1};
}

// One TextDisplay keeps title and author on consecutive lines inside the control Section.
export function cardHeaderComponents(heading, author = '') {
 const content=[heading,author].filter(Boolean).join('\n');
 return [...(content?[{type:10,content}]:[]),...(!author?[cardSeparator()]:[])];
}

// Callers validate media and supply escaped author/heading text.
export function imageCardComponents({heading,author='',items,caption='',captionBeforeMedia=false,footer}) {
 const text=content=>({type:10,content});
 const captionParts=typeof caption==='string'&&caption?[text(shortCaption(caption).slice(0,3000))]:[];
 return [...cardHeaderComponents(heading,author),
  ...(captionBeforeMedia?captionParts:[]),
  ...(items.length?[{type:12,items}]:[]),
  ...(!captionBeforeMedia?captionParts:[]),
  cardSeparator(true),text(footer)];
}
