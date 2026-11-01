const { chromium } = require("playwright"), http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const file = process.argv[2] || path.join(__dirname, "../index.html"), shots = path.join(__dirname, "..");
const server = http.createServer((q, r) => { r.setHeader("content-type", "text/html"); r.end(fs.readFileSync(file)); });
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 }, colorScheme: "dark" })).newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_|fonts\./.test(m.text())) errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__tvReady);

  const R = await page.evaluate(async () => {
    const { E, C, SC, S } = window.__tv, sr = 44100, out = {};
    const spec = (sig, lo, hi) => { const N = 2048; let acc = 0, tot = 0, cen = 0; const re = new Float64Array(N), im = new Float64Array(N);
      for (let s0 = 0; s0 + N <= sig.length; s0 += N / 2) { for (let i = 0; i < N; i++) { re[i] = sig[s0 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
        for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
        for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = i + k + len / 2, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
        for (let k = 1; k < N / 2; k++) { const f = k * sr / N, p = re[k] * re[k] + im[k] * im[k]; tot += p; cen += p * f; if (f >= lo && f < hi) acc += p; } }
      return { frac: acc / tot, centroid: cen / tot }; };
    const rms = (a) => { let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); };
    // 1. each band key alone
    { const oc = new OfflineAudioContext(1, sr * 10, sr), v = E.voderTV(oc, oc.destination); v.setPitch(110, 0); v.setSource("buzz", 0);
      for (let i = 0; i < 10; i++) { v.setKey(i, true, i + 0.1); v.setKey(i, false, i + 0.9); }
      const r = (await oc.startRendering()).getChannelData(0), eg = C.dudleyBands(); out.peak = [];
      for (let i = 0; i < 10; i++) { const seg = r.subarray(Math.floor((i + 0.25) * sr), Math.floor((i + 0.85) * sr)); let best = -1, bi = -1; for (let b = 0; b < 10; b++) { const p = spec(seg, eg[b].lo, eg[b].hi).frac; if (p > best) { best = p; bi = b; } } out.peak.push(bi); } }
    // 2. each stop key alone at t=0.5: onset time, decay, brightness
    out.stops = [];
    for (let k = 0; k < 3; k++) { const oc = new OfflineAudioContext(1, sr, sr), v = E.voderTV(oc, oc.destination); v.setSource("buzz", 0); v.burst(k, 0.5);
      const r = (await oc.startRendering()).getChannelData(0), w = Math.round(0.002 * sr); let pk = 0; const env = [];
      for (let i = 0; i + w < r.length; i += w) { const e = rms(r.subarray(i, i + w)); env.push(e); if (e > pk) pk = e; }
      const onset = env.findIndex((e) => e > 0.2 * pk) * 0.002, after = rms(r.subarray(Math.round(0.56 * sr), Math.round(0.6 * sr))), before = rms(r.subarray(0, Math.round(0.49 * sr)));
      out.stops.push({ onset, decay: after / pk, before, peak: pk, centroid: spec(r.subarray(Math.round(0.5 * sr), Math.round(0.5 * sr) + 2048), 0, 1e9).centroid }); }
    // 3. sequencer burst lands on its cell
    { const sc = SC.compile([".", "."], {}); sc.cells[11][10] = 1; const b = await SC.renderScore(sc, E), d = b.getChannelData(0), w = Math.round(0.002 * sr); let pk = 0; const env = [];
      for (let i = 0; i + w < d.length; i += w) { const e = rms(d.subarray(i, i + w)); env.push(e); if (e > pk) pk = e; }
      out.seqOnset = env.findIndex((e) => e > 0.2 * pk) * 0.002; out.seqExpected = 10 * sc.dt; }
    // 4. determinism + phrase character
    const p1 = SC.compile(SC.phonemize("we see the sea"), { f0: 110 }), a = await SC.renderScore(p1, E), b = await SC.renderScore(SC.compile(SC.phonemize("we see the sea"), { f0: 110 }), E);
    const da = a.getChannelData(0), db = b.getChannelData(0); let md = 0; for (let i = 0; i < da.length; i++) md = Math.max(md, Math.abs(da[i] - db[i])); let nan = 0, pk = 0; for (const v of da) { if (!isFinite(v)) nan++; pk = Math.max(pk, Math.abs(v)); }
    out.det = { md, nan, pk, dur: a.duration, expected: p1.n * p1.dt + 0.35 };
    const sTok = SC.compile(["S"], {}), iTok = SC.compile(["IY"], {}), sb = (await SC.renderScore(sTok, E)).getChannelData(0), ib = (await SC.renderScore(iTok, E)).getChannelData(0);
    out.sCentroid = spec(sb.subarray(Math.round(0.02 * sr), Math.round(0.12 * sr)), 0, 1e9).centroid; out.iCentroid = spec(ib.subarray(Math.round(0.02 * sr), Math.round(0.12 * sr)), 0, 1e9).centroid;
    const tr = C.trackPitch(Float32Array.from(ib.subarray(0, Math.round(0.14 * sr))), sr), ts = C.trackPitch(Float32Array.from(sb.subarray(0, Math.round(0.14 * sr))), sr);
    out.voiced = { vowel: tr.voicedShare, fric: ts.voicedShare, f0: tr.medianF0 };
    return out;
  });
  console.log(JSON.stringify(R, (k, v) => typeof v === "number" ? +v.toFixed(3) : v));
  assert.deepEqual(R.peak, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "each band key sounds in its own band");
  R.stops.forEach((s, k) => { assert(s.before < s.peak * 0.01, "silent before burst " + k); assert(s.onset >= 0.498 && s.onset <= 0.512, `stop ${k} onset ${s.onset}`); assert(s.decay < 0.15, `stop ${k} decays: ${s.decay}`); });
  assert(R.stops[1].centroid > R.stops[2].centroid && R.stops[2].centroid > R.stops[0].centroid, "centroids T > K > P: " + R.stops.map((s) => Math.round(s.centroid)));
  assert(Math.abs(R.seqOnset - R.seqExpected) <= 0.012, `sequencer burst timing ${R.seqOnset} vs ${R.seqExpected}`);
  console.log("max diff between two renders:", R.det.md); assert(R.det.md < 1e-4, "render is deterministic: " + R.det.md); assert.equal(R.det.nan, 0); assert(R.det.pk > 0.85 && R.det.pk <= 0.9); assert(Math.abs(R.det.dur - R.det.expected) < 0.02);
  assert(R.sCentroid > R.iCentroid * 1.2, "S brighter than IY: " + R.sCentroid + " vs " + R.iCentroid);
  assert(R.voiced.vowel > 0.6 && R.voiced.fric < 0.35, "vowel buzzy, S hissy " + JSON.stringify(R.voiced)); assert(Math.abs(R.voiced.f0 - 123) < 14, "pitch near contour start " + R.voiced.f0);

  // UI: type phrase, edit a cell, speak, live keys, phone overflow
  await page.fill("#txt", "see the sea"); await page.waitForFunction(() => window.__tv.S.score.tokens.join(" ").startsWith("S IY _ DH"));
  assert.equal(await page.inputValue("#ph"), "S IY _ DH AH _ S IY");
  await page.fill("#ph", "T AA K"); await page.waitForFunction(() => window.__tv.S.score.tokens.join(" ") === "T AA K");
  const h0 = await page.evaluate(() => window.__tv.SC.hash(window.__tv.S.score));
  const box = await page.$eval("#rc", (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.click(box.x + 8 * 5 + 3, box.y + 44 + 9 * 18 + 9); // col 5, band key 0 row (index 9 from top)
  const h1 = await page.evaluate(() => window.__tv.SC.hash(window.__tv.S.score)); assert.notEqual(h0, h1, "clicking a cell edits the score");
  const r0 = await page.evaluate(() => window.__tvRendered || 0); await page.click("#speak"); await page.waitForFunction((n) => (window.__tvRendered || 0) > n, r0, { timeout: 30000 });
  assert.equal(await page.getAttribute("#speak", "aria-pressed"), "true"); await page.click("#stop");
  await page.dispatchEvent("#stopkeys .key:nth-child(2)", "pointerdown", { pointerId: 1, isPrimary: true }); assert((await page.getAttribute("#stopkeys .key:nth-child(2)", "class")).includes("on"));
  await page.dispatchEvent("#stopkeys .key:nth-child(2)", "pointerup", { pointerId: 1 });
  await page.click("#wrist"); assert.equal(await page.getAttribute("#wrist", "aria-pressed"), "true");
  await page.screenshot({ path: path.join(shots, "shot-dark.png"), fullPage: true });
  const ph = await (await browser.newContext({ viewport: { width: 400, height: 900 }, colorScheme: "light" })).newPage();
  await ph.goto(`http://127.0.0.1:${server.address().port}/`); await ph.waitForFunction(() => window.__tvReady); await ph.screenshot({ path: path.join(shots, "shot-phone.png"), fullPage: true });
  assert((await ph.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, "no horizontal overflow");
  assert.equal(errs.length, 0, errs.join("\n"));
  console.log("talking voder browser tests ok; save button:", !!(await page.$("#dl")));
  await browser.close(); server.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
