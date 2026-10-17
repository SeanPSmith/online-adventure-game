/** Pass 64.2c: decorative skin manifests, NOT executable CSS or purchase entitlements.
 * Theme packs are local visual presets only. A future marketplace must verify ownership
 * on the backend; local manifests MUST NOT be interpreted as purchased items.
 */
export const THEME_FORMAT = "tales-of-two-theme/v1" as const;
export type ThemeTarget = "library" | "reader";
export type ThemeMaterial = "parchment" | "linen" | "velvet" | "metal";
export type ThemePalette = {
  paper: string; ink: string; muted: string; leather: string;
  accent: string; accentText: string; frame: string; desk: string;
};
export type ThemePack = {
  format: typeof THEME_FORMAT;
  id: string;
  name: string;
  target: ThemeTarget;
  material: ThemeMaterial;
  palette: ThemePalette;
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const PALETTE_KEYS = ["paper", "ink", "muted", "leather", "accent", "accentText", "frame", "desk"] as const;
const MATERIALS = ["parchment", "linen", "velvet", "metal"] as const;
const TARGETS = ["library", "reader"] as const;
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}
export function contrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 0;
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
/** Reject remote links, CSS, unknown keys, insufficient-contrast palettes and abusive payload sizes. */
export function parseThemePack(raw: unknown): ThemePack {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Theme must be a JSON object.");
  const input = raw as Record<string, unknown>;
  if (!exactKeys(input, ["format", "id", "name", "target", "material", "palette"])) throw new Error("Unknown theme fields are not supported.");
  if (input.format !== THEME_FORMAT) throw new Error("Unsupported theme format.");
  if (typeof input.id !== "string" || !ID.test(input.id) || input.id.length > 40) throw new Error("Theme ID must use lowercase letters, numbers and hyphens.");
  if (typeof input.name !== "string" || input.name.trim().length < 3 || input.name.trim().length > 48 || /[<>\x00-\x1f]/.test(input.name)) throw new Error("Theme name must be 3–48 plain-text characters.");
  if (!TARGETS.some((value) => value === input.target)) throw new Error("Choose Library or Reader.");
  if (!MATERIALS.some((value) => value === input.material)) throw new Error("Unknown material.");
  if (!input.palette || typeof input.palette !== "object" || Array.isArray(input.palette)) throw new Error("A palette is required.");
  const palette = input.palette as Record<string, unknown>;
  if (!exactKeys(palette, PALETTE_KEYS)) throw new Error("Unknown palette field.");
  for (const key of PALETTE_KEYS) if (typeof palette[key] !== "string" || !HEX.test(palette[key] as string)) throw new Error(`Invalid ${key} color: use #RRGGBB.`);
  if (contrastRatio(palette.paper as string, palette.ink as string) < 4.5) throw new Error("Paper/ink contrast must be at least 4.5:1.");
  if (contrastRatio(palette.paper as string, palette.muted as string) < 4.5) throw new Error("Secondary ink contrast must be at least 4.5:1.");
  if (contrastRatio(palette.accent as string, palette.accentText as string) < 4.5) throw new Error("Accent/button text contrast must be at least 4.5:1.");
  return {
    format: THEME_FORMAT,
    id: input.id,
    name: input.name.trim(),
    target: input.target as ThemeTarget,
    material: input.material as ThemeMaterial,
    palette: Object.fromEntries(PALETTE_KEYS.map((key) => [key, (palette[key] as string).toLowerCase()])) as ThemePalette,
  };
}
function builtIn(id: string, name: string, target: ThemeTarget, material: ThemeMaterial, colors: string[]): ThemePack {
  return parseThemePack({ format: THEME_FORMAT, id, name, target, material,
    palette: Object.fromEntries(PALETTE_KEYS.map((key, index) => [key, colors[index]])) });
}
export const INCLUDED_PACKS: readonly ThemePack[] = Object.freeze([
  builtIn("ember-cartographer", "Ember Cartographer", "library", "parchment", ["#f2dfb9", "#352019", "#6b4a32", "#3d2319", "#843426", "#fff5de", "#a27a41", "#1c120d"]),
  builtIn("verdant-atlas", "Verdant Atlas", "library", "linen", ["#e4e7ce", "#1d3429", "#446554", "#223e31", "#254c3a", "#fff5d9", "#7b9060", "#101d17"]),
  builtIn("moonlit-archive", "Moonlit Archive", "library", "velvet", ["#d6d9eb", "#1e2547", "#545b84", "#19203d", "#403e7e", "#ffffff", "#8a7db2", "#0e1022"]),
  builtIn("solar-punk", "Solarpunk Folio", "reader", "linen", ["#f7ecc7", "#284039", "#4e695c", "#23362e", "#275b45", "#ffffff", "#b28e52", "#192d23"]),
  builtIn("neon-observatory", "Neon Observatory", "reader", "metal", ["#0d2435", "#e4f8ff", "#abd1e1", "#071725", "#176489", "#ffffff", "#4da8c7", "#07111d"]),
  builtIn("bloodmoon-manuscript", "Bloodmoon Manuscript", "reader", "velvet", ["#281c24", "#ffe6df", "#cbabb0", "#170e15", "#812d42", "#ffffff", "#a56370", "#120b0e"]),
]);
export const INCLUDED_IDS = new Set(INCLUDED_PACKS.map((pack) => pack.id));
export function findTheme(id: string | null | undefined, installed: readonly ThemePack[]): ThemePack | null {
  return [...INCLUDED_PACKS, ...installed].find((pack) => pack.id === id) ?? null;
}
export function importThemeJSON(text: string, installed: readonly ThemePack[]): ThemePack {
  if (text.length > 16_384) throw new Error("Theme file must be under 16 KB.");
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("Not a valid JSON theme file."); }
  const pack = parseThemePack(data);
  if (INCLUDED_IDS.has(pack.id) || installed.some((item) => item.id === pack.id)) throw new Error("That theme ID already exists. Give this copy a new ID.");
  if (installed.length >= 24) throw new Error("Local theme library is full (24 maximum).");
  return pack;
}
/** Serialized packs are intentionally style values only: no JS, arbitrary CSS, images or URLs. */
export function themeCssVars(pack: ThemePack): Record<string, string> {
  return {
    "--tot-paper": pack.palette.paper, "--tot-ink": pack.palette.ink, "--tot-muted": pack.palette.muted,
    "--tot-leather": pack.palette.leather, "--tot-accent": pack.palette.accent,
    "--tot-accent-text": pack.palette.accentText, "--tot-frame": pack.palette.frame,
    "--tot-desk": pack.palette.desk,
  };
}
export function themeFileName(pack: ThemePack): string { return `tales-of-two-${pack.id}.json`; }
