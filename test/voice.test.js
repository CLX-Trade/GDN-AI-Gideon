// The rules that make a spoken conversation feel right: what gets said, what counts as
// the person speaking rather than the microphone hearing Gideon, and when a turn is over.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpeechChunker, speakable, displayText, splitScreen, echoShare, isEcho, isBargeIn, isBackchannel,
  endOfTurnDelay, cleanTranscript, windowMessages, wantsPackCheck, annotateInterrupted, headline, SCREEN_MARKER,
} from '../shared/speech.js';

function chunk(text, size = 5, options) {
  const c = new SpeechChunker(options);
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(...c.feed(text.slice(i, i + size)));
  out.push(...c.flush());
  return out;
}

test('speakable strips markdown so nothing is read out as punctuation', () => {
  assert.equal(speakable('## Next steps'), 'Next steps');
  assert.equal(speakable('**Stop** and `verify` it'), 'Stop and verify it');
  assert.equal(speakable('- first item'), 'first item');
  assert.equal(speakable('1. first item'), 'first item');
  assert.equal(speakable('See [the guide](https://example.com/x) now'), 'See the guide now');
  assert.equal(speakable('Go to https://example.com/x now'), 'Go to now');
  assert.equal(speakable('| a | b |\n|---|---|\n| 1 | 2 |'), '');
  assert.equal(speakable('A — B'), 'A, B');
});

test('speakable keeps the hyphens and slashes in trade terms', () => {
  assert.equal(speakable('Check the L/C for EN-590 at USD 612.00'), 'Check the L/C for EN-590 at USD 612.00');
});

test('chunker splits on sentences however the stream is cut', () => {
  const text = 'The shipper name differs between the documents. Ask the seller why that is. Then verify it.';
  for (const size of [1, 3, 7, 50]) {
    assert.deepEqual(chunk(text, size), ['The shipper name differs between the documents.', 'Ask the seller why that is.', 'Then verify it.']);
  }
});

test('chunker does not cut at decimals, abbreviations or initials', () => {
  const text = 'The price is USD 612.00 per tonne from Meridian Pte. Ltd. in Santos. Dr. Tan at U.S. customs signed No. 5 on it.';
  const pieces = chunk(text);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0], 'The price is USD 612.00 per tonne from Meridian Pte. Ltd. in Santos.');
});

test('chunker holds very short fragments together with the next sentence', () => {
  assert.deepEqual(chunk('Right. The invoice total does not match the contract.'), ['Right. The invoice total does not match the contract.']);
});

test('chunker lets the first clause go early so Gideon starts talking sooner', () => {
  const pieces = chunk('The two documents disagree on the shipper name, which matters because the bill of lading has to match the seller.');
  assert.equal(pieces[0], 'The two documents disagree on the shipper name,');
  assert.equal(pieces.length, 2);
});

test('chunker breaks up a very long sentence with no full stop', () => {
  const pieces = chunk(`${'word '.repeat(80)}end.`);
  assert.ok(pieces.length > 1);
  assert.ok(pieces.every((p) => p.length <= 220));
});

test('chunker stops speaking at the screen marker, even if it arrives in pieces', () => {
  const text = `Here is the checklist on your screen.\n${SCREEN_MARKER}\n# Checklist\n- Shipper name\n- Vessel`;
  for (const size of [1, 4, 200]) {
    assert.deepEqual(chunk(text, size), ['Here is the checklist on your screen.']);
  }
});

test('chunker stops speaking at a file block', () => {
  const text = 'I have drafted the letter for you.\n```gideon-file name="letter.pdf"\n# Dear Sir\nBody\n```\nDone.';
  assert.deepEqual(chunk(text), ['I have drafted the letter for you.']);
});

test('chunker reads list items and skips table rows', () => {
  const text = 'Three things to check:\n- The shipper name\n- The vessel number\n\n| Field | Value |\n|---|---|\n| A | B |\n';
  assert.deepEqual(chunk(text), ['Three things to check:', 'The shipper name', 'The vessel number']);
});

test('the screen marker never reaches the person', () => {
  assert.equal(displayText(`Have a look.\n${SCREEN_MARKER}\n# Table`), 'Have a look.\n# Table');
  assert.equal(displayText('No marker here'), 'No marker here');
  assert.deepEqual(splitScreen(`Say this.\n${SCREEN_MARKER}\nShow this`), { spoken: 'Say this.\n', screen: '\nShow this' });
});

const SPOKEN = 'The shipper on the bill of lading is Meridian Commodity Trading, but the invoice says Meridian Commodities. That needs an answer before any money moves.';

test('Gideon hearing himself counts as an echo, even when mistranscribed', () => {
  assert.ok(isEcho('the shipper on the bill of lading', SPOKEN));
  assert.ok(isEcho('that needs an answer before any money moves', SPOKEN));
  assert.ok(isEcho('the shipper on the bill of leading is meridian', SPOKEN));
  assert.ok(isEcho('Meridian Commodity Trading', SPOKEN));
});

test('a person reusing some of the same words is not an echo', () => {
  assert.ok(!isEcho('who is the shipper on this one then', SPOKEN));
  assert.ok(!isEcho('what about the vessel name', SPOKEN));
  assert.ok(echoShare('completely different words entirely', SPOKEN) < 0.3);
});

test('echo checks do not fail on empty input', () => {
  assert.equal(echoShare('', SPOKEN), 0);
  assert.equal(echoShare('hello', ''), 0);
  assert.equal(isBargeIn('', SPOKEN), false);
});

test('a real interruption stops Gideon, and his own voice does not', () => {
  assert.ok(isBargeIn('hang on what about the vessel', SPOKEN));
  assert.ok(isBargeIn('wait', SPOKEN));
  assert.ok(isBargeIn('stop', SPOKEN));
  assert.ok(!isBargeIn('the shipper on the bill of lading', SPOKEN));
});

test('saying mm-hm while Gideon talks does not interrupt him', () => {
  assert.ok(!isBargeIn('mm-hm', SPOKEN));
  assert.ok(!isBargeIn('yeah', SPOKEN));
  assert.ok(!isBargeIn('okay', SPOKEN));
  assert.ok(isBackchannel('yeah yeah'));
  assert.ok(!isBackchannel('yeah but what about the vessel'));
});

test('a stray single word does not interrupt, but a clear one does', () => {
  assert.ok(!isBargeIn('table', SPOKEN));
  assert.ok(isBargeIn('sorry', SPOKEN));
});

test('Gideon waits longer when a thought is obviously unfinished', () => {
  assert.ok(endOfTurnDelay('What about the vessel?') < endOfTurnDelay('The vessel is fine.'));
  assert.ok(endOfTurnDelay('The vessel is fine.') < endOfTurnDelay('The vessel is fine and'));
  assert.ok(endOfTurnDelay('so I was thinking that') >= 1000);
  assert.ok(endOfTurnDelay('well because') >= 1000);
});

test('a report summary is cut to its headline for reading aloud', () => {
  const summary = 'The shipper name differs between the invoice and the bill of lading. The net weight on the packing list is 20 tonnes short. The vessel number fails its check digit. Verify all three with the issuing bodies before any funds move, using contact details you find independently.';
  const said = headline(summary);
  assert.ok(said.length <= 200);
  assert.ok(said.startsWith('The shipper name differs'));
  assert.ok(said.endsWith('.'));
  assert.ok(!said.includes('independently'));
  assert.equal(headline('One short sentence.'), 'One short sentence.');
  assert.ok(headline('word '.repeat(100)).length > 0);
});

test('sounds marked by the transcriber are not words', () => {
  assert.equal(cleanTranscript('(coughs)'), '');
  assert.equal(cleanTranscript('[music] hello there'), 'hello there');
  assert.equal(cleanTranscript('"What should I ask?"'), 'What should I ask?');
});

test('long calls drop old small talk but keep documents', () => {
  const doc = { role: 'user', content: [{ type: 'text', text: 'the contract' }] };
  const longPaste = { role: 'user', content: 'x'.repeat(3000) };
  const chatter = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `line ${i}` }));
  const all = [doc, { role: 'assistant', content: 'ok' }, longPaste, { role: 'assistant', content: 'ok' }, ...chatter];
  const kept = windowMessages(all, 40);
  assert.ok(kept.includes(doc));
  assert.ok(kept.includes(longPaste));
  assert.equal(kept.at(-1), all.at(-1));
  assert.equal(kept.length, 42);
  assert.equal(kept[0].role, 'user');
});

test('short calls are sent whole, and a window never starts with Gideon', () => {
  const few = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }];
  assert.equal(windowMessages(few, 40), few);
  const many = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  assert.equal(windowMessages(many, 4)[0].role, 'user');
});

test('"check them" with a pack waiting is an instruction, a question is not', () => {
  assert.ok(wantsPackCheck('go ahead and check them'));
  assert.ok(wantsPackCheck('run it'));
  assert.ok(wantsPackCheck('can you check these for me'));
  assert.ok(!wantsPackCheck('what should I check in these documents'));
  assert.ok(!wantsPackCheck('how do I start'));
  assert.ok(!wantsPackCheck('I was hoping you could tell me something about the shipper and whether to check it'));
});

test('an interrupted answer records exactly what was heard', () => {
  assert.match(annotateInterrupted('Full answer.', 'Full'), /only heard this much aloud: "Full"/);
  assert.match(annotateInterrupted('Full answer.', ''), /before hearing any of this/);
  assert.ok(annotateInterrupted('Full answer.', 'Full').startsWith('Full answer.'));
});
