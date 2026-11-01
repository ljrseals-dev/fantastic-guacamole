import re, pathlib
r = pathlib.Path(__file__).parent
t = (r / "demo/template.html").read_text()
for k, f in (("CORE", "src/core.js"), ("ENGINE", "src/engine.js"), ("SCORE", "src/score.js")):
    t = t.replace("/*%s*/" % k, (r / f).read_text())
(r / "index.html").write_text(t)
a = re.sub(r"<!--DL-->.*?<!--/DL-->", "", t, flags=re.S)
a = re.sub(r"/\*DL\*/.*?/\*/DL\*/", "", a, flags=re.S)
(r / "artifact.html").write_text(a)
print(len(t), len(a), "a.download" in a)
