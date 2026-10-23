import test from 'node:test';
import assert from 'node:assert/strict';
import {editableSource,buildEditedPost,createEditHandler} from '../../src/edit-post.js';
const id='111111111111111111',row={ownerId:'owner',guildId:'guild',channelId:'channel',webhookId:'hook'};
const config={testGuildId:null,channelIds:new Set(),modes:{instagram:'oginstagram',threads:'fzthreads'}};
const url='https://www.instagram.com/reel/ABC';
const message=()=>({webhookId:'hook',content:'',components:[{type:10,content:'My words '+url},{type:17,components:[{type:12,items:[{media:{url:'https://cdninstagram.com/test.jpg',proxy_url:'unused'},spoiler:true}]}]}],attachments:new Map([['file',{id:'file',name:'SPOILER_photo.jpg',description:'Keep'}]])});
test('edit preserves existing gallery spoilers and attachments without fetching for text-only change',async()=>{
 const m=message();const p=await buildEditedPost(m,'Better words '+url,config,{render:()=>assert.fail('No rebuild')});
 assert.equal(p.components[0].content,'Better words '+url);assert.equal(p.components[1].components[0].items[0].spoiler,true);
 assert.equal(p.components[1].components[0].items[0].media.proxy_url,undefined);
 assert.equal(p.attachments[0].filename,'SPOILER_photo.jpg');assert.deepEqual(p.allowedMentions.parse,[]);
});
test('helper generated suffix stays out of modal and is preserved in text edits',async()=>{
 const m={content:'Hello https://www.threads.com/@example/post/ABC\n\nhttps://fzthreads.com/@example/post/ABC',components:[]};
 assert.equal(editableSource(m).text,'Hello https://www.threads.com/@example/post/ABC');
 const p=await buildEditedPost(m,'Hi https://www.threads.com/@example/post/ABC',config);
 assert.equal(p.content,'Hi https://www.threads.com/@example/post/ABC\n\nhttps://fzthreads.com/@example/post/ABC');
});
test('changed URL rebuild preserves spoilers; unavailable and incompatible rebuilds reject',async()=>{
 const render=async()=>({flags:32768,components:[{type:10,content:'source'},{type:17,components:[{type:12,items:[{media:{url:'https://cdninstagram.com/new.jpg'}}]}]}]});
 const p=await buildEditedPost(message(),'new '+url+'2',config,{expand:async s=>s,render});
 assert.equal(p.components[1].components[0].items[0].spoiler,true);
 await assert.rejects(buildEditedPost(message(),'new '+url+'2',config,{expand:async s=>s,render:async()=>{throw Error('Offline');}}));
 await assert.rejects(buildEditedPost(message(),'https://www.threads.com/@example/post/ABC',config,{expand:async s=>s,render:async()=>null}));
});
function fixture(){
 let current=message(),record={...row};const calls=[];const store={get:()=>record};
 const hook={id:'hook',owner:{id:'bot'},token:'fixture',editMessage:async(id,p)=>calls.push(['edit',p])};
 const handler=createEditHandler(store,config,new Set());
 const base={user:{id:'owner'},guildId:'guild',channelId:'channel',client:{user:{id:'bot'}},channel:{messages:{fetch:async()=>current},fetchWebhooks:async()=>[hook]},reply:async p=>calls.push(['reply',p]),deferReply:async()=>{},editReply:async p=>calls.push(['reply',p]),showModal:async p=>calls.push(['modal',p])};
 const open=patch=>handler({...base,isButton:()=>true,customId:'manage:edit:'+id,...patch});
 const save=patch=>handler({...base,isModalSubmit:()=>true,customId:calls.find(c=>c[0]==='modal')[1].custom_id,fields:{getTextInputValue:()=> 'Updated '+url},...patch});
 return {calls,open,save,setMessage:m=>current=m,setRecord:r=>record=r,handler,base};
}
test('owner can open and save same repost with no ownership mutation',async()=>{
 const f=fixture();await f.open();assert.equal(f.calls[0][0],'modal');await f.save();assert.equal(f.calls.filter(c=>c[0]==='edit').length,1);
});
test('nonowner open, forged submit, stale content, lost ownership and expired sessions fail closed',async()=>{
 const f=fixture();await f.open({user:{id:'other'}});assert.equal(f.calls.some(c=>c[0]==='modal'),false);
 for(const change of ['owner','stale','missing','webhook']){
 const g=fixture();await g.open();
 if(change==='owner')await g.save({user:{id:'other'}});
 else{if(change==='stale'){const m=message();m.editedTimestamp=1;g.setMessage(m);}if(change==='missing')g.setRecord(null);if(change==='webhook')g.setMessage({...message(),webhookId:'wrong'});await g.save();}
 assert.equal(g.calls.some(c=>c[0]==='edit'),false,change);
 }
 const h=fixture();await h.handler({...h.base,isModalSubmit:()=>true,customId:'manage:save:'+'a'.repeat(32)});assert.equal(h.calls.some(c=>c[0]==='edit'),false);
});
