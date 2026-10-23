// Same-channel reply attribution; only a short escaped public-channel excerpt is rendered.
// Ownership persistence stores reference IDs, never the excerpt or complete target body.
const snowflake = value => typeof value === 'string' && /^\d{17,20}$/.test(value);
export const REPLY_EXCERPT_LIMIT = 100;
// Explicit provenance marker for the sender-text TextDisplay, never provider content.
export const USER_TEXT_COMPONENT_ID = 173000001;
function accompanyingText(value) {
  const text=value.replace(/\[[^\]\r\n]*\]\(https?:\/\/[^\s)]+\)/gi,'')
    .replace(/<https?:\/\/[^>\s]+>/gi,'').replace(/https?:\/\/[^\s<>]+/gi,'').trim();
  return /[\p{L}\p{N}\p{S}]/u.test(text)?text:'';
}
function hasHiddenMedia(nodes) {
  return nodes.some(node=>node.spoiler===true || node.items?.some(item=>item.spoiler===true)
    || node.components&&hasHiddenMedia(node.components));
}
export function trackedTargetText(target,row) {
  const nodes=(target.components || []).map(c=>c.toJSON?.() ?? c);
  if(row.sourceComponentId!==USER_TEXT_COMPONENT_ID || !target.flags?.has?.(32768) || hasHiddenMedia(nodes))return '';
  const note=preservedReplyNote(target,row),index=note&&nodes[0]?.content===note.content?1:0;
  const source=nodes[index];let matches=0;
  const visit=items=>{for(const node of items){if(node.id===USER_TEXT_COMPONENT_ID)matches++;if(node.components)visit(node.components);if(node.accessory)visit([node.accessory]);}};visit(nodes);
  if(matches!==1||source?.id!==USER_TEXT_COMPONENT_ID||source.type!==10||typeof source.content!=='string'||source.content.length>2000)return '';
  // Source markup containing spoilers must never be exposed by removing its URL first.
  if(source.content.includes('||'))return '';
  return accompanyingText(source.content);
}
export function replyExcerpt(target) {
  const raw=typeof target.content==='string'?target.content:'';
  // Never reveal spoiler text, including incomplete spoiler markup. Do not read embeds or attachments.
  if(raw.includes('||') || [...(target.attachments?.values?.() || [])].some(a=>a.spoiler||a.name?.startsWith('SPOILER_')))return 'Click to see message';
  // Normalize only an explicit Markdown escape on a word-internal underscore.
  // Do not decode arbitrary backslashes, link delimiters, or formatting escapes.
  const clean=raw.replace(/([\p{L}\p{N}])\\_(?=[\p{L}\p{N}])/gu,'$1_').replace(/<@!?\d+>/g,'@user').replace(/<@&\d+>/g,'@role').replace(/<#\d+>/g,'#channel')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,' ')
    .replace(/\s+/gu,' ').trim();
  if(!clean)return 'Click to see message';
  const chars=[...clean],visible=chars.slice(0,REPLY_EXCERPT_LIMIT).join('')+(chars.length>REPLY_EXCERPT_LIMIT?'…':'');
  return visible.replace(/[\\*_~`|\[\]()<>]/gu,(c,index)=>c==='_'&&/[\p{L}\p{N}]$/u.test(visible.slice(0,index))&&/^[\p{L}\p{N}]/u.test(visible.slice(index+1))?c:'\\'+c).replace(/@/g,'@\u200b').replace(/:/g,':\u200b');
}
export function replyReferenceId(message) {
  const r = message.reference;
  if (message.type !== 19 || !r || (r.type != null && r.type !== 0)
    || !snowflake(message.guildId) || !snowflake(message.channelId)
    || r.guildId !== message.guildId || r.channelId !== message.channelId
    || !snowflake(r.messageId) || r.messageId === message.id) return null;
  return r.messageId;
}
export async function resolveReplyContext(message, owners) {
  const id = replyReferenceId(message);
  if (!id) throw Error('Invalid reply reference');
  let timer;
  try {
    const target = await Promise.race([
      message.channel.messages.fetch({message:id,force:true,cache:false}),
      new Promise((_, reject) => { timer=setTimeout(()=>reject(Error('Reply lookup timeout')),5000); })
    ]);
    if (!target || target.id !== id || target.guildId !== message.guildId
      || target.channelId !== message.channelId || !snowflake(target.author?.id)
      || typeof target.author.username !== 'string' || !target.author.username.trim()
      || [...target.author.username].length > 80 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(target.author.username)) throw Error('Invalid reply target');
    let authorId=target.author.id,excerptTarget=target;
    const automated=Boolean(target.webhookId||target.author.bot),row=automated?owners?.get?.(id):null;
    if(row){
      if(!target.webhookId||row.webhookId!==target.webhookId||row.guildId!==message.guildId||row.channelId!==message.channelId||!snowflake(row.ownerId))throw Error('Invalid target ownership');
      authorId=row.ownerId;
      excerptTarget={content:trackedTargetText(target,row),attachments:target.attachments};
    }else if(automated){
      // Unknown bot/webhook content has no trusted human text or owner provenance.
      excerptTarget={content:''};
    }
    return {messageId:id,authorId,note:{type:10,content:`-# ↪︎ **<@${authorId}>**: [${replyExcerpt(excerptTarget)}](https://discord.com/channels/${message.guildId}/${message.channelId}/${id})`}};
  } finally { clearTimeout(timer); }
}
export function replyNoteComponents(note) { return [note]; }
export function preservedReplyNote(current, row) {
  if (!row?.replyMessageId) return null;
  if (![row.guildId,row.channelId,row.replyMessageId].every(snowflake)) throw Error('Invalid stored reply');
  const head=current.components?.[0]?.toJSON?.() ?? current.components?.[0];
  const contextFirst=head?.type===10 && (head.content?.startsWith('-# ↪︎ Replying to a [message](') || head.content?.startsWith('-# ↪︎ **<@'));
  const note=current.components?.[contextFirst?0:1]?.toJSON?.() ?? current.components?.[contextFirst?0:1];
  const url=`https://discord.com/channels/${row.guildId}/${row.channelId}/${row.replyMessageId}`;
  const prefix=`Replying to a [message](${url}) from `;
  const modern=typeof note?.content==='string' && note.content.startsWith(prefix)
    && /^<@\d{17,20}>:$/.test(note.content.slice(prefix.length));
  const styledPrefix='-# ↪︎ '+prefix;
  const styled=contextFirst && note.content.startsWith(styledPrefix)
    && /^<@\d{17,20}>$/.test(note.content.slice(styledPrefix.length));
  const excerptHeader=/^-# ↪︎ \*\*<@\d{17,20}>\*\*: \[/.exec(note?.content || '');
  const suffix=`](${url})`;
  const label=excerptHeader && note.content.endsWith(suffix)?note.content.slice(excerptHeader[0].length,-suffix.length):'';
  const checkedLabel=label.replace(/([\p{L}\p{N}])_(?=[\p{L}\p{N}])/gu,'$1x');
  const excerpt=contextFirst && Boolean(label) && /^(?:\\[\\*_~`|\[\]()<>]|[^\\*_~`|\[\]()<>\r\n])+$/u.test(checkedLabel)
    && !/@(?!\u200b)/u.test(label) && !/:(?!\u200b)/u.test(label);
  // Retain edit compatibility for cards created before the mention-based note.
  const legacy=typeof note?.content==='string' && note.content.startsWith('Replying to @')
    && note.content.endsWith(` · [View message](${url})`);
  if (note?.type!==10 || (!excerpt&&!styled&&!modern&&!legacy) || note.content.length>600 || /[\r\n]/.test(note.content)) throw Error('Reply attribution missing');
  if(contextFirst && current.components?.[1]?.type!==10 && current.components?.[1]?.toJSON?.().type!==10)throw Error('Reply source missing');
  return structuredClone(note);
}
export function checkReplyBudget(components) {
  let count=0,text=0;
  const visit=nodes=>{for(const c of nodes){count++;if(c.type===10){if(c.content.length>4000)throw Error('Text budget');text+=c.content.length;}if(c.components)visit(c.components);if(c.accessory)visit([c.accessory]);}};
  visit(components);
  if(count>40 || text>4000)throw Error('Reply card budget');
}
