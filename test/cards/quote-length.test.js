import test from 'node:test';
import assert from 'node:assert/strict';
import {shortQuote,shortCaption} from '../../src/card-format.js';
import {simpleCard} from '../../src/simple-cards.js';
test('shared quotes preserve 300 Unicode code points then append an ellipsis only for longer text',()=>{
 for(const character of ['a','😀','界']) for(const count of [299,300,301]) {
  const expected=character.repeat(Math.min(count,300))+(count>300?'…':'');
  assert.equal(shortQuote(character.repeat(count)),expected);
  assert.equal(shortCaption(character.repeat(count)),expected);
  for(const platform of ['twitter','bluesky','threads']) {
   const url=platform==='twitter'?'https://twitter.com/person/status/123':platform==='bluesky'?'https://bsky.app/profile/test.bsky.social/post/abc':undefined;
   const card=simpleCard({platform},{quote:{text:character.repeat(count),url,threadsQuote:platform==='threads'}});
   assert.equal(card.components.find(c=>c.content?.startsWith('> ')).content.split('\n> ')[1],expected);
  }
 }
 assert.equal(shortCaption('a'.repeat(301)),'a'.repeat(300)+'…');
});
