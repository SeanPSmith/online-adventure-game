/**
 * Pass 64.4F: deterministic, catalog-only cosmetic preview contracts.
 * No payment, API, localStorage, game-state, arbitrary CSS or third-party assets.
 * Stable IDs can later be backed by authenticated server ownership.
 */
export const COSMETIC_SLOTS = [
  "environment", "book_shell", "paper_material", "prop_left", "prop_right",
  "ink_style", "typography", "ornaments", "lighting",
] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];
export type AppearanceMode = "follow_world" | "my_setup" | "custom_mix";
export type CosmeticSource = "world" | "mine" | "fallback";
export type LightingId = "light.sunlit" | "light.amber" | "light.moonlit";

export type CosmeticItem = Readonly<{
  id: string;
  slot: CosmeticSlot;
  label: string;
  free: boolean;
  published: boolean;
  layoutVersion: "living-book.1";
  asset?: string;
  anchorId?: "desk_left_mid" | "desk_right_lower";
}>;

/** Only catalog-owned same-origin art URLs are ever rendered. */
export function isCatalogAssetPath(path: string): boolean {
  return /^\/art\/[a-z0-9][a-z0-9/_-]*\.(?:webp|png|jpg|jpeg|avif)$/i.test(path) && !path.includes("..") && !path.includes("//");
}

export const CATALOG: Readonly<Record<string, CosmeticItem>> = {
  "environment.sunlit-desk": { id: "environment.sunlit-desk", slot: "environment", label: "Sunlit Writing Desk", free: true, published: true, layoutVersion: "living-book.1", asset: "/art/pass64/pass64-4d-tabletop-book.webp" },
  "book.ivory-leather": { id: "book.ivory-leather", slot: "book_shell", label: "Ivory Leatherbound Book", free: true, published: true, layoutVersion: "living-book.1" },
  "paper.ivory": { id: "paper.ivory", slot: "paper_material", label: "Ivory Watercolor", free: true, published: true, layoutVersion: "living-book.1" },
  "ink.sepia": { id: "ink.sepia", slot: "ink_style", label: "Sepia Ink", free: true, published: true, layoutVersion: "living-book.1" },
  "type.literary": { id: "type.literary", slot: "typography", label: "Literary Serif", free: true, published: true, layoutVersion: "living-book.1" },
  "ornament.botanical": { id: "ornament.botanical", slot: "ornaments", label: "Botanical Marginalia", free: true, published: true, layoutVersion: "living-book.1" },
  // Optional illustrated prop proofs; backgrounds already contain *baked* physical props.
  "prop.left.none": { id: "prop.left.none", slot: "prop_left", label: "No extra ornament", free: true, published: true, layoutVersion: "living-book.1" },
  "prop.left.fern": { id: "prop.left.fern", slot: "prop_left", label: "Pressed Fern", free: true, published: true, layoutVersion: "living-book.1", asset: "/art/pass64/scene-kit/pressed-fern.webp", anchorId: "desk_left_mid" },
  "prop.left.seal": { id: "prop.left.seal", slot: "prop_left", label: "Crimson Wax Seal", free: true, published: true, layoutVersion: "living-book.1", asset: "/art/pass64/scene-kit/wax-seal.webp", anchorId: "desk_left_mid" },
  "prop.right.none": { id: "prop.right.none", slot: "prop_right", label: "No extra ornament", free: true, published: true, layoutVersion: "living-book.1" },
  "prop.right.ink": { id: "prop.right.ink", slot: "prop_right", label: "Ink Bottle", free: true, published: true, layoutVersion: "living-book.1", asset: "/art/pass64/scene-kit/ink-bottle.webp", anchorId: "desk_right_lower" },
  "prop.right.flower": { id: "prop.right.flower", slot: "prop_right", label: "Pressed Wildflowers", free: true, published: true, layoutVersion: "living-book.1", asset: "/art/pass64/scene-kit/wildflowers.webp", anchorId: "desk_right_lower" },
  "light.sunlit": { id: "light.sunlit", slot: "lighting", label: "Golden Hour", free: true, published: true, layoutVersion: "living-book.1" },
  "light.amber": { id: "light.amber", slot: "lighting", label: "Amber Study", free: true, published: true, layoutVersion: "living-book.1" },
  "light.moonlit": { id: "light.moonlit", slot: "lighting", label: "Moonlit Desk", free: true, published: true, layoutVersion: "living-book.1" },
} as const;

/** Flat 4D image already contains physical props; those cannot be separately equipped yet. */
/** Coordinates are normalized to the *full* 1672×941 photographic image,
 * projected through object-fit: cover with center positioning. Each page has
 * an intentionally wider OUTER margin than the gutter-side margin.
 * The studio's guides and visual placement must share this one coordinate source.
 */
export const SCENE_COMPOSITING = {
  layoutVersion: "living-book.1",
  imageWidth: 1672, imageHeight: 941,
  cleanPlateAvailable: false,
  bakedProps: true,
  geometry: {
    book: { x: 0.155, y: 0.193, width: 0.762, height: 0.731 },
    spineX: 0.523,
    leftPage: { x: 0.194, y: 0.230, width: 0.320, height: 0.645 },
    rightPage: { x: 0.535, y: 0.230, width: 0.347, height: 0.645 },
  },
  // Readable *bounding rectangles* are the inner limits for future DOM ink.
  // 64.4I.2: each leaf uses ~11.5% outer and ~6% gutter margin,
  // preserving a protective inset from painted botanicals and binding.
  // This expands the formerly cramped, approx 20% outer margin.
  // Book pages are not identical widths, so normalize their outside and gutter
  // margins as a FRACTION of each actual page instead of matching raw pixels.
  contentSafeZones: {
    left: { x: 0.231, y: 0.250, width: 0.264, height: 0.590 },
    right: { x: 0.556, y: 0.250, width: 0.286, height: 0.590 },
  },
  // Outline polygons are LOCAL percent coordinates within the safe bounding
  // rectangles. These follow subtle photographed paper tapers, not an SVG
  // warp applied to the text: actual HTML paragraphs stay flat and readable.
  contentSafePolygons: {
    left: [[3, 3], [48, 1], [93, 3], [97, 13], [99, 50], [96, 87], [92, 98], [50, 100], [3, 97], [0, 84], [1, 49], [0, 13]],
    right: [[7, 3], [51, 1], [97, 3], [100, 14], [99, 49], [99, 86], [94, 98], [49, 100], [4, 97], [1, 86], [0, 50], [3, 14]],
  },
  propAnchors: {
    desk_left_mid: { x: 0.055, y: 0.520, width: 0.091, height: 0.160 },
    desk_right_lower: { x: 0.923, y: 0.638, width: 0.070, height: 0.163 },
  },
} as const;

export type SceneRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type PageSide = "left" | "right";
/** SVG renderer consumes only fixed, validated scene-owned points. */
export function safeZonePolygonPoints(side: PageSide): string {
  return SCENE_COMPOSITING.contentSafePolygons[side].map(([x, y]) => `${x},${y}`).join(" ");
}

/** Left/right printable margins measured in normalized LOCAL-page units. */
export function pageMarginRatios(side: PageSide): Readonly<{ outer: number; gutter: number }> {
  const p = SCENE_COMPOSITING.geometry[side === "left" ? "leftPage" : "rightPage"];
  const c = SCENE_COMPOSITING.contentSafeZones[side];
  return side === "left"
    ? { outer: (c.x - p.x) / p.width, gutter: (p.x + p.width - c.x - c.width) / p.width }
    : { outer: (p.x + p.width - c.x - c.width) / p.width, gutter: (c.x - p.x) / p.width };
}
/** A single normalized scene projection drives safe-area markers and props. */
export function sceneRectStyle(rect: SceneRect): Readonly<Record<"left" | "top" | "width" | "height", string>> {
  return { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` };
}

export function validatesSpineAlignedSafeZones(): boolean {
  const { geometry: g, contentSafeZones: c } = SCENE_COMPOSITING;
  const le = c.left.x + c.left.width;
  const re = c.right.x + c.right.width;
  const valid = [g.book, g.leftPage, g.rightPage, c.left, c.right, ...Object.values(SCENE_COMPOSITING.propAnchors)];
  const lm = pageMarginRatios("left"), rm = pageMarginRatios("right");
  const polygonsValid = Object.values(SCENE_COMPOSITING.contentSafePolygons).every((points) =>
    points.length >= 8 && points.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100));
  return polygonsValid &&
    Math.abs(lm.outer - rm.outer) < 0.015 && Math.abs(lm.gutter - rm.gutter) < 0.015 &&
    lm.outer > lm.gutter && rm.outer > rm.gutter &&
    valid.every((r) => r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1 && r.y + r.height <= 1) &&
    g.leftPage.x < c.left.x && le < g.spineX && g.spineX < c.right.x && re < g.rightPage.x + g.rightPage.width &&
    // Deliberately bias printable content toward the spine, away from exterior botanicals.
    c.left.x - g.leftPage.x > g.spineX - le &&
    (g.rightPage.x + g.rightPage.width - re) > c.right.x - g.spineX &&
    c.left.y > g.leftPage.y && c.right.y > g.rightPage.y &&
    c.left.y + c.left.height < g.leftPage.y + g.leftPage.height &&
    c.right.y + c.right.height < g.rightPage.y + g.rightPage.height &&
    Object.values(SCENE_COMPOSITING.propAnchors).every((r) =>
      r.x + r.width < g.book.x || r.x > g.book.x + g.book.width);
}

export type SlotSelection = Partial<Record<CosmeticSlot, string>>;
export type ItemSource = Partial<Record<CosmeticSlot, "world" | "mine">>;

export const FREE_DEFAULTS: Readonly<SlotSelection> = {
  environment: "environment.sunlit-desk", book_shell: "book.ivory-leather",
  paper_material: "paper.ivory", ink_style: "ink.sepia", typography: "type.literary",
  ornaments: "ornament.botanical", lighting: "light.sunlit",
  prop_left: "prop.left.none", prop_right: "prop.right.none",
};

export const PREVIEW_WORLDS: Readonly<Record<string, { name: string; recommendation: SlotSelection }>> = {
  brighter: { name: "Brighter World", recommendation: { ...FREE_DEFAULTS, lighting: "light.sunlit" } },
  lantern: { name: "Amber Library", recommendation: { ...FREE_DEFAULTS, lighting: "light.amber", prop_left: "prop.left.seal", prop_right: "prop.right.ink" } },
  moonlit: { name: "Moonlit Folio", recommendation: { ...FREE_DEFAULTS, lighting: "light.moonlit", prop_left: "prop.left.fern", prop_right: "prop.right.flower" } },
};

export type ResolveInput = Readonly<{
  mode: AppearanceMode;
  world: SlotSelection;
  mine: SlotSelection;
  slotSource?: ItemSource;
  overrides?: SlotSelection;
  owned: ReadonlySet<string>;
}>;

export type ResolvedSlot = Readonly<{ item: CosmeticItem | null; source: CosmeticSource }>;
export type ResolvedScene = Readonly<Record<CosmeticSlot, ResolvedSlot>>;

function eligible(id: string | undefined, slot: CosmeticSlot, owned: ReadonlySet<string>): CosmeticItem | null {
  if (!id) return null;
  const item = CATALOG[id];
  if (!item || item.slot !== slot || !item.published || item.layoutVersion !== SCENE_COMPOSITING.layoutVersion) return null;
  if (!item.free && !owned.has(id)) return null;
  if (item.asset && !isCatalogAssetPath(item.asset)) return null;
  return item;
}

export function resolveScene(input: ResolveInput): ResolvedScene {
  const results = {} as Record<CosmeticSlot, ResolvedSlot>;
  for (const slot of COSMETIC_SLOTS) {
    const mine = eligible(input.mine[slot], slot, input.owned);
    const world = eligible(input.world[slot], slot, input.owned);
    const explicit = input.mode === "custom_mix" ? eligible(input.overrides?.[slot], slot, input.owned) : null;
    let selected: CosmeticItem | null = null;
    let source: CosmeticSource = "fallback";
    if (explicit) { selected = explicit; source = "mine"; }
    else if (input.mode === "follow_world" || (input.mode === "custom_mix" && input.slotSource?.[slot] !== "mine")) {
      selected = world; source = selected ? "world" : "fallback";
    } else {
      selected = mine; source = selected ? "mine" : "fallback";
    }
    // A world recommendation and player setup are *suggestions*, not executable theme instructions.
    if (!selected) { selected = eligible(FREE_DEFAULTS[slot], slot, input.owned); source = "fallback"; }
    results[slot] = { item: selected, source };
  }
  return results;
}

export const DEMO_OWNED = new Set(Object.keys(CATALOG).filter((id) => CATALOG[id].free));

export function resolvedLighting(scene: ResolvedScene): LightingId {
  const id = scene.lighting.item?.id;
  return id === "light.amber" || id === "light.moonlit" ? id : "light.sunlit";
}
