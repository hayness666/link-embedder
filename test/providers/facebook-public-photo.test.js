import test from 'node:test';import assert from 'node:assert/strict';import {publicFacebookPhoto} from '../../src/providers/facebook.js';
const url='https://www.facebook.com/photo?fbid=1806517487514738',canonical='https://www.facebook.com/thisisaclue/photos/write-down-your-teams-answer-and-hand-it-to-your-trivia-host-for-1-point-830-952/1806517487514738/';
const first=`<link rel="canonical" href="${canonical}">`;
const second=`<meta property="og:url" content="https://www.facebook.com/photo/?fbid=1806517487514738&amp;set=a.638414764325022"><meta property="og:title" content="Photo"><meta property="og:description" content="&#x1f331;Write down your team&#x2019;s answer"><meta property="og:image" content="https://scontent-den2-1.xx.fbcdn.net/v/t39.30808-6/photo.jpg?signature=preserve">`;
const author='<link rel="canonical" href="https://www.facebook.com/thisisaclue/"><meta property="og:title" content="This is a Clue">';
const res=s=>new Response(s+'</head>',{headers:{'content-type':'text/html'}});
test('observed canonical photo route supplies image, real author, and decoded caption',async()=>{
 const calls=[];const p=await publicFacebookPhoto(url,async(u,o)=>{calls.push(u);assert.equal(o.redirect,'error');return res(u===url?first:u===canonical?second:author);});
 assert.deepEqual(calls,[url,canonical,'https://www.facebook.com/thisisaclue/']);const c=p.components[1].components;
 assert.ok(c.some(x=>x.content?.split('\n')[1]==='**This is a Clue** @\u200bthisisaclue'));assert.ok(c.some(x=>x.content==='🌱Write down your team’s answer'));assert.ok(c.find(x=>x.type===12).items[0].media.url.endsWith('signature=preserve'));
});
test('public photo rejects wrong identities, unrelated images, and inaccessible content',async()=>{
 for(const bad of [first.replace('1806517487514738','123'),first.replace('www.facebook.com','evil.test')])assert.equal(await publicFacebookPhoto(url,async()=>res(bad)),null);
 for(const bad of [second.replace('fbid=1806517487514738','fbid=123'),second.replace('scontent-den2-1.xx.fbcdn.net','evil.test'),second.replace('/v/t39.30808-6/','/m1/v/t6/'),second.replace('content="Photo"','content="Log in or sign up"')])assert.equal(await publicFacebookPhoto(url,async u=>res(u===url?first:bad)),null);
 assert.equal(await publicFacebookPhoto(url,async()=>new Response(null,{status:403})),null);
});
