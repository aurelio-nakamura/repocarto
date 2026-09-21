import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { scan } from "../dist/scan.js";
import { computeLayout } from "../dist/pack.js";
import { render } from "../dist/render.js";
import { classify } from "../dist/lang.js";
import { mapRepo } from "../dist/index.js";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "repocarto-"));
  mkdirSync(join(dir, "src"));
  mkdirSync(join(dir, "src", "util"));
  mkdirSync(join(dir, "docs"));
  writeFileSync(join(dir, "README.md"), "# hi\nsome text\n");
  writeFileSync(join(dir, "package.json"), "{}\n");
  writeFileSync(join(dir, "src", "index.ts"), "export const a = 1;\n".repeat(20));
  writeFileSync(join(dir, "src", "app.ts"), "const x = 2;\n".repeat(50));
  writeFileSync(join(dir, "src", "util", "helper.ts"), "export function h(){}\n".repeat(10));
  writeFileSync(join(dir, "docs", "guide.md"), "text\n".repeat(30));
  return dir;
}

test("scanning a non-git directory emits no git noise on stderr", () => {
  // Regression: `git ls-files` on a non-git dir used to leak
  // "fatal: not a git repository" to the user's terminal before the
  // filesystem-walk fallback. Its stderr must be silenced.
  const dir = fixture();
  const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
  try {
    const res = spawnSync(process.execPath, [cli, dir, "-o", join(dir, "out.svg")], {
      encoding: "utf8",
    });
    assert.equal(res.status, 0, "CLI should exit 0 on a non-git dir");
    assert.ok(!/fatal: not a git repository/i.test(res.stderr || ""), "stderr must not leak git errors");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("classify maps known extensions to languages/colors", () => {
  assert.equal(classify("index.ts").language, "TypeScript");
  assert.equal(classify("main.py").language, "Python");
  assert.equal(classify("Dockerfile").language, "Dockerfile");
  assert.equal(classify("weird.xyzzy").language, "Other");
  assert.match(classify("a.rs").color, /^#/);
});

test("scan builds a tree with files and dirs (no-git walk)", () => {
  const dir = fixture();
  try {
    const r = scan(dir, { useGit: false, metric: "loc" });
    assert.equal(r.fileCount, 6);
    assert.equal(r.root.type, "dir");
    const names = r.root.children.map((c) => c.name).sort();
    assert.ok(names.includes("src"));
    assert.ok(names.includes("docs"));
    assert.ok(names.includes("README.md"));
    assert.ok(r.totalValue > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("computeLayout produces circles inside the viewport", () => {
  const dir = fixture();
  try {
    const r = scan(dir, { useGit: false });
    const { root, size } = computeLayout(r.root, { size: 600 });
    assert.equal(size, 600);
    const check = (n) => {
      assert.ok(n.x - n.r >= -1 && n.x + n.r <= size + 1, "x within bounds");
      assert.ok(n.y - n.r >= -1 && n.y + n.r <= size + 1, "y within bounds");
      assert.ok(n.r >= 0);
      n.children.forEach(check);
    };
    check(root);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("render emits valid-looking themeable SVG with watermark", () => {
  const dir = fixture();
  try {
    const svg = mapRepo(dir, { useGit: false, size: 500 });
    assert.match(svg, /^<svg /);
    assert.match(svg, /<\/svg>$/);
    assert.match(svg, /prefers-color-scheme: dark/);
    assert.match(svg, /repocarto/);
    // Has colored file circles.
    assert.match(svg, /class="fileln"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("layout is deterministic across runs", () => {
  const dir = fixture();
  try {
    const a = mapRepo(dir, { useGit: false });
    const b = mapRepo(dir, { useGit: false });
    assert.equal(a, b);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("exclude drops the named path (e.g. the output SVG) from the scan", () => {
  const dir = fixture();
  try {
    const base = scan(dir, { useGit: false });
    const ex = scan(dir, { useGit: false, exclude: ["docs/guide.md"] });
    assert.equal(ex.fileCount, base.fileCount - 1);
    // The excluded file must not appear anywhere in the tree.
    const names = [];
    (function collect(n) {
      if (n.type === "file") names.push(n.path);
      else n.children.forEach(collect);
    })(ex.root);
    assert.ok(!names.includes("docs/guide.md"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("output written into the tree does not cause churn on the next run", () => {
  const dir = fixture();
  try {
    // Simulate a committed map at docs/map.svg, then re-map excluding it.
    const first = mapRepo(dir, { useGit: false, exclude: ["docs/map.svg"] });
    writeFileSync(join(dir, "docs", "map.svg"), first);
    const second = mapRepo(dir, { useGit: false, exclude: ["docs/map.svg"] });
    assert.equal(first, second);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
