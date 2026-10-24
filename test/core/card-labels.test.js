import test from 'node:test';
import assert from 'node:assert/strict';
import {cardHeading} from '../../src/card-format.js';
import {parseSocialUrl} from '../../src/previews.js';
test('generic headings consistently use Platform plus the actual content type',()=>{
 const cases=[
 ['https://twitter.com/example/status/123','Twitter Post'],
 ['https://bsky.app/profile/example.com/post/abc','Bluesky Post'],
 ['https://www.threads.com/@example/post/ABC','Threads Post'],
 ['https://www.facebook.com/photo?fbid=123','Facebook Photo'],
 ['https://www.facebook.com/reel/123','Facebook Reel'],
 ['https://www.instagram.com/reel/ABC','Instagram Reel'],
 ['https://www.instagram.com/p/ABC','Instagram Post'],
 ['https://www.snapchat.com/spotlight/ABCDEFGHIJKLMNOPQRSTUV','Snapchat Spotlight'],
 ['https://www.pinterest.com/pin/123456789/','Pinterest Pin'],
 ['https://www.amazon.com/dp/B07812QWNH','Amazon Product'],
 ['https://www.reddit.com/r/aww/comments/abc/title','Reddit Post'],
 ['https://twitter.com/i/spaces/1abcdefghijkL','Twitter Space'],
 ['https://twitter.com/i/lists/123','Twitter List']
 ];
 for(const [url,label] of cases){const link=parseSocialUrl(url);assert.ok(link,url);const result=cardHeading(link);assert.ok(result.startsWith(`**[${label}](`),result);assert.ok(result.includes(link.url));}
});
test('substantive supplied titles remain intact rather than replaced by generic labels',()=>{
 const link=parseSocialUrl('https://www.reddit.com/r/aww/comments/izbf12/dog_watches_a_soccer_game/');
 assert.ok(cardHeading(link,'Dog watches a soccer game').startsWith('**[Dog watches a soccer game]('));
});
