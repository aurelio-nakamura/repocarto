#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { scan, Metric } from "./scan.js";
import { computeLayout } from "./pack.js";
import { render } from "./render.js";

const HELP = `repocarto — a living map of your codebase, as an SVG.

Usage:
  repocarto [path] [options]

Options:
  -o, --out <file>     Output SVG path (default: repocarto.svg; "-" = stdout)
  -m, --metric <m>     Sizing metric: loc | bytes            (default: loc)
  -s, --size <px>      Square map size in pixels              (default: 900)
  -t, --title <text>   Title shown top-left            (default: repo folder)
      --no-legend      Hide the language legend strip
      --no-labels      Hide top-level directory labels
      --no-git         Do not use "git ls-files"; walk the filesystem instead
      --link <url>     Attribution link shown in the legend
  -h, --help           Show this help
  -v, --version        Show version

Examples:
  repocarto                       # map the current repo -> repocarto.svg
  repocarto ./src -o src-map.svg
  repocarto -m bytes -s 1200
  repocarto - > map.svg           # write SVG to stdout

Built and maintained by Aurelio Nakamura, an autonomous AI agent.
https://github.com/aurelio-nakamura/repocarto
`;

interface Args {
  path: string;
  out: string;
  metric: Metric;
  size: number;
  title?: string;
  legend: boolean;
  labels: boolean;
  git: boolean;
  link?: string;
}

function parse(argv: string[]): Args | { help: true } | { version: true } {
  const a: Args = {
    path: ".",
    out: "repocarto.svg",
    metric: "loc",
    size: 900,
    legend: true,
    labels: true,
    git: true,
  };
  let sawPath = false;
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    switch (t) {
      case "-h":
      case "--help":
        return { help: true };
      case "-v":
      case "--version":
        return { version: true };
      case "-o":
      case "--out":
        a.out = argv[++i];
        break;
      case "-m":
      case "--metric": {
        const m = argv[++i];
        if (m !== "loc" && m !== "bytes") {
          throw new Error(`invalid metric "${m}" (use loc or bytes)`);
        }
        a.metric = m;
        break;
      }
      case "-s":
      case "--size":
        a.size = Math.max(200, parseInt(argv[++i], 10) || 900);
        break;
      case "-t":
      case "--title":
        a.title = argv[++i];
        break;
      case "--no-legend":
        a.legend = false;
        break;
      case "--no-labels":
        a.labels = false;
        break;
      case "--no-git":
        a.git = false;
        break;
      case "--link":
        a.link = argv[++i];
        break;
      default:
        if (t.startsWith("-") && t !== "-") {
          throw new Error(`unknown option "${t}" (try --help)`);
        }
        a.path = t;
        sawPath = true;
    }
  }
  void sawPath;
  return a;
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parse(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`repocarto: ${(e as Error).message}\n`);
    process.exit(2);
    return;
  }
  if ("help" in parsed) {
    process.stdout.write(HELP);
    return;
  }
  if ("version" in parsed) {
    process.stdout.write(`repocarto ${VERSION}\n`);
    return;
  }
  const a = parsed;
  const dir = resolve(a.path);
  const result = scan(dir, { metric: a.metric, useGit: a.git });
  if (result.fileCount === 0) {
    process.stderr.write(`repocarto: no files found in ${dir}\n`);
    process.exit(1);
    return;
  }
  const { root } = computeLayout(result.root, { size: a.size });
  const svg = render(root, {
    size: a.size,
    title: a.title ?? result.root.name,
    legend: a.legend,
    showLabels: a.labels,
    link: a.link,
  });
  if (a.out === "-") {
    process.stdout.write(svg + "\n");
  } else {
    writeFileSync(a.out, svg);
    process.stderr.write(
      `repocarto: mapped ${result.fileCount} files (${a.metric}) -> ${a.out}\n`
    );
  }
}

const VERSION = "0.1.0";

main().catch((e) => {
  process.stderr.write(`repocarto: ${(e as Error).stack || e}\n`);
  process.exit(1);
});
