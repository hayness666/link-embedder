import test from 'node:test';import assert from 'node:assert/strict';
import {displayUrl,displaySourceUrls,restoreSourceUrls} from '../../src/url-display.js';
import {sourceText,shortCaption,shortQuote} from '../../src/card-format.js';
import {buildRepostPayload} from '../../src/repost.js';
import {editableSource,buildEditedPost} from '../../src/edit-post.js';
import {USER_TEXT_COMPONENT_ID} from '../../src/reply-context.js';
test('URL-shaped labels never generate masked Markdown; functional destinations stay intact',()=>{
 for(const url of ['https://www.example.org/','https://example.org/a/','http://www.example.org/a//','https://example.org/a/?sig=abc/','https://example.org/a/#fragment/','https://example.org/a?next=/']){
  assert.equal(displayUrl(url),`<${url}>`);assert.equal(displaySourceUrls(url),url);
 }
});
test('captions and quotes retain safe autolinks, punctuation, and truncation',()=>{
 for(const format of [sourceText,shortCaption,shortQuote])assert.equal(format('- See https://www.example.org/a/'),'\\- See <https://www.example.org/a/>');
 assert.equal(sourceText('https://example.org/long/',8),'https://\u200b…');
 assert.equal(displaySourceUrls('See https://example.org/a/.'),'See https://example.org/a/.');
 for(const s of ['`https://example.org/a/`','||https://example.org/a/||','<https://example.org/a/>','[custom](https://example.org/a/)'])assert.equal(displaySourceUrls(s),s);
});
test('tracking cleanup and edit roundtrip keep ordinary URL display without nested markup',async()=>{
 const raw='My text https://www.instagram.com/p/ABC/?utm_source=qa';
 const p=buildRepostPayload({content:raw,author:{username:'Person'}},{flags:32768,components:[{type:10,content:raw},{type:17,components:[{type:10,content:'Card'}]}]});
 assert.equal(p.components[0].content,'My text https://www.instagram.com/p/ABC/');p.components[0].id=USER_TEXT_COMPONENT_ID;
 const row={sourceComponentId:USER_TEXT_COMPONENT_ID},current={components:p.components,attachments:new Map()};
 const source=editableSource(current,row).text;assert.equal(source,p.components[0].content);
 const edited=await buildEditedPost(current,source.replace('My text','Edited'),{modes:{instagram:'oginstagram'}},{ownershipRow:row});assert.equal(edited.components[0].content,source.replace('My text','Edited'));
});
test('old generated masks decode only for tracked user text and never regenerate on edit',()=>{
 const old='[https://www.example.org/a](<https://www.example.org/a/>)';
 assert.equal(restoreSourceUrls(old),'https://www.example.org/a/');
 assert.equal(restoreSourceUrls('[Read article](<https://www.example.org/a/>)'),'[Read article](<https://www.example.org/a/>)');
 const m={flags:{has:n=>n===32768},components:[{type:10,id:USER_TEXT_COMPONENT_ID,content:old}],attachments:new Map()};
 assert.equal(editableSource(m,{sourceComponentId:USER_TEXT_COMPONENT_ID}).text,'https://www.example.org/a/');
 assert.equal(editableSource(m,{}).text,old);
});
test('descriptive source labels and actual card titles remain intact',()=>{
 for(const raw of ['[Read the article](https://example.org/article/)','[Watch the video](<https://example.org/video/>)']){
  assert.equal(displaySourceUrls(raw),raw);
  const p=buildRepostPayload({content:raw,author:{username:'Person'}},{flags:32768,components:[{type:10,content:raw},{type:17,components:[{type:10,content:'Real article title'}]}]});
  assert.equal(p.components[0].content,raw);assert.match(JSON.stringify(p),/Real article title/);
 }
});
