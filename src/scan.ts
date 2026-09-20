import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { classify, Lang } from "./lang.js";

export interface FileNode {
  type: "file";
  name: string;
  path: string; // repo-relative, POSIX separators
  size: number; // value used for area (loc or bytes)
  lang: Lang;
}

export interface DirNode {
  type: "dir";
  name: string;
  path: string;
  children: Node[];
}

export type Node = FileNode | DirNode;

export type Metric = "loc" | "bytes";

export interface ScanOptions {
  metric?: Metric;
  maxFileBytes?: number; // skip reading files larger than this for loc
  useGit?: boolean; // use `git ls-files` when available (default true)
}

const DEFAULT_IGNORES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  "target",
  ".idea",
  ".vscode",
  ".cache",
  "coverage",
  ".turbo",
]);

function isProbablyBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function fileValue(abs: string, metric: Metric, maxFileBytes: number): number {
  let st;
  try {
    st = statSync(abs);
  } catch {
    return 0;
  }
  if (metric === "bytes") return Math.max(st.size, 1);
  // loc
  if (st.size > maxFileBytes) {
    // Too big to read cheaply; approximate lines from bytes.
    return Math.max(Math.round(st.size / 40), 1);
  }
  let buf: Buffer;
  try {
    buf = readFileSync(abs);
  } catch {
    return 1;
  }
  if (buf.length === 0) return 1;
  if (isProbablyBinary(buf)) {
    // Binary asset: give it a small, roughly size-based weight so it appears
    // but does not dominate the map of source code.
    return Math.max(Math.round(buf.length / 200), 1);
  }
  let lines = 1;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) lines++;
  return lines;
}

function gitFiles(root: string): string[] | null {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    const parts = out.toString("utf8").split("\0").filter(Boolean);
    return parts;
  } catch {
    return null;
  }
}

function walk(root: string, dir: string, acc: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".git")) continue;
    if (DEFAULT_IGNORES.has(e.name)) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      walk(root, abs, acc);
    } else if (e.isFile()) {
      acc.push(relative(root, abs).split(sep).join("/"));
    }
  }
}

export interface ScanResult {
  root: DirNode;
  metric: Metric;
  fileCount: number;
  totalValue: number;
}

export function scan(rootDir: string, opts: ScanOptions = {}): ScanResult {
  const metric: Metric = opts.metric ?? "loc";
  const maxFileBytes = opts.maxFileBytes ?? 2 * 1024 * 1024;
  const useGit = opts.useGit ?? true;

  let rel: string[] | null = useGit ? gitFiles(rootDir) : null;
  if (!rel) {
    rel = [];
    walk(rootDir, rootDir, rel);
  }
  // Drop anything under a default-ignored directory (git --others can surface some).
  rel = rel.filter((p) => {
    const segs = p.split("/");
    return !segs.some((s) => DEFAULT_IGNORES.has(s) || s === ".git");
  });

  const root: DirNode = { type: "dir", name: rootName(rootDir), path: "", children: [] };
  const dirIndex = new Map<string, DirNode>();
  dirIndex.set("", root);

  let fileCount = 0;
  let totalValue = 0;

  for (const p of rel) {
    const segs = p.split("/");
    const fileName = segs[segs.length - 1];
    let parentPath = "";
    let parent = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const childPath = parentPath ? parentPath + "/" + segs[i] : segs[i];
      let d = dirIndex.get(childPath);
      if (!d) {
        d = { type: "dir", name: segs[i], path: childPath, children: [] };
        dirIndex.set(childPath, d);
        parent.children.push(d);
      }
      parent = d;
      parentPath = childPath;
    }
    const abs = join(rootDir, ...segs);
    const value = fileValue(abs, metric, maxFileBytes);
    const node: FileNode = {
      type: "file",
      name: fileName,
      path: p,
      size: value,
      lang: classify(fileName),
    };
    parent.children.push(node);
    fileCount++;
    totalValue += value;
  }

  return { root, metric, fileCount, totalValue };
}

function rootName(dir: string): string {
  const parts = dir.split(sep).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : dir;
}
