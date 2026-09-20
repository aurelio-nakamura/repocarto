// Extension -> { language, color }. Colors follow GitHub Linguist conventions
// so the map reads the same way developers already expect on GitHub.
// This is a curated, high-coverage subset (not the full Linguist database) to
// keep repocarto zero-dependency and fast.

export interface Lang {
  language: string;
  color: string;
}

const NEUTRAL = "#b0b7c3";

// Keyed by lowercase extension WITHOUT the leading dot.
const EXT: Record<string, Lang> = {
  // Web / JS ecosystem
  js: { language: "JavaScript", color: "#f1e05a" },
  mjs: { language: "JavaScript", color: "#f1e05a" },
  cjs: { language: "JavaScript", color: "#f1e05a" },
  jsx: { language: "JavaScript", color: "#f1e05a" },
  ts: { language: "TypeScript", color: "#3178c6" },
  tsx: { language: "TypeScript", color: "#3178c6" },
  mts: { language: "TypeScript", color: "#3178c6" },
  cts: { language: "TypeScript", color: "#3178c6" },
  vue: { language: "Vue", color: "#41b883" },
  svelte: { language: "Svelte", color: "#ff3e00" },
  html: { language: "HTML", color: "#e34c26" },
  htm: { language: "HTML", color: "#e34c26" },
  css: { language: "CSS", color: "#563d7c" },
  scss: { language: "SCSS", color: "#c6538c" },
  sass: { language: "Sass", color: "#a53b70" },
  less: { language: "Less", color: "#1d365d" },
  // Systems
  c: { language: "C", color: "#555555" },
  h: { language: "C", color: "#555555" },
  cc: { language: "C++", color: "#f34b7d" },
  cpp: { language: "C++", color: "#f34b7d" },
  cxx: { language: "C++", color: "#f34b7d" },
  hpp: { language: "C++", color: "#f34b7d" },
  hh: { language: "C++", color: "#f34b7d" },
  rs: { language: "Rust", color: "#dea584" },
  go: { language: "Go", color: "#00add8" },
  zig: { language: "Zig", color: "#ec915c" },
  // JVM / .NET
  java: { language: "Java", color: "#b07219" },
  kt: { language: "Kotlin", color: "#a97bff" },
  kts: { language: "Kotlin", color: "#a97bff" },
  scala: { language: "Scala", color: "#c22d40" },
  groovy: { language: "Groovy", color: "#4298b8" },
  cs: { language: "C#", color: "#178600" },
  fs: { language: "F#", color: "#b845fc" },
  // Scripting
  py: { language: "Python", color: "#3572a5" },
  rb: { language: "Ruby", color: "#701516" },
  php: { language: "PHP", color: "#4f5d95" },
  pl: { language: "Perl", color: "#0298c3" },
  lua: { language: "Lua", color: "#000080" },
  r: { language: "R", color: "#198ce7" },
  jl: { language: "Julia", color: "#a270ba" },
  dart: { language: "Dart", color: "#00b4ab" },
  ex: { language: "Elixir", color: "#6e4a7e" },
  exs: { language: "Elixir", color: "#6e4a7e" },
  erl: { language: "Erlang", color: "#b83998" },
  clj: { language: "Clojure", color: "#db5855" },
  hs: { language: "Haskell", color: "#5e5086" },
  ml: { language: "OCaml", color: "#3be133" },
  swift: { language: "Swift", color: "#f05138" },
  m: { language: "Objective-C", color: "#438eff" },
  // Shell / infra
  sh: { language: "Shell", color: "#89e051" },
  bash: { language: "Shell", color: "#89e051" },
  zsh: { language: "Shell", color: "#89e051" },
  fish: { language: "fish", color: "#4aae47" },
  ps1: { language: "PowerShell", color: "#012456" },
  dockerfile: { language: "Dockerfile", color: "#384d54" },
  tf: { language: "HCL", color: "#844fba" },
  hcl: { language: "HCL", color: "#844fba" },
  nix: { language: "Nix", color: "#7e7eff" },
  // Data / config / docs
  json: { language: "JSON", color: "#cbcb41" },
  jsonc: { language: "JSON", color: "#cbcb41" },
  yaml: { language: "YAML", color: "#cb171e" },
  yml: { language: "YAML", color: "#cb171e" },
  toml: { language: "TOML", color: "#9c4221" },
  xml: { language: "XML", color: "#0060ac" },
  ini: { language: "INI", color: "#6d8086" },
  csv: { language: "CSV", color: "#237346" },
  sql: { language: "SQL", color: "#e38c00" },
  graphql: { language: "GraphQL", color: "#e10098" },
  gql: { language: "GraphQL", color: "#e10098" },
  proto: { language: "Protocol Buffer", color: "#c4a000" },
  md: { language: "Markdown", color: "#6a9fb5" },
  mdx: { language: "MDX", color: "#fcb32c" },
  rst: { language: "reStructuredText", color: "#141414" },
  tex: { language: "TeX", color: "#3d6117" },
  txt: { language: "Text", color: "#9aa0a6" },
  // Assets
  svg: { language: "SVG", color: "#ff9900" },
  png: { language: "Image", color: "#a074c4" },
  jpg: { language: "Image", color: "#a074c4" },
  jpeg: { language: "Image", color: "#a074c4" },
  gif: { language: "Image", color: "#a074c4" },
  webp: { language: "Image", color: "#a074c4" },
  ico: { language: "Image", color: "#a074c4" },
  woff: { language: "Font", color: "#d0a0ff" },
  woff2: { language: "Font", color: "#d0a0ff" },
  ttf: { language: "Font", color: "#d0a0ff" },
};

// Files identified by exact name (no useful extension).
const NAMES: Record<string, Lang> = {
  dockerfile: { language: "Dockerfile", color: "#384d54" },
  makefile: { language: "Makefile", color: "#427819" },
  "cmakelists.txt": { language: "CMake", color: "#da3434" },
  ".gitignore": { language: "Git", color: "#f14e32" },
  ".gitattributes": { language: "Git", color: "#f14e32" },
  "license": { language: "License", color: "#cccccc" },
  "license.md": { language: "License", color: "#cccccc" },
};

export function classify(fileName: string): Lang {
  const lower = fileName.toLowerCase();
  if (NAMES[lower]) return NAMES[lower];
  const dot = lower.lastIndexOf(".");
  if (dot > 0) {
    const ext = lower.slice(dot + 1);
    if (EXT[ext]) return EXT[ext];
  }
  // Extensionless or unknown
  return { language: "Other", color: NEUTRAL };
}

export const OTHER_COLOR = NEUTRAL;
