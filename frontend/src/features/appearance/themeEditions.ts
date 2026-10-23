/** Pass 64.3B — curated, presentation-only tabletop editions.
 * All media/fonts are resolved from static allowlists shipped with the app.
 * This is deliberately independent of V1 locally installed palettes and of
 * future paid-skin entitlements. Never interpret a theme ID as ownership.
 */
export const EDITION_FAMILIES = [
  'brighter-world', 'leatherbound', 'garden-table',
  'starward-folio', 'ink-and-ash', 'bloodmoon-manuscript',
] as const;
export type EditionFamily = typeof EDITION_FAMILIES[number];
export type EditionLighting = 'day' | 'night' | 'system';
export type ResolvedLighting = Exclude<EditionLighting, 'system'>;
export type EditionArt = 'watercolor' | 'illuminated' | 'botanical' | 'technical' | 'charcoal' | 'gothic';
export type EditionTypography = 'literary' | 'classical' | 'handwritten-accent' | 'technical' | 'field-notes' | 'gothic';
export type TabletopKind = 'sunlit-desk' | 'candlelit-oak' | 'garden-table' | 'starship-desk' | 'weathered-map' | 'midnight-vellum';
export type PaperKind = 'ivory' | 'parchment' | 'botanical' | 'console' | 'field-paper' | 'vellum';
export interface EditionColors {
  paper: string; ink: string; muted: string; accent: string; accentText: string;
  desk: string; binding: string; frame: string;
}
export interface ThemeEdition {
  /** Legacy on-disk contract; change only with a backwards-compatible migration. */
  format: 'tales-of-two-theme/v2';
  id: string;
  family: EditionFamily;
  label: string;
  mode: ResolvedLighting;
  tabletop: TabletopKind;
  paper: PaperKind;
  typography: EditionTypography;
  artDirection: EditionArt;
  ornament: 'botanical' | 'compass' | 'circuit' | 'etched' | 'thorns';
  colors: Readonly<EditionColors>;
  /** Static bundled references only, not remote URLs supplied by JSON. */
  tabletopAsset: string;
  sceneAsset: string;
}
const PALETTE: Record<EditionFamily, Record<ResolvedLighting, EditionColors>> = {
  'brighter-world': {
    day: {paper:'#faf3e8',ink:'#32271d',muted:'#665241',accent:'#6e342a',accentText:'#fff7e9',desk:'#d7c2a4',binding:'#72513a',frame:'#9e8061'},
    night: {paper:'#2c2929',ink:'#f2e8dc',muted:'#d1c4b5',accent:'#e2b985',accentText:'#241a19',desk:'#1b2024',binding:'#211b1c',frame:'#9a7c64'},
  },
  leatherbound: {
    day: {paper:'#f0dfbf',ink:'#322216',muted:'#71533e',accent:'#703e23',accentText:'#fff3dc',desk:'#5b3d2a',binding:'#3d281e',frame:'#a98a54'},
    night: {paper:'#342820',ink:'#f3dfbd',muted:'#d3bb98',accent:'#d7ab6b',accentText:'#2d1d12',desk:'#17120f',binding:'#20140e',frame:'#b39162'},
  },
  'garden-table': {
    day: {paper:'#fbf5e6',ink:'#28362b',muted:'#4c6552',accent:'#315b42',accentText:'#fffbea',desk:'#b0a77d',binding:'#6a6a40',frame:'#77946c'},
    night: {paper:'#23362e',ink:'#f0f0d7',muted:'#c6d6b7',accent:'#c6d38d',accentText:'#233025',desk:'#111b18',binding:'#17251e',frame:'#749875'},
  },
  'starward-folio': {
    day: {paper:'#edf5f6',ink:'#162c38',muted:'#47606d',accent:'#165d75',accentText:'#f7feff',desk:'#8ca8b8',binding:'#1c3441',frame:'#4c899d'},
    night: {paper:'#0f2637',ink:'#e0f4fb',muted:'#b0d0dc',accent:'#67c2e0',accentText:'#09202c',desk:'#07121d',binding:'#091a2b',frame:'#3786a1'},
  },
  'ink-and-ash': {
    day: {paper:'#ebe3d3',ink:'#2b2926',muted:'#5a5149',accent:'#594135',accentText:'#faf1e0',desk:'#827567',binding:'#363029',frame:'#887363'},
    night: {paper:'#302d2c',ink:'#f1e8d9',muted:'#cec2ae',accent:'#d4b294',accentText:'#271f19',desk:'#161718',binding:'#201c1c',frame:'#8b8176'},
  },
  'bloodmoon-manuscript': {
    day: {paper:'#eee2de',ink:'#38242d',muted:'#70515b',accent:'#79354a',accentText:'#fff5f3',desk:'#79616b',binding:'#34222a',frame:'#9d6573'},
    night: {paper:'#291a24',ink:'#f8e7e6',muted:'#d5b8c1',accent:'#df9ba8',accentText:'#311621',desk:'#100d13',binding:'#1a1018',frame:'#8e4758'},
  },
};
const CONFIG = {
  'brighter-world': {label:'Brighter World',tabletop:'sunlit-desk',paper:'ivory',typography:'literary',artDirection:'watercolor',ornament:'botanical',tabletopAsset:'/art/pass64/brighter-desk.webp',sceneAsset:'/art/pass64/brighter-vista.webp'},
  leatherbound: {label:'Leatherbound Classic',tabletop:'candlelit-oak',paper:'parchment',typography:'classical',artDirection:'illuminated',ornament:'compass',tabletopAsset:'/art/pass64/desk-scene.webp',sceneAsset:'/art/pass64/fantasy.webp'},
  'garden-table': {label:'Garden Table',tabletop:'garden-table',paper:'botanical',typography:'handwritten-accent',artDirection:'botanical',ornament:'botanical',tabletopAsset:'/art/pass64/brighter-desk.webp',sceneAsset:'/art/pass64/brighter-vista.webp'},
  'starward-folio': {label:'Starward Folio',tabletop:'starship-desk',paper:'console',typography:'technical',artDirection:'technical',ornament:'circuit',tabletopAsset:'/art/pass64/desk-wood.webp',sceneAsset:'/art/pass64/scifi.webp'},
  'ink-and-ash': {label:'Ink & Ash',tabletop:'weathered-map',paper:'field-paper',typography:'field-notes',artDirection:'charcoal',ornament:'etched',tabletopAsset:'/art/pass64/desk-scene.webp',sceneAsset:'/art/pass64/explorer.webp'},
  'bloodmoon-manuscript': {label:'Bloodmoon Manuscript',tabletop:'midnight-vellum',paper:'vellum',typography:'gothic',artDirection:'gothic',ornament:'thorns',tabletopAsset:'/art/pass64/desk-scene.webp',sceneAsset:'/art/pass64/horror.webp'},
} as const satisfies Record<EditionFamily, {
  label:string;tabletop:TabletopKind;paper:PaperKind;typography:EditionTypography;
  artDirection:EditionArt;ornament:ThemeEdition['ornament'];tabletopAsset:string;sceneAsset:string;
}>;
export function isEditionFamily(value: unknown): value is EditionFamily {
  return typeof value === 'string' && EDITION_FAMILIES.some((family) => family === value);
}
export function normalizeEditionFamily(raw: unknown): EditionFamily {
  return isEditionFamily(raw) ? raw : 'brighter-world';
}
export function normalizeEditionLighting(raw: unknown): EditionLighting {
  return raw === 'night' || raw === 'system' ? raw : 'day';
}
export function resolveEditionLighting(raw: EditionLighting, systemDark: boolean): ResolvedLighting {
  return raw === 'system' ? (systemDark ? 'night' : 'day') : raw;
}
export function themeEdition(family: EditionFamily, mode: ResolvedLighting): Readonly<ThemeEdition> {
  const c = CONFIG[family];
  return {
    format:'tales-of-two-theme/v2',id:`${family}-${mode}`,family,label:c.label,mode,
    tabletop:c.tabletop,paper:c.paper,typography:c.typography,artDirection:c.artDirection,
    ornament:c.ornament,colors:PALETTE[family][mode],tabletopAsset:c.tabletopAsset,sceneAsset:c.sceneAsset,
  };
}
export const INCLUDED_EDITIONS: readonly ThemeEdition[] = Object.freeze(
  EDITION_FAMILIES.flatMap((family) => [themeEdition(family,'day'),themeEdition(family,'night')]),
);
const FONTS: Record<EditionTypography, { display:string;body:string;notes:string }> = {
  literary:{display:'Georgia, Cambria, serif',body:'Georgia, Cambria, serif',notes:'"Apple Chancery", cursive'},
  classical:{display:'"Palatino Linotype", Georgia, serif',body:'Georgia, serif',notes:'"Apple Chancery", cursive'},
  'handwritten-accent':{display:'Georgia, serif',body:'Georgia, serif',notes:'"Apple Chancery", cursive'},
  technical:{display:'"Trebuchet MS", sans-serif',body:'"Trebuchet MS", sans-serif',notes:'ui-monospace, monospace'},
  'field-notes':{display:'Georgia, serif',body:'Georgia, serif',notes:'"Courier New", monospace'},
  gothic:{display:'"Palatino Linotype", Georgia, serif',body:'Georgia, serif',notes:'"Apple Chancery", cursive'},
};
/** Only finite known CSS color/font/image strings from our bundled edition registry. */
export function themeEditionCssVars(edition: ThemeEdition): Record<string,string> {
  const c = edition.colors;
  const f = FONTS[edition.typography];
  return {
    '--tot2-paper':c.paper,'--tot2-ink':c.ink,'--tot2-muted':c.muted,
    '--tot2-accent':c.accent,'--tot2-accent-text':c.accentText,
    '--tot2-desk':c.desk,'--tot2-binding':c.binding,'--tot2-frame':c.frame,
    '--tot2-display':f.display,'--tot2-body':f.body,'--tot2-notes':f.notes,
    '--tot2-tabletop-art':`url("${edition.tabletopAsset}")`,
    '--tot2-scene-art':`url("${edition.sceneAsset}")`,
  };
}
/** Stable mapping from existing authoritative world category to a curated Reader edition. */
export function readerEditionFamily(world: 'fantasy'|'starward'|'gothic'): EditionFamily {
  return world === 'starward' ? 'starward-folio' : world === 'gothic' ? 'bloodmoon-manuscript' : 'leatherbound';
}
