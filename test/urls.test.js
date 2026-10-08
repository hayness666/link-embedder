import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPublicUrl, amazonMarkets } from '../src/urls.js';
import { parseSocialUrl, buildPayload } from '../src/previews.js';
import { readConfig } from '../src/config.js';

test('Amazon defaults to native URL content without a custom embed or suppression flag', () => {
  const config = readConfig({ DISCORD_GUILD_ID: '123456789012345678', DISCORD_CHANNEL_IDS: '234567890123456789' });
  assert.equal(config.modes.amazon, 'native');
  const payload = buildPayload('https://amazon.com/dp/B000IB9QXI?tag=referral-20', config.modes);
  assert.equal(payload.content, 'https://amazon.com/dp/B000IB9QXI');
  assert.deepEqual(payload.embeds, []);
  assert.equal(payload.flags, undefined);
});

test('removes known tracking and preserves functional YouTube IDs and playback parameters', () => {
  const url = cleanPublicUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc&t=42&si=tracking&utm_source=share&fbclid=secret#ref');
  assert.equal(url.href, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc&t=42');
  assert.equal(cleanPublicUrl('https://youtu.be/dQw4w9WgXcQ?si=secret&t=12').href, 'https://youtu.be/dQw4w9WgXcQ?t=12');
  // Cleaning support alone must not turn on a new automatic preview adapter.
  assert.equal(buildPayload(url.href, {}), null);
});

test('Facebook photo and story identity survives tracking removal', () => {
  assert.equal(parseSocialUrl('https://m.facebook.com/photo.php?fbid=123&ref=share&fbclid=secret').url,
    'https://www.facebook.com/photo.php?fbid=123');
  assert.equal(parseSocialUrl('https://facebook.com/story.php?story_fbid=pfbidABC123&id=456&mibextid=secret&utm_medium=share').url,
    'https://www.facebook.com/story.php?story_fbid=pfbidABC123&id=456');
  assert.equal(parseSocialUrl('https://facebook.com/permalink.php?story_fbid=123&id=456&ref=share').url,
    'https://www.facebook.com/permalink.php?story_fbid=123&id=456');
  assert.equal(parseSocialUrl('https://facebook.com/story.php?story_fbid=123'), null);
});

test('Instagram carousel selection survives canonicalization and helper fallback', () => {
  const payload = buildPayload('https://instagram.com/p/ABC?img_index=2&igsh=secret&utm_source=share', { instagram: 'oginstagram' });
  assert.match(payload.content, /oginstagram.com\/p\/ABC\?img_index=2/);
  assert.match(payload.content, /www.instagram.com\/p\/ABC\?img_index=2/);
  assert.doesNotMatch(JSON.stringify(payload), /secret|utm_source|igsh/);
});

test('Amazon product formats reduce to ASIN and preserve exact marketplace hostname', () => {
  for (const market of amazonMarkets) {
    for (const host of [market, `www.${market}`]) {
      for (const path of ['/dp/B000IB9QXI', '/Product-Title/dp/B000IB9QXI/ref=nosim', '/gp/product/B000IB9QXI/', '/gp/aw/d/B000IB9QXI']) {
        const result = parseSocialUrl(`https://${host}${path}?tag=someone-20&ref_=sr_1&ascsubtag=secret&utm_source=test`);
        assert.equal(result.url, `https://${host}/dp/B000IB9QXI`);
        assert.equal(result.asin, 'B000IB9QXI');
      }
    }
  }
  assert.equal(parseSocialUrl('https://amazon.com/dp/0747591059').asin, '0747591059');
});

test('Amazon refuses nonproduct, malformed, shortened and hostile URLs', () => {
  for (const raw of [
    'https://amazon.com/s?k=chair', 'https://amazon.com/stores/test',
    'https://amazon.com/dp/TOOSHORT', 'https://amazon.com/dp/B000IB9QXIEXTRA',
    'https://amazon.com/dp/B000IB9QXI/reviews', 'https://amazon.com/dp/B000IB9QX%49',
    'https://amazon.com.evil.test/dp/B000IB9QXI', 'https://evilamazon.com/dp/B000IB9QXI',
    'https://shop.amazon.com/dp/B000IB9QXI', 'https://www.amazon.fake/dp/B000IB9QXI',
    'https://amazon.com@evil.test/dp/B000IB9QXI', 'https://user@amazon.com/dp/B000IB9QXI',
    'https://amazon.com:443/dp/B000IB9QXI', 'https://amazon.com:8443/dp/B000IB9QXI',
    'https://%61mazon.com/dp/B000IB9QXI', 'https://amazon.com./dp/B000IB9QXI',
    'https://amzn.to/abc', 'https://a.co/d/abc', 'http://amazon.com/dp/B000IB9QXI'
  ]) assert.equal(parseSocialUrl(raw), null, raw);
});

test('Amazon card and native fallback never expose referral data or invent metadata', () => {
  const input = 'https://www.amazon.co.uk/Fancy-Title/dp/B000IB9QXI/ref=share?tag=private-referrer&ascsubtag=secret';
  const card = buildPayload(input, { amazon: 'card' });
  assert.equal(card.embeds[0].title, 'Amazon product · B000IB9QXI');
  assert.equal(card.embeds[0].url, 'https://www.amazon.co.uk/dp/B000IB9QXI');
  assert.equal(card.embeds[0].image, undefined);
  assert.doesNotMatch(JSON.stringify(card), /private-referrer|secret|Fancy-Title/);
  assert.equal(buildPayload(input, { amazon: 'native' }).content, 'https://www.amazon.co.uk/dp/B000IB9QXI');
});

test('cleaner removes tracking case-insensitively without deleting unrelated functional parameters', () => {
  assert.equal(cleanPublicUrl('https://facebook.com/photo.php?fbid=123&UTM_Source=x&ref=y&custom_id=456').href,
    'https://facebook.com/photo.php?fbid=123&custom_id=456');
  for (const raw of [null, '', 'https://localhost/path', 'https://instagram.com:443/p/ABC', 'https://instagr%61m.com/p/ABC']) {
    assert.equal(cleanPublicUrl(raw), null);
  }
});
