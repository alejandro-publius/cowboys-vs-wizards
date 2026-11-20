import test from "node:test";
import assert from "node:assert/strict";
import {migrate, newSave, settle} from "./progress.js";
import {MAX_CODE_LENGTH, decodeSaveCode, describeSave, encodeSave, sameSave} from "./savecode.js";
import {TRAIL} from "./trail.js";

const code = (value) => btoa(JSON.stringify(value));
const played = () => { let save = newSave(); for (let i = 0; i < 2; i++) save = settle(save, "trail", true).save; return save; };

test("a real v2 save code reads back as the same save, whatever its key order or line breaks", () => {
  const save = played();
  assert.deepEqual(decodeSaveCode(encodeSave(save)), {ok: true, save, legacy: false});
  const reordered = Object.fromEntries(Object.entries(save).reverse());
  assert.ok(decodeSaveCode(code(reordered)).ok);
  const wrapped = encodeSave(save).replace(/(.{40})/g, "$1\n");
  assert.ok(sameSave(decodeSaveCode(` ${wrapped} `).save, save));
  assert.ok(decodeSaveCode(encodeSave(newSave())).ok, "a fresh save's own code is a real code");
});

test("a legacy v1 code is read with migrate()'s meaning", () => {
  const read = decodeSaveCode(code({wins: 2, losses: 2}));
  assert.equal(read.ok, true);
  assert.equal(read.legacy, true);
  assert.deepEqual(read.save, migrate({wins: 2, losses: 2}));
  assert.deepEqual(decodeSaveCode(code({wins: 0})).save, migrate({wins: 0}));
  assert.equal(decodeSaveCode(code({wins: TRAIL.length + 1})).ok, false, "more wins than the Trail has");
  assert.equal(decodeSaveCode(code({wins: 1, losses: -1})).ok, false);
  assert.equal(decodeSaveCode(code({wins: 1, extra: 1})).ok, false);
});

test("malformed, damaged, oversized and future codes are refused with a reason", () => {
  const save = played();
  const bad = ["", "   ", "not base64!", "abc", btoa("not json"), code(null), code([1, 2]), code("text"), code(7),
    code({...save, wins: -1}), code({...save, deck: {...save.deck, "cowboy-billy": 99}}), code({...save, extra: true}),
    code((({rolls, ...rest}) => rest)(save)), code({...save, v: 1}), code({...save, v: "2"}), "A".repeat(MAX_CODE_LENGTH + 4)];
  for (const text of bad) {
    const read = decodeSaveCode(text);
    assert.equal(read.ok, false, text.slice(0, 40));
    assert.equal(typeof read.reason, "string");
  }
  assert.match(decodeSaveCode(code({...save, v: 3})).reason, /newer version/);
  assert.equal(decodeSaveCode(undefined).ok, false);
});

test("the preview names the progress a code holds", () => {
  assert.match(describeSave(played()), /^Trail 2 of \d+ won, 0 rivals beaten, 0 bounty hunts cleared, \d+ collected cards, 0 unopened packs\.$/);
});
