import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanCardLinks} from '../../src/repost.js';
import {parseSocialUrl} from '../../src/previews.js';

test('recognized post source and target retain only functional query parameters', () => {
 const paths = [
 'https://x.com/nasa/status/123',
 'https://www.pinterest.com/pin/123/',
 'https://www.tiktok.com/@nasa/video/123',
 'https://www.threads.net/@nasa/post/ABC',
 'https://bsky.app/profile/nasa.gov/post/abc',
 'https://www.reddit.com/r/aww/comments/abc/title',
 'https://www.instagram.com/p/ABC/',
 'https://www.amazon.com/dp/B08KTZ8249',
 'https://share.upscrolled.com/en/post/12345678-1234-1234-1234-123456789abc',
 'https://www.snapchat.com/@rmz_clips/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYdGVtcG1ocGNvAZiLpYoSAZiLpYoCAAAAAQ'
 ];
 for (const path of paths) {
  const raw=path+'?s=46&t=token&share_token=abc&is_copy_url=1&UTM_SOURCE=qa&utm_=x&unknown=decoration#tracking';
  const target=parseSocialUrl(raw);
  assert.ok(target,path);
  assert.equal(new URL(target.url).search,'',path);
  assert.equal(new URL(cleanCardLinks(raw)).search,'',path);
  assert.equal(new URL(cleanCardLinks(raw)).hash,'',path);
  assert.equal(cleanCardLinks('Before '+raw+' after'),'Before '+cleanCardLinks(raw)+' after');
 }
});
test('functional content selectors, ambiguous access, and unrelated URLs are preserved', () => {
 const cases=[
 ['https://www.instagram.com/p/ABC/?img_index=2&unknown=x','?img_index=2'],
 ['https://www.facebook.com/photo.php?fbid=123&set=456&foo=x','?fbid=123'],
 ['https://www.facebook.com/story.php?story_fbid=123&id=456&foo=x','?story_fbid=123&id=456'],
 ['https://www.facebook.com/watch/?v=123&foo=x','?v=123']
 ];
 for(const [raw,query] of cases){
  assert.equal(new URL(cleanCardLinks(raw)).search,query);
  assert.equal(new URL(parseSocialUrl(raw).url).search,query);
 }
 const access='https://www.xiaohongshu.com/explore/abc?xsec_token=secret&unknown=access';
 assert.equal(cleanCardLinks(access),access);
 for(const raw of ['https://example.com/video.mp4?signature=abc#part','https://cf-st.sc-cdn.net/d/example?token=abc','https://pin.it/example?required=x','https://m.reddit.com/r/aww/comments/abc?required=x']) assert.equal(cleanCardLinks(raw),raw);
 assert.equal(cleanCardLinks('https://amzn.to/46r7XV5?unknown=redirect&utm_source=qa'),'https://amzn.to/46r7XV5?unknown=redirect');
});
