import { Laid } from "./pack.js";
import { FileNode, Node } from "./scan.js";

export interface RenderOptions {
  size?: number;
  title?: string;
  showLabels?: boolean; // draw top-level directory labels
  legend?: boolean; // draw language legend strip
  link?: string; // attribution link target (used in <title>/watermark)
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectLangTotals(node: Node, acc: Map<string, { color: string; value: number }>): void {
  if (node.type === "file") {
    const e = acc.get(node.lang.language) ?? { color: node.lang.color, value: 0 };
    e.value += node.size;
    acc.set(node.lang.language, e);
    return;
  }
  for (const c of node.children) collectLangTotals(c, acc);
}

export function render(laid: Laid, opts: RenderOptions = {}): string {
  const size = opts.size ?? 900;
  const showLabels = opts.showLabels ?? true;
  const legend = opts.legend ?? true;
  const link = opts.link ?? "https://github.com/aurelio-nakamura/repocarto";
  const title = opts.title ?? laid.node.name;

  const legendH = legend ? 46 : 0;
  const W = size;
  const H = size + legendH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" role="img" aria-label="Codebase map of ${esc(
      title
    )}">`
  );

  // Theme-aware styling: works when the SVG is embedded via <img> because the
  // browser applies prefers-color-scheme when rendering the image.
  parts.push(`<style>
    .bg{fill:#ffffff}
    .frame{stroke:#d0d7de}
    .dir{fill:none;stroke:#d0d7de;stroke-width:1}
    .fileln{stroke:#ffffff;stroke-opacity:.55}
    .txt{fill:#57606a}
    .title{fill:#1f2328}
    .mark{fill:#57606a}
    @media (prefers-color-scheme: dark){
      .bg{fill:#0d1117}
      .frame{stroke:#30363d}
      .dir{stroke:#30363d}
      .fileln{stroke:#0d1117;stroke-opacity:.5}
      .txt{fill:#8b949e}
      .title{fill:#e6edf3}
      .mark{fill:#8b949e}
    }
  </style>`);

  parts.push(`<title>${esc(title)} — codebase map by repocarto</title>`);
  parts.push(`<rect class="bg frame" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8"/>`);

  // Draw directories (outlines) first, deepest last so nesting reads clearly.
  const dirs: Laid[] = [];
  const files: Laid[] = [];
  const collect = (n: Laid) => {
    if (n.node.type === "dir") {
      if (n.depth > 0) dirs.push(n);
      n.children.forEach(collect);
    } else {
      files.push(n);
    }
  };
  collect(laid);

  // Sort dirs by depth so outer rings paint before inner.
  dirs.sort((a, b) => a.depth - b.depth);
  for (const d of dirs) {
    if (d.r < 3) continue;
    parts.push(`<circle class="dir" cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${d.r.toFixed(1)}"/>`);
  }

  // Files.
  for (const f of files) {
    if (f.r < 0.6) continue;
    const fn = f.node as FileNode;
    const sw = f.r > 6 ? 1 : 0.5;
    parts.push(
      `<circle class="fileln" cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" r="${f.r.toFixed(
        1
      )}" fill="${fn.lang.color}" stroke-width="${sw}"><title>${esc(fn.path)}</title></circle>`
    );
  }

  // Top-level directory labels.
  if (showLabels) {
    const top = dirs.filter((d) => d.depth === 1 && d.r > 26);
    for (const d of top) {
      const fs = Math.max(9, Math.min(15, d.r / 3.4));
      const ty = d.y - d.r - 3;
      if (ty < 12) continue;
      parts.push(
        `<text class="txt" x="${d.x.toFixed(1)}" y="${ty.toFixed(
          1
        )}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="600">${esc(d.node.name)}</text>`
      );
    }
  }

  // Title (top-left).
  parts.push(
    `<text class="title" x="14" y="26" font-size="16" font-weight="700">${esc(title)}</text>`
  );

  // Watermark / attribution (drives the discovery loop).
  parts.push(
    `<text class="mark" x="${(W - 12).toFixed(0)}" y="22" text-anchor="end" font-size="12" opacity="0.85">🗺 repocarto</text>`
  );

  // Legend strip.
  if (legend) {
    const totals = new Map<string, { color: string; value: number }>();
    collectLangTotals(laid.node, totals);
    const top = [...totals.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 6);
    let x = 14;
    const y = size + legendH / 2;
    for (const [name, info] of top) {
      parts.push(`<circle cx="${x + 5}" cy="${y}" r="5" fill="${info.color}"/>`);
      parts.push(
        `<text class="txt" x="${x + 15}" y="${y + 4}" font-size="12">${esc(name)}</text>`
      );
      x += 26 + name.length * 7.2;
    }
    parts.push(
      `<text class="mark" x="${(W - 12).toFixed(0)}" y="${(y + 4).toFixed(
        0
      )}" text-anchor="end" font-size="11" opacity="0.8">${esc(link.replace(/^https?:\/\//, ""))}</text>`
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}
