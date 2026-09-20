export { scan } from "./scan.js";
export type { Node, FileNode, DirNode, ScanResult, ScanOptions, Metric } from "./scan.js";
export { computeLayout } from "./pack.js";
export type { Laid, LayoutOptions } from "./pack.js";
export { render } from "./render.js";
export type { RenderOptions } from "./render.js";
export { classify } from "./lang.js";

import { scan, ScanOptions } from "./scan.js";
import { computeLayout } from "./pack.js";
import { render, RenderOptions } from "./render.js";

export interface MapOptions extends ScanOptions, RenderOptions {}

// One-shot convenience: scan a directory and return an SVG string.
export function mapRepo(dir: string, opts: MapOptions = {}): string {
  const result = scan(dir, opts);
  const { root } = computeLayout(result.root, { size: opts.size });
  return render(root, { ...opts, title: opts.title ?? result.root.name });
}
