import {displaySourceUrls,restoreSourceUrls} from './url-display.js';
import {refreshWebhookRoute,verifyThreadHook,threadOptions} from './thread-routing.js';
import {preservedReplyNote,checkReplyBudget,replyNoteComponents,USER_TEXT_COMPONENT_ID} from './reply-context.js';
import {withCardControls} from './card-controls.js';
import {createHash,randomBytes} from 'node:crypto';
import {extractLinks,buildPayload} from './previews.js';
import {helperUrl} from './adapters.js';
import {helperModes} from './config.js';
import {simplePayload} from './simple-cards.js';
import {expandShortLinks} from './short-links.js';
import {cleanCardLinks} from './repost.js';
const mentions={parse:[],repliedUser:false};
class MissingSupportedLinkError extends Error {}
const jsonComponents=m=>(m.components || []).map(c=>c.toJSON?.() ?? c);
export function editFingerprint(m) {
 return createHash('sha256').update(JSON.stringify([m.content || '',jsonComponents(m),m.editedTimestamp || null,[...(m.attachments?.values?.() || [])].map(a=>[a.id,a.name,a.description])])).digest('hex');
}
export function editableSource(m,row) {
 if (m.flags?.has?.(32768) || jsonComponents(m).some(c=>c.type===17)) {
  const nodes=jsonComponents(m),note=preservedReplyNote(m,row);const first=nodes[note&&nodes[0]?.content===note.content?1:0];if(first?.type!==10)throw Error('Unsupported source');return {text:row?.sourceComponentId===USER_TEXT_COMPONENT_ID?restoreSourceUrls(first.content):first.content,suffix:''};
 }
 const content=m.content || '';const split=content.lastIndexOf('\n\n');
 if(split>=0){
  const text=content.slice(0,split),tail=content.slice(split+2).split('\n');
  const helpers=new Set(extractLinks(text).map(l=>helperUrl(l,helperModes[l.platform])).filter(Boolean));
  if(tail.length && tail.every(line=>helpers.has(line)))return {text,suffix:content.slice(split)};
 }
 return {text:content,suffix:''};
}
function writableComponents(nodes,spoiler=false) {
 return nodes.map(c=>{
  const out=structuredClone(c);
  if(out.type===12)out.items=out.items.map(i=>({media:{url:i.media.url},...(i.description?{description:i.description}:{}),...(spoiler||i.spoiler?{spoiler:true}:{})}));
  if(out.components)out.components=writableComponents(out.components,spoiler);
  return out;
 });
}
const urls=text=>JSON.stringify(text.match(/https?:\/\/[^\s<>]+/gi)||[]);
export async function buildEditedPost(current,text,config,dependencies={}) {
 if(typeof text!=='string'||text.length>2000)throw Error('Invalid text');
 if(!text.trim())throw new MissingSupportedLinkError();
 const source=editableSource(current,dependencies.ownershipRow),components=jsonComponents(current),v2=components.some(c=>c.type===17)||current.flags?.has?.(32768);
 const attachments=[...(current.attachments?.values?.() || [])].map(a=>({id:a.id,filename:a.name,...(a.description?{description:a.description}:{})}));
 const replyNote=preservedReplyNote(current,dependencies.ownershipRow);
 const controlled=nodes=>{const result=withCardControls(nodes);checkReplyBudget(result);return result;};
 const sourceIndex=replyNote&&components[0]?.content===replyNote.content?1:0;
 const clean=v2?displaySourceUrls(cleanCardLinks(text)):cleanCardLinks(text);
 if(clean.length+source.suffix.length>2000)throw Error('Too long');
 if(urls(source.text)===urls(text))return v2
  ? {components:controlled(writableComponents(components).map((c,i)=>i===sourceIndex?{...c,content:clean}:c)),withComponents:true,attachments,allowedMentions:mentions}
  : {content:clean+source.suffix,attachments,allowedMentions:mentions};
 const expanded=await (dependencies.expand || expandShortLinks)(text,config.modes);
 const links=extractLinks(expanded);
 if(!links.length)throw new MissingSupportedLinkError();
 if(links.some(l=>!config.modes[l.platform]||['off','native'].includes(config.modes[l.platform])))throw Error('Unsupported replacement link');
 const payload=await (dependencies.render || simplePayload)(expanded,config.modes,[]) || buildPayload(expanded,config.modes);
 if(!payload)throw Error('Preview unavailable');
 // A Components V2 message cannot be downgraded to a native helper preview.
 if(v2 && payload.flags!==32768)throw Error('Incompatible preview');
 if(payload.flags===32768){
  if(JSON.stringify(payload).includes('preview unavailable.'))throw Error('Preview unavailable');
  const spoiled=JSON.stringify(components).includes('"spoiler":true') || attachments.some(a=>a.filename?.startsWith('SPOILER_'));
  return {...payload,content:null,embeds:[],components:controlled([...(replyNote?.content.startsWith('-# ')?replyNoteComponents(replyNote):[]),{type:10,content:clean,...(dependencies.ownershipRow?.sourceComponentId===USER_TEXT_COMPONENT_ID?{id:USER_TEXT_COMPONENT_ID}:{})},...(replyNote&&!replyNote.content.startsWith('-# ')?replyNoteComponents(replyNote):[]),...writableComponents(payload.components.slice(1),spoiled)]),withComponents:true,attachments,allowedMentions:mentions};
 }
 if(payload.embeds?.length)throw Error('Preview unavailable');
 const helperLines=(payload.content || '').split('\n').filter(line=>line && !line.startsWith('Original:'));
 const content=[clean,...helperLines].join('\n\n');if(content.length>2000)throw Error('Too long');
 return {...payload,content,attachments,allowedMentions:mentions};
}
export function createEditHandler(store,config,busy,log=()=>{},dependencies={}) {
 const sessions=new Map();
 return async interaction=>{
  const open=interaction.isButton?.() && /^manage:edit:\d{17,20}$/.test(interaction.customId);
  const submit=interaction.isModalSubmit?.() && /^manage:save:[a-f0-9]{32}$/.test(interaction.customId);
  if(!open&&!submit)return false;
  const now=Date.now();for(const [key,s] of sessions)if(s.expires<now)sessions.delete(key);
  const key=submit?interaction.customId.split(':')[2]:null,session=sessions.get(key);
  const id=open?interaction.customId.split(':')[2]:session?.id;
  const row=id&&store.get(id);
  const valid=()=>{const fresh=id&&store.get(id);return fresh&&fresh.ownerId===interaction.user.id&&fresh.guildId===interaction.guildId&&fresh.channelId===interaction.channelId&&fresh.webhookId===row?.webhookId&&fresh.webhookChannelId===row?.webhookChannelId&&(!config.testGuildId||fresh.guildId===config.testGuildId)&&(!config.channelIds.size||config.channelIds.has(fresh.channelId));};
  const reply=content=>interaction.reply({content,flags:64,allowedMentions:mentions});
  if(!row||!valid()||(submit&&session.user!==interaction.user.id)){await reply('Only the original poster can edit a tracked repost. If this form expired, reopen Manage Post.');return true;}
  if(busy.has(id)){await reply('An action on this post is already in progress.');return true;}
  busy.add(id);let deferred=false;
  try {
   if(submit){await interaction.deferReply({flags:64});deferred=true;sessions.delete(key);}
   const current=await interaction.channel.messages.fetch({message:id,force:true,cache:false});
   if(current.webhookId!==row.webhookId||!valid())throw Error('Identity changed');
   const route=await refreshWebhookRoute(interaction.channel,interaction.client.user,row);
   const hooks=await route.channel.fetchWebhooks();const hook=hooks.find(h=>h.id===row.webhookId&&h.owner?.id===interaction.client.user.id&&h.token);
   if(!hook)throw Error('Webhook missing');
   verifyThreadHook(hook,route);
   if(route.threadId&&(current.channelId!==row.channelId||current.guildId!==row.guildId||current.id!==id||current.id===row.channelId))throw Error('Wrong thread message');
   if(open){
    if(sessions.size>=1000)throw Error('Capacity');
    const text=editableSource(current,row).text;if(!text||text.length>2000)throw Error('Source unavailable');
    const nonce=randomBytes(16).toString('hex');sessions.set(nonce,{id,user:interaction.user.id,hash:editFingerprint(current),expires:now+600000});
    await interaction.showModal({custom_id:`manage:save:${nonce}`,title:'Edit Post',components:[{type:1,components:[{type:4,custom_id:'text',label:'Your text and links',style:2,value:text,required:true,max_length:2000}]}]});
   }else{
    if(editFingerprint(current)!==session.hash)throw Error('Stale');
    const payload=await buildEditedPost(current,interaction.fields.getTextInputValue('text'),config,{...dependencies,ownershipRow:row});
    const fresh=await interaction.channel.messages.fetch({message:id,force:true,cache:false});
    if(!valid()||fresh.webhookId!==row.webhookId||editFingerprint(fresh)!==session.hash)throw Error('Stale');
    await refreshWebhookRoute(interaction.channel,interaction.client.user,row);
    await hook.editMessage(id,{...payload,...threadOptions(route)});
    await interaction.editReply({content:'Your repost was updated.',allowedMentions:mentions});
   }
  }catch(error){log('edit_post_failed');const content=error instanceof MissingSupportedLinkError?'Keep at least one supported link in your post to save this edit.':'I could not confirm the edit. The post may have changed, the preview may be unavailable, or this edit format may not be supported. Check the post and reopen Manage Post.';try{if(deferred)await interaction.editReply({content,allowedMentions:mentions});else await reply(content);}catch{}}
  finally{busy.delete(id);}return true;
 };
}
