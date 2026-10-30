/** Pass 64: cosmetic presentation only. No rewards, dice or server state mutations. */
import { normalizeEditionFamily, normalizeEditionLighting, type EditionFamily, type EditionLighting } from "./themeEditions";

export const PLATFORM_SKINS = ['brighter-world', 'wanderers-desk', 'midnight-codex', 'clear-journal'] as const;
export const WORLD_SKINS = ['fantasy', 'starward', 'gothic'] as const;
export type PlatformSkinId = typeof PLATFORM_SKINS[number];
export type WorldSkinId = typeof WORLD_SKINS[number];
export type ReaderMode = 'follow-world' | 'owned-skin' | 'plain';

export type SkinEntitlement = Readonly<{
  id: string;
  kind: 'platform' | 'reader';
  active: boolean;
}>;

export interface AppearancePreferences {
  platformSkin: PlatformSkinId;
  readerMode: ReaderMode;
  /** Optional choice applies only with a verified entitlement. */
  readerOverride: WorldSkinId | null;
  reducedMotion: boolean;
  /** Presentation edition; not proof of ownership. V1 preferences migrate to the flagship. */
  editionFamily: EditionFamily;
  editionLighting: EditionLighting;
}

export interface WorldAppearanceSource {
  /** Immutable identifier from the authoritative adventure catalog. */
  adventureId?: string | null;
  /** Optional authored metadata; never allow arbitrary CSS/assets from the source. */
  metadata?: unknown;
  title?: string | null;
  tags?: readonly string[] | null;
}

export const DEFAULT_APPEARANCE: Readonly<AppearancePreferences> = Object.freeze({
  platformSkin: 'brighter-world', readerMode: 'follow-world',
  readerOverride: null, reducedMotion: false,
  editionFamily: 'brighter-world', editionLighting: 'day',
});

export const SKIN_MANIFEST = Object.freeze({
  'brighter-world': { label: 'Brighter World', family: 'platform', material: 'sunlit watercolor / ivory / ink', edition: 1 },
  'wanderers-desk': { label: "The Wanderer's Desk", family: 'platform', material: 'oak / paper / brass', edition: 1 },
  'midnight-codex': { label: 'The Midnight Codex', family: 'platform', material: 'ebony / leather / gilt', edition: 1 },
  'clear-journal': { label: 'The Clear Journal', family: 'platform', material: 'accessible high-legibility paper', edition: 1 },
  fantasy: { label: 'Leatherbound', family: 'reader', material: 'parchment / carved leather', edition: 1 },
  starward: { label: 'Starward', family: 'reader', material: 'ship metal / holographic glass', edition: 1 },
  gothic: { label: 'Gothic', family: 'reader', material: 'obsidian / crimson / silver', edition: 1 },
} as const);

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}
export function platformSkinFromUnknown(input: unknown): PlatformSkinId {
  return isOneOf(input, PLATFORM_SKINS) ? input : DEFAULT_APPEARANCE.platformSkin;
}
export function worldSkinFromUnknown(input: unknown): WorldSkinId | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  const aliases: Record<string, WorldSkinId> = {
    fantasy: 'fantasy', leatherbound: 'fantasy', classic: 'fantasy',
    'sci-fi': 'starward', scifi: 'starward', sci_fi: 'starward', starward: 'starward', futuristic: 'starward',
    horror: 'gothic', gothic: 'gothic', haunted: 'gothic', occult: 'gothic',
  };
  return Object.prototype.hasOwnProperty.call(aliases, v) ? aliases[v] : null;
}
export function normalizeAppearance(raw: unknown): AppearancePreferences {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const readerMode: ReaderMode = isOneOf(obj.readerMode, ['follow-world','owned-skin','plain']) ? obj.readerMode : 'follow-world';
  return {
    platformSkin: platformSkinFromUnknown(obj.platformSkin),
    readerMode,
    readerOverride: worldSkinFromUnknown(obj.readerOverride),
    reducedMotion: obj.reducedMotion === true,
    editionFamily: normalizeEditionFamily(obj.editionFamily),
    editionLighting: normalizeEditionLighting(obj.editionLighting),
  };
}
export function worldSkinFromCatalog(source: WorldAppearanceSource | null | undefined): WorldSkinId {
  const metadata = source?.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)
    ? source.metadata as Record<string, unknown> : {};
  // Explicit author intent overrides genre/title guesses. Only allowlisted identifiers are accepted.
  for (const key of ['world_skin','reader_theme','visual_theme']) {
    const match = worldSkinFromUnknown(metadata[key]);
    if (match) return match;
  }
  const hints = [source?.title || '', ...(Array.isArray(source?.tags) ? source.tags : [])].join(' ').toLowerCase();
  if (/sci[ -]?fi|cyber|space|star|cosmic|galaxy|robot|future/.test(hints)) return 'starward';
  if (/horror|gothic|occult|haunt|manor|vampire|noir|curse|shadow/.test(hints)) return 'gothic';
  return 'fantasy';
}
function hasEntitlement(entitlements: readonly SkinEntitlement[], id: string, kind: SkinEntitlement['kind']): boolean {
  return entitlements.some((entry) => entry.active && entry.kind === kind && entry.id === id);
}
/** Three launch skins are included, not purchases. Future paid IDs require verified entitlements.
 *  Keep entitlements a server-origin argument; local storage cannot grant purchases. */
export function resolveAppearance(
  rawPreferences: unknown,
  source: WorldAppearanceSource | null | undefined,
  verifiedEntitlements: readonly SkinEntitlement[] = [],
): Readonly<{ platform: PlatformSkinId; reader: WorldSkinId | 'plain'; worldDefault: WorldSkinId; reducedMotion: boolean }> {
  const prefs = normalizeAppearance(rawPreferences);
  const worldDefault = worldSkinFromCatalog(source);
  const platform: PlatformSkinId = PLATFORM_SKINS.includes(prefs.platformSkin)
    || hasEntitlement(verifiedEntitlements, prefs.platformSkin, 'platform')
    ? prefs.platformSkin : 'brighter-world';
  let reader: WorldSkinId | 'plain' = worldDefault;
  if (prefs.readerMode === 'plain') reader = 'plain';
  if (prefs.readerMode === 'owned-skin' && prefs.readerOverride &&
      hasEntitlement(verifiedEntitlements, prefs.readerOverride, 'reader')) reader = prefs.readerOverride;
  return Object.freeze({ platform, reader, worldDefault, reducedMotion: prefs.reducedMotion });
}
