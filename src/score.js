/* Talking Voder: phrase -> phonemes -> a score of key presses (20 ms cells) -> offline render. Pure except renderScore. */
(function (g) {
  "use strict";
  const DT = 0.02;
  const ROWS = 13; // 0..9 band keys, 10..12 stop keys (P/B, T/D, K/G)

  // First three formants (Hz) after Peterson & Barney (1952), typed from memory: unverified.
  const FORM = { IY: [270, 2290, 3010], IH: [390, 1990, 2550], EH: [530, 1840, 2480], AE: [660, 1720, 2410], AA: [730, 1090, 2440], AO: [570, 840, 2410], UH: [440, 1020, 2240], UW: [300, 870, 2240], AH: [640, 1190, 2390], ER: [490, 1350, 1690] };
  const DIPH = { EY: ["EH", "IY"], AY: ["AA", "IY"], OW: ["AO", "UW"], AW: ["AA", "UW"], OY: ["AO", "IY"] };

  // The Voder's ten bands: key 0 = 0-250 Hz, key k = 250+300(k-1) to 250+300k Hz.
  function bandOf(f) { if (f < 250) return 0; if (f >= 2950) return -1; return Math.min(9, 1 + Math.floor((f - 250) / 300)); }
  function vowelKeys(v) { const s = new Set(); FORM[v].forEach((f) => { const b = bandOf(f); if (b >= 0) s.add(b); }); return Array.from(s).sort((a, b) => a - b); }

  const FRIC = { S: [[7, 8, 9], 130, 1], Z: [[7, 8, 9], 100, 0], SH: [[5, 6, 7], 130, 1], ZH: [[5, 6, 7], 100, 0], F: [[4, 5, 6, 7, 8, 9], 110, 1], V: [[4, 5, 6, 7, 8, 9], 70, 0], TH: [[5, 6, 7, 8, 9], 110, 1], DH: [[5, 6, 7, 8, 9], 70, 0], HH: [[2, 3, 4, 5, 6], 70, 1] };
  const NASAL = { M: [[0, 1], 90], N: [[0, 1, 6], 90], NG: [[0, 1, 4], 90] };
  const GLIDE = { L: ["EH", 80, [1, 4, 8]], R: ["ER", 80, null], W: ["UW", 70, null], Y: ["IY", 70, null] };
  const STOPK = { P: [0, 0], B: [0, 1], T: [1, 0], D: [1, 1], K: [2, 0], G: [2, 1] };

  function stopSegs(tok) { // closure (voicebar if voiced) then a burst on the stop key
    const [k, voiced] = STOPK[tok];
    return [{ keys: voiced ? [0] : [], src: 0, ms: 50 }, { stop: k, keys: [], src: 0, ms: 20 }];
  }

  function expand(tokens) {
    const segs = [];
    tokens.forEach((t) => {
      if (t === "_") segs.push({ keys: [], src: 0, ms: 80 });
      else if (t === ",") segs.push({ keys: [], src: 0, ms: 160 });
      else if (t === ".") segs.push({ keys: [], src: 0, ms: 260 });
      else if (FORM[t]) segs.push({ keys: vowelKeys(t), src: 0, ms: 150 });
      else if (DIPH[t]) DIPH[t].forEach((v) => segs.push({ keys: vowelKeys(v), src: 0, ms: 95 }));
      else if (FRIC[t]) segs.push({ keys: FRIC[t][0], src: FRIC[t][2] ? 1 : 0, ms: FRIC[t][1] });
      else if (NASAL[t]) segs.push({ keys: NASAL[t][0], src: 0, ms: NASAL[t][1] });
      else if (GLIDE[t]) segs.push({ keys: GLIDE[t][2] || vowelKeys(GLIDE[t][0]), src: 0, ms: GLIDE[t][1] });
      else if (STOPK[t]) stopSegs(t).forEach((s) => segs.push(s));
      else if (t === "CH") { stopSegs("T").forEach((s) => segs.push(s)); segs.push({ keys: FRIC.SH[0], src: 1, ms: 90 }); }
      else if (t === "JH") { stopSegs("D").forEach((s) => segs.push(s)); segs.push({ keys: FRIC.ZH[0], src: 0, ms: 80 }); }
    });
    return segs;
  }

  const DICT = {
    the: ["DH", "AH"], a: ["AH"], i: ["AY"], am: ["AE", "M"], is: ["IH", "Z"], of: ["AH", "V"], to: ["T", "UW"], and: ["AE", "N", "D"], no: ["N", "OW"], will: ["W", "IH", "L"],
    hello: ["HH", "AH", "L", "OW"], voice: ["V", "OY", "S"], speak: ["S", "P", "IY", "K"], speech: ["S", "P", "IY", "CH"], we: ["W", "IY"], see: ["S", "IY"], sea: ["S", "IY"], saw: ["S", "AO"],
    she: ["SH", "IY"], you: ["Y", "UW"], can: ["K", "AE", "N"], make: ["M", "EY", "K"], talk: ["T", "AO", "K"], walk: ["W", "AO", "K"], bell: ["B", "EH", "L"], labs: ["L", "AE", "B", "Z"],
    robot: ["R", "OW", "B", "AA", "T"], machine: ["M", "AH", "SH", "IY", "N"], this: ["DH", "IH", "S"], good: ["G", "UH", "D"], world: ["W", "ER", "L", "D"], fair: ["F", "EH", "R"],
    new: ["N", "UW"], york: ["Y", "AO", "R", "K"], valley: ["V", "AE", "L", "IY"], shadow: ["SH", "AE", "D", "OW"], death: ["D", "EH", "TH"], through: ["TH", "R", "UW"], fear: ["F", "IY", "R"], evil: ["IY", "V", "AH", "L"],
    yea: ["Y", "EH"], though: ["DH", "OW"], she_: ["SH", "IY"], voder: ["V", "OW", "D", "ER"], vocoder: ["V", "OW", "K", "OW", "D", "ER"], dudley: ["D", "AH", "D", "L", "IY"], it: ["IH", "T"], that: ["DH", "AE", "T"], what: ["W", "AH", "T"], hear: ["HH", "IY", "R"], me: ["M", "IY"]
  };
  // Letter-to-sound fallback: crude English-ish rules, longest match first. Uppercase vowel = long vowel (magic e).
  const RULES = [["tch", ["CH"]], ["igh", ["AY"]], ["sh", ["SH"]], ["ch", ["CH"]], ["th", ["TH"]], ["ph", ["F"]], ["ng", ["NG"]], ["ck", ["K"]], ["wh", ["W"]], ["qu", ["K", "W"]],
    ["ee", ["IY"]], ["ea", ["IY"]], ["oo", ["UW"]], ["ai", ["EY"]], ["ay", ["EY"]], ["oa", ["OW"]], ["ow", ["OW"]], ["ou", ["AW"]], ["oi", ["OY"]], ["oy", ["OY"]],
    ["ar", ["AA", "R"]], ["er", ["ER"]], ["ir", ["ER"]], ["ur", ["ER"]], ["or", ["AO", "R"]],
    ["A", ["EY"]], ["E", ["IY"]], ["I", ["AY"]], ["O", ["OW"]], ["U", ["UW"]],
    ["a", ["AE"]], ["b", ["B"]], ["c", ["K"]], ["d", ["D"]], ["e", ["EH"]], ["f", ["F"]], ["g", ["G"]], ["h", ["HH"]], ["i", ["IH"]], ["j", ["JH"]], ["k", ["K"]], ["l", ["L"]], ["m", ["M"]],
    ["n", ["N"]], ["o", ["AA"]], ["p", ["P"]], ["q", ["K"]], ["r", ["R"]], ["s", ["S"]], ["t", ["T"]], ["u", ["AH"]], ["v", ["V"]], ["w", ["W"]], ["x", ["K", "S"]], ["y", ["Y"]], ["z", ["Z"]]];
  function g2p(word) {
    const w0 = word.toLowerCase().replace(/[^a-z]/g, "");
    if (DICT[w0]) return DICT[w0].slice();
    let w = w0.replace(/([aeiou])([bcdfghjklmnpqrstvwxz])e$/, (m, v, c) => v.toUpperCase() + c);
    const out = []; let i = 0;
    while (i < w.length) {
      let hit = null;
      for (const [pat, ph] of RULES) if (w.startsWith(pat, i)) { hit = [pat, ph]; break; }
      if (hit) { out.push(...hit[1]); i += hit[0].length; } else i++;
    }
    return out;
  }
  function phonemize(text) {
    const toks = [], parts = String(text).match(/[a-z']+|[,.!?;:]/gi) || [];
    parts.forEach((p) => {
      if (/^[,;:]$/.test(p)) { toks.push(","); return; }
      if (/^[.!?]$/.test(p)) { toks.push("."); return; }
      if (toks.length && toks[toks.length - 1] !== "_" && toks[toks.length - 1] !== "," && toks[toks.length - 1] !== ".") toks.push("_");
      toks.push(...g2p(p));
    });
    return toks;
  }

  /** opts: {f0: base Hz, intonation: 'statement'|'question'|'flat', speed: multiplier on durations (1 = normal)} */
  function compile(tokens, opts) {
    opts = opts || {}; const speed = opts.speed || 1, base = opts.f0 || 110, into = opts.intonation || "statement";
    const segs = expand(tokens), counts = segs.map((s) => Math.max(1, Math.round((s.ms * speed) / (DT * 1000))));
    const n = counts.reduce((a, b) => a + b, 0) + 1;
    const cells = Array.from({ length: ROWS }, () => new Uint8Array(n)), src = new Uint8Array(n), f0 = new Float32Array(n);
    let c = 0;
    segs.forEach((s, i) => {
      for (let k = 0; k < counts[i]; k++) {
        s.keys.forEach((r) => { cells[r][c + k] = 1; }); src[c + k] = s.src;
        if (s.stop != null && k === 0) cells[10 + s.stop][c] = 1;
      }
      c += counts[i];
    });
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1);
      let r = 1.12 - 0.28 * u;
      if (into === "question" && u > 0.7) r = 1.12 - 0.28 * 0.7 + ((u - 0.7) / 0.3) * 0.55;
      if (into === "flat") r = 1;
      f0[i] = base * r;
    }
    return { n, dt: DT, cells, src, f0, tokens: tokens.slice() };
  }

  function hash(sc) { // FNV-1a over cells, source and rounded pitch
    let h = 2166136261 >>> 0; const mix = (v) => { h ^= v & 255; h = Math.imul(h, 16777619) >>> 0; };
    sc.cells.forEach((row) => row.forEach(mix)); sc.src.forEach(mix); sc.f0.forEach((v) => mix(Math.round(v)));
    return h.toString(16);
  }

  async function renderScore(sc, E, sr) {
    sr = sr || E.SR; const tail = 0.35, len = Math.ceil((sc.n * sc.dt + tail) * sr);
    const ctx = new OfflineAudioContext(1, len, sr), v = E.voderTV(ctx, ctx.destination);
    v.setSource("buzz", 0); v.setPitch(sc.f0[0], 0, 0.001);
    const state = new Uint8Array(10); let src = 0;
    for (let c = 0; c < sc.n; c++) {
      const t = c * sc.dt;
      if (sc.src[c] !== src) { src = sc.src[c]; v.setSource(src ? "hiss" : "buzz", t); }
      v.setPitch(sc.f0[c], t, 0.02);
      for (let r = 0; r < 10; r++) if (sc.cells[r][c] !== state[r]) { state[r] = sc.cells[r][c]; v.setKey(r, !!state[r], t); }
      for (let k = 0; k < 3; k++) if (sc.cells[10 + k][c] && (c === 0 || !sc.cells[10 + k][c - 1])) v.burst(k, t);
    }
    for (let r = 0; r < 10; r++) if (state[r]) v.setKey(r, false, sc.n * sc.dt);
    const out = await ctx.startRendering(), d = new Float32Array(out.getChannelData(0));
    let m = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > m) m = a; }
    if (m > 1e-9) for (let i = 0; i < d.length; i++) d[i] *= 0.89 / m;
    const ob = new AudioBuffer({ length: d.length, numberOfChannels: 1, sampleRate: sr }); ob.copyToChannel(d, 0); return ob;
  }

  g.VoderScore = { DT, ROWS, FORM, bandOf, vowelKeys, expand, g2p, phonemize, compile, hash, renderScore, STOPK, FRIC, NASAL };
  if (typeof module !== "undefined") module.exports = g.VoderScore;
})(typeof globalThis !== "undefined" ? globalThis : this);
