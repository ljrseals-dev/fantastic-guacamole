const assert = require("assert");
globalThis.VocoderCore = require("../src/core.js");
const S = require("../src/score.js");
// band mapping matches the Dudley layout: 0-250, then 300 Hz wide
assert.equal(S.bandOf(100), 0); assert.equal(S.bandOf(250), 1); assert.equal(S.bandOf(549), 1); assert.equal(S.bandOf(550), 2);
assert.equal(S.bandOf(2940), 9); assert.equal(S.bandOf(2950), -1);
assert.deepEqual(S.vowelKeys("IY"), [1, 7]); assert.deepEqual(S.vowelKeys("AA"), [2, 3, 8]);
// g2p: dictionary, rules, magic e
assert.deepEqual(S.g2p("hello"), ["HH", "AH", "L", "OW"]);
assert.deepEqual(S.g2p("ship"), ["SH", "IH", "P"]);
assert.deepEqual(S.g2p("make"), ["M", "EY", "K"]);
assert.deepEqual(S.g2p("chat"), ["CH", "AE", "T"]);
assert.deepEqual(S.phonemize("Hello, see the sea."), ["HH", "AH", "L", "OW", ",", "S", "IY", "_", "DH", "AH", "_", "S", "IY", "."]);
// compile: determinism, shape, stop key fires once per stop, voiced stop has a voicebar on key 0
const a = S.compile(S.phonemize("we see the sea"), { f0: 110 }), b = S.compile(S.phonemize("we see the sea"), { f0: 110 });
assert.equal(S.hash(a), S.hash(b)); assert.notEqual(S.hash(a), S.hash(S.compile(S.phonemize("we saw the sea"), { f0: 110 })));
assert.equal(a.cells.length, 13); assert.equal(a.cells[0].length, a.n);
const t = S.compile(["B", "AA", "T"], {}); let bursts = 0; for (let k = 10; k < 13; k++) for (let c = 0; c < t.n; c++) if (t.cells[k][c]) bursts++;
assert.equal(bursts, 2, "B and T each fire one burst"); assert(t.cells[11][t.cells[11].indexOf(1)] === 1);
assert.equal(t.cells[10][t.cells[10].indexOf(1)], 1); assert(t.cells[0][0] === 1, "voiced B starts with voicebar on key 0");
// fricative uses hiss, vowels use buzz
const s = S.compile(["S", "IY"], {}); assert.equal(s.src[0], 1); assert.equal(s.src[s.n - 2], 0);
// speed stretches, question raises the end
assert(S.compile(["AA"], { speed: 2 }).n > S.compile(["AA"], { speed: 1 }).n);
const q = S.compile(S.phonemize("see"), { intonation: "question" }); assert(q.f0[q.n - 1] > q.f0[0]);
const st = S.compile(S.phonemize("see"), { intonation: "statement" }); assert(st.f0[st.n - 1] < st.f0[0]);
console.log("score tests ok");
