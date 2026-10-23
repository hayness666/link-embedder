// Representative site brand colors; Discord places the accent on the left.
export const brands = {
  snapchat: {emoji:'snapchat:1558173235592429760',name:'Snapchat',color:0xfffc00},
  pinterest: {name:'Pinterest', color:0xe60023},
  threads: {emoji:'threadslogo:1562675521857519626', name:'Threads', color:0x181818},
  instagram: { name: 'Instagram', color: 0xe1306c, emoji: 'instagramlogo:1558170063251574895' },
  tiktok: { emoji: 'tiktok:1558173224842567840', name: 'TikTok', color: 0x25f4ee },
  facebook: { emoji: 'facebook:1558173225760854106', name: 'Facebook', color: 0x0866ff },
  amazon: { emoji: 'amazon:1558173227283644426', name: 'Amazon', color: 0xff9900 },
  twitter: { emoji: 'twitter_bird:1558274395829436428', name: 'Twitter', color: 0x1d9bf0 },
  bluesky: { emoji: 'bluesky:1558173230450344017', name: 'Bluesky', color: 0x0085ff },
  reddit: { emoji: 'reddit:1558173232379727942', name: 'Reddit', color: 0xff4500 },
  upscrolled: { emoji: 'upscrolled:1558173239589478440', name: 'UpScrolled', color: 0xed0874 },
};

export function footer(platform) {
  const brand = brands[platform];
  return `${brand.emoji ? `<:${brand.emoji}>\u00a0\u00a0` : ''}**${brand.name}** via [Link Embedder](<https://discord.com/users/1557858203897823304>)`;
}
