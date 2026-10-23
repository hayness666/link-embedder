import {upscrolledUrl} from './providers/upscrolled.js';
import { savedStoryUrl, publicStorySnapUrl } from './providers/snapchat.js';
// Exact hosts and narrowly scoped public-content route shapes; availability is not inferred.
export function parseAdditional(u) {
  const upscrolled = upscrolledUrl(u.href);
  if(upscrolled)return {platform:'upscrolled',kind:'public post',url:upscrolled.url};
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname.replace(/\/$/, '');
  const snap = publicStorySnapUrl(u.href);
  if (snap) return {platform:'snapchat',kind:'story snap',url:snap.url};
  const story = savedStoryUrl(u.href);
  if (story) return {platform:'snapchat',kind:'saved story',url:story.url};
  const result = (platform, kind, url = u.href) => ({ platform, kind, url });
  if (host === 'snapchat.com' && /^\/(?:@[A-Za-z0-9._-]{1,30}\/)?spotlight\/[A-Za-z0-9_-]{20,200}$/.test(path)) return result('snapchat','spotlight',`https://www.snapchat.com${path}`);
  if (host === 'pinterest.com' && /^\/pin\/\d{1,30}$/.test(path)) return result('pinterest', 'pin', `https://www.pinterest.com${path}/`);
  if (['threads.com', 'threads.net'].includes(host) && /^\/(?:@[A-Za-z0-9_.]{1,30}\/post|t)\/[A-Za-z0-9_-]{1,64}$/.test(path)) return result('threads', 'post', `https://www.threads.com${path}`);
  if (['twitter.com', 'x.com'].includes(host) && /^\/i\/lists\/[0-9]{1,30}$/.test(path)) return result('twitter', 'list', `https://twitter.com${path}`);
  if (['twitter.com', 'x.com'].includes(host) && /^\/i\/spaces\/[A-Za-z0-9]{13}$/.test(path)) return result('twitter', 'space', `https://twitter.com${path}`);
  if (['twitter.com', 'x.com'].includes(host) && /^\/[A-Za-z0-9_]{1,15}\/status\/\d{1,30}$/.test(path)) return result('twitter', 'post', `https://twitter.com${path}`);
  if (host === 'bsky.app' && /^\/profile\/[A-Za-z0-9.:-]{1,200}\/post\/[A-Za-z0-9]{1,50}$/.test(path)) return result('bluesky', 'post', `https://bsky.app${path}`);
  if (['reddit.com', 'old.reddit.com'].includes(host) && /^\/comments\/[A-Za-z0-9]{1,15}$/.test(path)) return result('reddit', 'post', `https://www.reddit.com${path}`);
  if (['reddit.com', 'old.reddit.com'].includes(host) && /^\/r\/[A-Za-z0-9_]{1,30}\/comments\/[A-Za-z0-9]{1,15}(?:\/[A-Za-z0-9_-]{1,250})?$/.test(path)) return result('reddit', 'post', `https://www.reddit.com${path}`);
  if (host === 'share.upscrolled.com' && /^\/en\/post\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(path)) return result('upscrolled', 'public post', `https://share.upscrolled.com${path}`);
  return null;
}

export function helperUrl(link, mode) {
  const u = new URL(link.url);
  if (mode === 'facebed') return link.platform === 'facebook' && link.kind === 'reel' && /^\/reel\/\d{1,30}\/?$/.test(u.pathname) ? `https://www.facebed.com${u.pathname}` : null;
  const hosts = { fzthreads: 'fzthreads.com', oginstagram: 'oginstagram.com', fxtiktok: 'tnktok.com', vxreddit: 'vxreddit.com' };
  if (mode === 'fxembed') u.hostname = link.platform === 'bluesky' ? 'fxbsky.app' : 'fxtwitter.com';
  else if (hosts[mode]) u.hostname = hosts[mode];
  else return null;
  return u.href;
}
