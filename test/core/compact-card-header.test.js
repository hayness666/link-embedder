import test from 'node:test';
import assert from 'node:assert/strict';
import {cardHeaderComponents,imageCardComponents} from '../../src/card-format.js';
import {simpleCard} from '../../src/simple-cards.js';
import {withCardControls} from '../../src/card-controls.js';
import {parseSocialUrl} from '../../src/previews.js';
test('Reddit title and author share one TextDisplay and one controlled Section',()=>{
 const card=simpleCard(parseSocialUrl('https://www.reddit.com/r/aww/comments/izbf12/dog_watches_a_soccer_game/'),{title:'Dog watches a soccer game',username:'SonoriousRBLX',media:['https://i.redd.it/example.jpg']});
 assert.match(card.components[0].content,/\*\*\n\*\*r\/aww\*\* u\/SonoriousRBLX$/);
 assert.equal(card.components[0].content.split('\n').length,2);assert.equal(card.components[1].type,12);
 const controlled=withCardControls([card])[0];assert.equal(controlled.components[0].type,9);assert.deepEqual(controlled.components[0].components,[card.components[0]]);assert.equal(controlled.components[0].accessory.label,'⋯');assert.deepEqual(controlled.components.slice(1),card.components.slice(1));assert.deepEqual(withCardControls([controlled]),[controlled]);
});
test('image/post layouts group headings without changing captions, media, or footer',()=>{
 for(const captionBeforeMedia of [false,true]){
 const c=imageCardComponents({heading:'**[Title](https://example.org)**',author:'**Author** @handle',items:[{media:{url:'https://example.org/photo.jpg'}}],caption:'Caption',captionBeforeMedia,footer:'Credit'});
 assert.equal(c[0].content,'**[Title](https://example.org)**\n**Author** @handle');assert.equal(c[1].type,captionBeforeMedia?10:12);assert.equal(c.at(-2).divider,true);assert.equal(c.at(-1).content,'Credit');assert.equal(c.filter(x=>x.type===14).length,1);
 }
});
test('authorless headers preserve existing small spacer; all comparable simple cards group author',()=>{
 assert.deepEqual(cardHeaderComponents('Title'),[{type:10,content:'Title'},{type:14,divider:false,spacing:1}]);
 for(const url of ['https://www.threads.com/@example/post/ABC','https://x.com/example/status/123456789012345678','https://www.facebook.com/reel/2148630336056037','https://www.pinterest.com/pin/123456789012345/']){
 const card=simpleCard(parseSocialUrl(url),{name:'Author',username:'handle',caption:'Body'});assert.match(card.components[0].content,/\n\*\*Author\*\*/);assert.equal(card.components[0].content.split('\n').length,2);assert.equal(card.components[1].content,'Body');
 }
});
