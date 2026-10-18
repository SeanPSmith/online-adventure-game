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
  "light.sunlit": { id: "light.sunlit", slot: "lighting", label: "Golden Hour", free: true, published: true, layoutVersion: "living-book.1" },
  "light.amber": { id: "light.amber", slot: "lighting", label: "Amber Study", free: true, published: true, layoutVersion: "living-book.1" },
  "light.moonlit": { id: "light.moonlit", slot: "lighting", label: "Moonlit Desk", free: true, published: true, layoutVersion: "living-book.1" },
} as const;

/** Flat 4D image already contains physical props; those cannot be separately equipped yet. */
export const SCENE_COMPOSITING = {
  layoutVersion: "living-book.1",
  imageWidth: 1672, imageHeight: 941,
  cleanPlateAvailable: false,
  bakedProps: true,
  contentSafeZones: {
    left: { x: 0.225, y: 0.355, width: 0.233, height: 0.47 },
    right: { x: 0.55, y: 0.355, width: 0.235, height: 0.47 },
  },
} as const;

export type SlotSelection = Partial<Record<CosmeticSlot, string>>;
export type ItemSource = Partial<Record<CosmeticSlot, "world" | "mine">>;

export const FREE_DEFAULTS: Readonly<SlotSelection> = {
  environment: "environment.sunlit-desk", book_shell: "book.ivory-leather",
  paper_material: "paper.ivory", ink_style: "ink.sepia", typography: "type.literary",
  ornaments: "ornament.botanical", lighting: "light.sunlit",
};

export const PREVIEW_WORLDS: Readonly<Record<string, { name: string; recommendation: SlotSelection }>> = {
  brighter: { name: "Brighter World", recommendation: { ...FREE_DEFAULTS, lighting: "light.sunlit" } },
  lantern: { name: "Amber Library", recommendation: { ...FREE_DEFAULTS, lighting: "light.amber" } },
  moonlit: { name: "Moonlit Folio", recommendation: { ...FREE_DEFAULTS, lighting: "light.moonlit" } },
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
