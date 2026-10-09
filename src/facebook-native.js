import { extractLinks, parseSocialUrl } from './previews.js';
import { cardHeading, shortCaption } from './instagram-card.js';
import { footer } from './platform-brands.js';

export function facebookNativePayload(content, embeds) {
  const links = extractLinks(content);
  if (links.length !== 1 || links[0].platform !== 'facebook' || links[0].kind === 'reel') return null;
  const link = links[0];
  const embed = embeds.find(e => parseSocialUrl(e.url || '')?.url === link.url);
  if (!embed) return null;
  const raw = embed.image?.url || embed.thumbnail?.url;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || raw.length > 4096
      || !(u.hostname.endsWith('.fbcdn.net') || ['media.discordapp.net','images-ext-1.discordapp.net','images-ext-2.discordapp.net'].includes(u.hostname))) return null;
  } catch { return null; }
  return { flags: 32768, allowedMentions: {parse: [], repliedUser: false}, components: [
    {type:10,content}, {type:17,accent_color:0x1877f2,components:[
      {type:10,content:cardHeading(link, embed.title || '')},
      {type:12,items:[{media:{url:raw}}]},
      ...(embed.description ? [{type:10,content:shortCaption(embed.description)}] : []),
      {type:10,content:footer('facebook')}
    ]}
  ]};
}

// Discord may attach the native embed after MessageCreate. Never request Facebook directly.
export async function waitForFacebookPreview(message, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let current = message;
  for (const delay of [0, 1000, 2000, 3000]) {
    if (delay) {
      await pause(delay);
      try { current = await message.channel.messages.fetch({message:message.id,force:true,cache:false}); }
      catch { return null; }
      if (current.content !== message.content || current.editedTimestamp !== message.editedTimestamp || current.flags?.has(4)) return null;
    }
    const payload = facebookNativePayload(message.content, current.embeds || []);
    if (payload) return payload;
  }
  return null;
}
