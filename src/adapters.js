// Exact hosts and narrowly scoped public-content route shapes; availability is not inferred.
export function parseAdditional(u) {
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname.replace(/\/$/, '');
  const result = (platform, kind, url = u.href) => ({ platform, kind, url });
  if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    let id = host === 'youtu.be' ? path.slice(1) : path === '/watch' ? u.searchParams.get('v') : /^\/shorts\/([\w-]{11})$/.exec(path)?.[1];
    if (!/^[\w-]{11}$/.test(id ?? '')) return null;
    const q = new URLSearchParams({ v: id });
    for (const k of ['t', 'start', 'list', 'index']) {
      const value = u.searchParams.get(k);
      if (value && /^[\w-]{1,100}$/.test(value)) q.set(k, value);
    }
    return result('youtube', 'video', `https://www.youtube.com/watch?${q}`);
  }
  if (['twitter.com', 'x.com'].includes(host) && /^\/[A-Za-z0-9_]{1,15}\/status\/\d{1,30}$/.test(path)) return result('twitter', 'post', `https://twitter.com${path}`);
  if (host === 'bsky.app' && /^\/profile\/[A-Za-z0-9.:-]{1,200}\/post\/[A-Za-z0-9]{1,50}$/.test(path)) return result('bluesky', 'post', `https://bsky.app${path}`);
  if (['reddit.com', 'old.reddit.com'].includes(host) && /^\/r\/[A-Za-z0-9_]{1,30}\/comments\/[A-Za-z0-9]{1,15}(?:\/[A-Za-z0-9_-]{1,250})?$/.test(path)) return result('reddit', 'post', `https://www.reddit.com${path}`);
  const clip = host === 'clips.twitch.tv' ? /^\/([A-Za-z0-9_-]{1,150})$/.exec(path)?.[1]
    : host === 'twitch.tv' ? /^\/[A-Za-z0-9_]+\/clip\/([A-Za-z0-9_-]{1,150})$/.exec(path)?.[1] : null;
  if (clip) return result('twitch', 'clip', `https://clips.twitch.tv/${clip}`);
  if (host === 'snapchat.com' && /^\/(?:spotlight\/[A-Za-z0-9_-]{1,150}|p\/[A-Za-z0-9_-]{1,100}\/\d{1,30}|add\/[A-Za-z0-9_.-]{1,50})$/.test(path)) return result('snapchat', 'public link');
  // Preserve share-access parameters, especially xsec_token. No short-link resolution.
  if (['xiaohongshu.com', 'rednote.com'].includes(host) && /^\/(?:explore|discovery\/item)\/[A-Za-z0-9]{1,100}$/.test(path)) return result('rednote', 'public note');
  if (host === 'linkedin.com' && (/^\/posts\/[A-Za-z0-9_-]{1,500}$/.test(path) || /^\/feed\/update\/urn:li:activity:\d{1,30}$/.test(path))) return result('linkedin', 'public post', `https://www.linkedin.com${path}`);
  if (host === 'share.upscrolled.com' && /^\/en\/post\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(path)) return result('upscrolled', 'public post', `https://share.upscrolled.com${path}`);
  if (['mastodon.social', 'mastodon.online'].includes(host) && /^\/@[A-Za-z0-9_]{1,100}\/\d{1,30}$/.test(path)) return result('mastodon', 'post (content warning unknown)', `https://${host}${path}`);
  return null;
}

export function helperUrl(link, mode) {
  const u = new URL(link.url);
  const hosts = { oginstagram: 'oginstagram.com', fxtiktok: 'tnktok.com', vxreddit: 'vxreddit.com', snapchatez: 'snapchatez.com' };
  if (mode === 'fxembed') u.hostname = link.platform === 'bluesky' ? 'fxbsky.app' : 'fxtwitter.com';
  else if (mode === 'fxtwitch') { u.hostname = 'fxtwitch.seria.moe'; u.pathname = `/clip${u.pathname}`; }
  else if (hosts[mode]) u.hostname = hosts[mode];
  else return null;
  return u.href;
}
