// Deterministic circle-packing layout.
//
// This is a clean-room implementation of the classic front-chain circle
// packing (Wang et al. 2006) plus Welzl's smallest-enclosing-circle, the same
// family of algorithms d3-hierarchy uses. It is intentionally deterministic
// (no random shuffle) so the generated SVG is stable across runs and produces
// minimal git diffs.

import { Node } from "./scan.js";

interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Laid {
  node: Node;
  x: number; // absolute center
  y: number;
  r: number; // true radius (drawing)
  depth: number;
  children: Laid[];
}

const PAD_FRAC = 0.09; // gap between sibling circles, as a fraction of radius

// ---- primitive geometry (Welzl + front-chain) ----

function place(b: Circle, a: Circle, c: Circle): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2) {
    let a2 = a.r + c.r;
    a2 *= a2;
    let b2 = b.r + c.r;
    b2 *= b2;
    if (a2 > b2) {
      const x = (d2 + b2 - a2) / (2 * d2);
      const y = Math.sqrt(Math.max(0, b2 / d2 - x * x));
      c.x = b.x - x * dx - y * dy;
      c.y = b.y - x * dy + y * dx;
    } else {
      const x = (d2 + a2 - b2) / (2 * d2);
      const y = Math.sqrt(Math.max(0, a2 / d2 - x * x));
      c.x = a.x + x * dx - y * dy;
      c.y = a.y + x * dy + y * dx;
    }
  } else {
    c.x = a.x + c.r;
    c.y = a.y;
  }
}

function intersects(a: Circle, b: Circle): boolean {
  const dr = a.r + b.r - 1e-6;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr > 0 && dr * dr > dx * dx + dy * dy;
}

function score(n: FNode): number {
  const a = n._;
  const b = n.next!._;
  const ab = a.r + b.r;
  const dx = (a.x * b.r + b.x * a.r) / ab;
  const dy = (a.y * b.r + b.y * a.r) / ab;
  return dx * dx + dy * dy;
}

class FNode {
  _: Circle;
  next: FNode | null = null;
  previous: FNode | null = null;
  constructor(c: Circle) {
    this._ = c;
  }
}

// Position the given circles (mutating x,y) and return the enclosing radius.
function packSiblings(circles: Circle[]): number {
  const n = circles.length;
  if (n === 0) return 0;

  let a = circles[0];
  a.x = 0;
  a.y = 0;
  if (n <= 1) return a.r;

  let b = circles[1];
  a.x = -b.r;
  b.x = a.r;
  b.y = 0;
  if (n <= 2) return a.r + b.r;

  let c = circles[2];
  place(b, a, c);

  let A = new FNode(a);
  let B = new FNode(b);
  let C = new FNode(c);
  A.next = C.previous = B;
  B.next = A.previous = C;
  C.next = B.previous = A;

  pack: for (let i = 3; i < n; ++i) {
    c = circles[i];
    place(A._, B._, c);
    const Cn = new FNode(c);

    let j = B.next!;
    let k = A.previous!;
    let sj = B._.r;
    let sk = A._.r;
    do {
      if (sj <= sk) {
        if (intersects(j._, Cn._)) {
          B = j;
          A.next = B;
          B.previous = A;
          --i;
          continue pack;
        }
        sj += j._.r;
        j = j.next!;
      } else {
        if (intersects(k._, Cn._)) {
          A = k;
          A.next = B;
          B.previous = A;
          --i;
          continue pack;
        }
        sk += k._.r;
        k = k.previous!;
      }
    } while (j !== k.next);

    Cn.previous = A;
    Cn.next = B;
    A.next = B.previous = Cn;

    A = Cn;
    let aa = score(A);
    let bb: FNode = B;
    let ca: number;
    while ((bb = bb.next!) !== Cn) {
      if ((ca = score(bb)) < aa) {
        A = bb;
        aa = ca;
      }
    }
    B = A.next!;
  }

  // Collect the front chain and enclose it.
  const list: Circle[] = [B._];
  let cc: FNode = B;
  while ((cc = cc.next!) !== B) list.push(cc._);
  const e = enclose(list);
  for (let i = 0; i < n; ++i) {
    const ci = circles[i];
    ci.x -= e.x;
    ci.y -= e.y;
  }
  return e.r;
}

// ---- Welzl smallest enclosing circle (deterministic move-to-front) ----

function enclose(circles: Circle[]): Circle {
  let i = 0;
  const n = circles.length;
  let B: Circle[] = [];
  let e: Circle | null = null;
  while (i < n) {
    const p = circles[i];
    if (e && enclosesWeak(e, p)) {
      ++i;
    } else {
      B = extendBasis(B, p);
      e = encloseBasis(B);
      i = 0;
    }
  }
  return e ?? { x: 0, y: 0, r: 0 };
}

function extendBasis(B: Circle[], p: Circle): Circle[] {
  if (enclosesWeakAll(p, B)) return [p];
  for (let i = 0; i < B.length; ++i) {
    if (enclosesNot(p, B[i]) && enclosesWeakAll(encloseBasis2(B[i], p), B)) {
      return [B[i], p];
    }
  }
  for (let i = 0; i < B.length - 1; ++i) {
    for (let j = i + 1; j < B.length; ++j) {
      if (
        enclosesNot(encloseBasis2(B[i], B[j]), p) &&
        enclosesNot(encloseBasis2(B[i], p), B[j]) &&
        enclosesNot(encloseBasis2(B[j], p), B[i]) &&
        enclosesWeakAll(encloseBasis3(B[i], B[j], p), B)
      ) {
        return [B[i], B[j], p];
      }
    }
  }
  // Fallback (numeric edge cases): keep current basis.
  return B.length ? B : [p];
}

function enclosesNot(a: Circle, b: Circle): boolean {
  const dr = a.r - b.r;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr < 0 || dr * dr < dx * dx + dy * dy;
}

function enclosesWeak(a: Circle, b: Circle): boolean {
  const dr = a.r - b.r + Math.max(a.r, b.r, 1) * 1e-9;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr > 0 && dr * dr > dx * dx + dy * dy;
}

function enclosesWeakAll(a: Circle, B: Circle[]): boolean {
  for (let i = 0; i < B.length; ++i) if (!enclosesWeak(a, B[i])) return false;
  return true;
}

function encloseBasis(B: Circle[]): Circle {
  switch (B.length) {
    case 1:
      return { x: B[0].x, y: B[0].y, r: B[0].r };
    case 2:
      return encloseBasis2(B[0], B[1]);
    default:
      return encloseBasis3(B[0], B[1], B[2]);
  }
}

function encloseBasis2(a: Circle, b: Circle): Circle {
  const x1 = a.x,
    y1 = a.y,
    r1 = a.r,
    x2 = b.x,
    y2 = b.y,
    r2 = b.r;
  const x21 = x2 - x1,
    y21 = y2 - y1,
    r21 = r2 - r1;
  const l = Math.sqrt(x21 * x21 + y21 * y21) || 1;
  return {
    x: (x1 + x2 + (x21 / l) * r21) / 2,
    y: (y1 + y2 + (y21 / l) * r21) / 2,
    r: (l + r1 + r2) / 2,
  };
}

function encloseBasis3(a: Circle, b: Circle, c: Circle): Circle {
  const x1 = a.x,
    y1 = a.y,
    r1 = a.r,
    x2 = b.x,
    y2 = b.y,
    r2 = b.r,
    x3 = c.x,
    y3 = c.y,
    r3 = c.r;
  const a2 = x1 - x2,
    a3 = x1 - x3,
    b2 = y1 - y2,
    b3 = y1 - y3,
    c2 = r2 - r1,
    c3 = r3 - r1,
    d1 = x1 * x1 + y1 * y1 - r1 * r1,
    d2 = d1 - x2 * x2 - y2 * y2 + r2 * r2,
    d3 = d1 - x3 * x3 - y3 * y3 + r3 * r3,
    ab = a3 * b2 - a2 * b3,
    xa = (b2 * d3 - b3 * d2) / (ab * 2) - x1,
    xb = (b3 * c2 - b2 * c3) / ab,
    ya = (a3 * d2 - a2 * d3) / (ab * 2) - y1,
    yb = (a2 * c3 - a3 * c2) / ab,
    A = xb * xb + yb * yb - 1,
    Bq = 2 * (r1 + xa * xb + ya * yb),
    C = xa * xa + ya * ya - r1 * r1,
    r = -(Math.abs(A) > 1e-6 ? (Bq + Math.sqrt(Bq * Bq - 4 * A * C)) / (2 * A) : C / Bq);
  return { x: x1 + xa + xb * r, y: y1 + ya + yb * r, r };
}

// ---- hierarchy layout ----

interface Rel {
  node: Node;
  rx: number; // relative to parent center
  ry: number;
  r: number;
  children: Rel[];
}

function layoutRel(node: Node): Rel {
  if (node.type === "file") {
    return { node, rx: 0, ry: 0, r: Math.sqrt(Math.max(node.size, 1)), children: [] };
  }
  const kids = node.children.map(layoutRel).filter((k) => k.r > 0);
  if (kids.length === 0) {
    return { node, rx: 0, ry: 0, r: 0, children: [] };
  }
  const circles: Circle[] = kids.map((k) => ({ x: 0, y: 0, r: k.r * (1 + PAD_FRAC) }));
  const R = packSiblings(circles);
  circles.forEach((c, i) => {
    kids[i].rx = c.x;
    kids[i].ry = c.y;
  });
  return { node, rx: 0, ry: 0, r: R, children: kids };
}

function absolutize(rel: Rel, cx: number, cy: number, depth: number, out: Laid): void {
  out.node = rel.node;
  out.x = cx;
  out.y = cy;
  out.r = rel.r;
  out.depth = depth;
  out.children = [];
  for (const kid of rel.children) {
    const child: Laid = { node: kid.node, x: 0, y: 0, r: 0, depth: 0, children: [] };
    absolutize(kid, cx + kid.rx, cy + kid.ry, depth + 1, child);
    out.children.push(child);
  }
}

export interface LayoutOptions {
  size?: number; // square viewport side (px)
  margin?: number;
}

// Compute an absolute-positioned, scaled layout that fits within a square of
// `size` px. Returns the root Laid node (a dir).
export function computeLayout(root: Node, opts: LayoutOptions = {}): { root: Laid; size: number } {
  const size = opts.size ?? 900;
  const margin = opts.margin ?? 8;
  const rel = layoutRel(root);
  const laid: Laid = { node: root, x: 0, y: 0, r: 0, depth: 0, children: [] };
  absolutize(rel, 0, 0, 0, laid);

  const target = size / 2 - margin;
  const scale = rel.r > 0 ? target / rel.r : 1;
  const cx = size / 2;
  const cy = size / 2;
  const apply = (n: Laid): void => {
    n.x = cx + n.x * scale;
    n.y = cy + n.y * scale;
    n.r = n.r * scale;
    n.children.forEach(apply);
  };
  apply(laid);
  return { root: laid, size };
}
