// Representative site brand colors; Discord places the accent on the left.
export const brands = {
  medal: {emoji:'medal:1558178735574745229', name:'Medal', color:0xffcc00},
  streamable: {emoji:'streamable:1558178736963190804', name:'Streamable', color:0x0f90fa},
  imgur: {emoji:'imgur:1558178738162893030', name:'Imgur', color:0x1bb76e},
  ifunny: {name:'iFunny', color:0xffd400},
  vimeo: {name:'Vimeo', color:0x1ab7ea},
  giphy: {name:'GIPHY', color:0x00ff99},
  tenor: {name:'Tenor', color:0x007add},
  instagram: { name: 'Instagram', color: 0xe1306c, emoji: 'instagramlogo:1558170063251574895' },
  tiktok: { emoji: 'tiktok:1558173224842567840', name: 'TikTok', color: 0x25f4ee },
  facebook: { emoji: 'facebook:1558173225760854106', name: 'Facebook', color: 0x0866ff },
  amazon: { emoji: 'amazon:1558173227283644426', name: 'Amazon', color: 0xff9900 },
  youtube: { emoji: 'youtube:1558173228353191976', name: 'YouTube', color: 0xff0000 },
  twitter: { emoji: 'twitter:1558173229275684885', name: 'Twitter', color: 0x1d9bf0 },
  bluesky: { emoji: 'bluesky:1558173230450344017', name: 'Bluesky', color: 0x0085ff },
  reddit: { emoji: 'reddit:1558173232379727942', name: 'Reddit', color: 0xff4500 },
  twitch: { emoji: 'twitch:1558173234514362368', name: 'Twitch', color: 0x9146ff },
  snapchat: { emoji: 'snapchat:1558173235592429760', name: 'Snapchat', color: 0xfffc00 },
  rednote: { emoji: 'rednote:1558173236980879381', name: 'RedNote', color: 0xff2442 },
  linkedin: { emoji: 'linkedin:1558173238213746788', name: 'LinkedIn', color: 0x0a66c2 },
  upscrolled: { emoji: 'upscrolled:1558173239589478440', name: 'UpScrolled', color: 0xed0874 },
  mastodon: { emoji: 'mastodon:1558173241434964130', name: 'Mastodon', color: 0x6364ff }
};

export function footer(platform) {
  const brand = brands[platform];
  return `${brand.emoji ? `<:${brand.emoji}>\u00a0\u00a0` : ''}**${brand.name}** via <@1557858203897823304>`;
}
