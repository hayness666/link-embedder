import { parseSocialUrl } from './previews.js';
const helperHosts = { 'oginstagram.com':'www.instagram.com', 'tnktok.com':'www.tiktok.com', 'fxtwitter.com':'twitter.com', 'fxbsky.app':'bsky.app', 'vxreddit.com':'www.reddit.com', 'snapchatez.com':'www.snapchat.com' };
function originalUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (u.hostname === 'fxtwitch.seria.moe' && u.pathname.startsWith('/clip/')) {
      u.hostname = 'clips.twitch.tv'; u.pathname = u.pathname.slice(5);
    } else if (helperHosts[u.hostname]) u.hostname = helperHosts[u.hostname];
    else return null;
    return parseSocialUrl(u.href)?.url || null;
  } catch { return null; }
}
export function fallbackPayload(payload, embeds = []) {
  // Discord can split a helper video into embeds with absent or rewritten source URLs.
  // Preserve any working media rather than erase a successful preview on an uncertain match.
  if (embeds.some(embed => embed.image?.url || embed.video?.url)) return null;
  const replacements = new Map();
  for (const match of (payload.content || '').matchAll(/https:\/\/[^\s<>]+/gi)) {
    const raw = match[0].replace(/[.,!?;:)\]}]+$/, '');
    const original = originalUrl(raw);
    if (!original) continue;
    const hasMedia = embeds.some(embed => {
      const source = originalUrl(embed.url) || parseSocialUrl(embed.url)?.url;
      return source === original && Boolean(embed.image?.url || embed.video?.url);
    });
    if (!hasMedia) replacements.set(raw, original);
  }
  if (!replacements.size) return null;
  let content = payload.content.replace(/https:\/\/[^\s<>]+/gi, token => {
    const raw = token.replace(/[.,!?;:)\]}]+$/, '');
    return (replacements.get(raw) || raw) + token.slice(raw.length);
  });
  content = content.split('\n').filter(line => {
    const original = /^Original: <(https:\/\/[^>]+)>$/.exec(line)?.[1];
    return !original || ![...replacements.values()].includes(original);
  }).join('\n');
  return { content, embeds: payload.embeds || [], allowedMentions: { parse: [], repliedUser: false } };
}
export async function checkFallback(payload, fetchMessage, editMessage, log = () => {}) {
  try {
    const fresh = await fetchMessage();
    // Do not overwrite a moderator's edits or recreate a removed message.
    if (!fresh || fresh.content !== payload.content) return;
    const fallback = fallbackPayload(payload, fresh.embeds);
    if (fallback) await editMessage(fallback);
  } catch { log('native_preview_fallback_unavailable'); }
}
let pending = 0;
export function scheduleFallback(payload, fetchMessage, editMessage, log) {
  if (!fallbackPayload(payload) || pending >= 1000) return;
  pending++;
  const timer = setTimeout(() => {
    void checkFallback(payload, fetchMessage, editMessage, log).finally(() => pending--);
  }, 20000);
  timer.unref?.();
}
