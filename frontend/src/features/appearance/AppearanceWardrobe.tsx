import { useRef, useState, type ChangeEvent } from "react";
import { useAppearance } from "./AppearanceContext";
import { EDITION_FAMILIES, themeEdition, type EditionFamily } from "./themeEditions";
import "./themeEditions.css";
import { TerminalSelect } from "../../components/ui/TerminalSelect";
import { SKIN_MANIFEST, PLATFORM_SKINS, resolveAppearance, type PlatformSkinId } from "./themeContract";
import { contrastRatio, INCLUDED_PACKS, parseThemePack, THEME_FORMAT, themeFileName, type ThemePack, type ThemePalette, type ThemeTarget, type ThemeMaterial } from "./themePacks";
import "./wardrobe.css";
import "./themeWorkshop.css";

const KEYS: ReadonlyArray<{ key: keyof ThemePalette; label: string }> = [
  { key: "paper", label: "Page surface" }, { key: "ink", label: "Reading ink" },
  { key: "muted", label: "Secondary ink" }, { key: "leather", label: "Binding" },
  { key: "accent", label: "Wax seal / action" }, { key: "accentText", label: "Action lettering" },
  { key: "frame", label: "Metal trim" }, { key: "desk", label: "Surroundings" },
];
const MATERIALS: ThemeMaterial[] = ["parchment", "linen", "velvet", "metal"];
function saveJSON(pack: ThemePack) {
  const blob = new Blob([JSON.stringify(pack, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = themeFileName(pack);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
function slug(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34);
}

export function AppearanceWardrobe() {
  const { preferences, edition, updateAppearance, installedThemes, libraryTheme, readerTheme, equipTheme, installTheme, removeTheme } = useAppearance();
  const active = resolveAppearance(preferences, null);
  const [workshop, setWorkshop] = useState(false);
  const [name, setName] = useState("My Traveling Journal");
  const [target, setTarget] = useState<ThemeTarget>("library");
  const [material, setMaterial] = useState<ThemeMaterial>("parchment");
  const [palette, setPalette] = useState<ThemePalette>(() => ({ ...INCLUDED_PACKS[0].palette }));
  const [feedback, setFeedback] = useState("");
  const filePicker = useRef<HTMLInputElement>(null);
  const packs = [...INCLUDED_PACKS, ...installedThemes];
  function makePack(): ThemePack {
    const suffix = slug(name);
    const id = `my-${suffix || "theme"}`;
    return parseThemePack({ format: THEME_FORMAT, id, name, target, material, palette });
  }
  function createAndInstall() {
    try {
      const pack = installTheme(JSON.stringify(makePack()), true);
      setFeedback(`“${pack.name}” is installed and equipped in this browser.`);
    } catch (e) { setFeedback(e instanceof Error ? e.message : "Couldn't install theme."); }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 16_384) throw new Error("Theme file is too large (16 KB maximum).");
      const pack = installTheme(await file.text());
      setFeedback(`Installed “${pack.name}” locally. Select it below to equip.`);
    } catch (e) { setFeedback(e instanceof Error ? e.message : "Invalid theme file."); }
  }
  return <section className="p64-wardrobe" id="wardrobe" aria-labelledby="p64-wardrobe-title">
    <div className="p64-wardrobe-heading"><span className="eyebrow">THE WARDROBE · YOUR PERSONAL EDITION</span>
      <h2 id="p64-wardrobe-title">Dress the story, not the odds.</h2>
      <p>A good jacket never saved anyone from a dragon. But it does improve the entrance.</p>
    </div>
    <section className="p643b-editions" aria-labelledby="p643b-editions-heading">
      <div className="p643b-editions-head">
        <div><h3 id="p643b-editions-heading">Editions of your library</h3>
          <p>Same stories, different surroundings. The atmosphere is yours to choose.</p></div>
        <div className="p643b-daynight" role="group" aria-label="Tabletop lighting">
          {(["day","night","system"] as const).map(mode => <button key={mode} type="button"
            className={`button ${preferences.editionLighting === mode ? "is-active" : ""}`}
            aria-pressed={preferences.editionLighting === mode}
            onClick={() => updateAppearance({ editionLighting: mode })}>
            {mode === "system" ? "AUTO" : mode === "day" ? "DAY" : "NIGHT"}
          </button>)}
        </div>
      </div>
      <div className="p643b-edition-gallery" role="group" aria-label="Choose your tabletop edition">
        {EDITION_FAMILIES.map((family: EditionFamily) => {
          const preview = themeEdition(family, edition.mode);
          const selected = !libraryTheme && preferences.editionFamily === family;
          return <button key={family} type="button" className="p643b-edition-card" aria-pressed={selected}
            onClick={() => { equipTheme(null, "library"); updateAppearance({ editionFamily: family, platformSkin: "brighter-world" }); }}>
            <span className="p643b-edition-art" style={{ backgroundColor: preview.colors.desk, backgroundImage: `linear-gradient(0deg, ${preview.colors.desk}cc, transparent), url("${preview.sceneAsset}")` }} aria-hidden="true">
              <span style={{ background: preview.colors.paper, color: preview.colors.ink, borderColor: preview.colors.frame }}>Aa</span>
            </span>
            <strong>{preview.label}</strong><small>{preview.mode === "day" ? "Daylight edition" : "After-dark edition"} · {preview.paper}</small>
            <span className="p643b-edition-state">{selected ? "EQUIPPED" : "PREVIEW & EQUIP"}</span>
          </button>;
        })}
      </div>
      <p className="p643b-edition-hint">Day and Night change lighting, inks and paper—not your Heroes, worlds or dice. Auto follows your device. Your earlier JSON palettes remain available below.</p>
    </section>
    <h3 className="p64-theme-section-title">Original bindings</h3>
    <div className="p64-wardrobe-choices" role="group" aria-label="Choose your original library appearance">
      {PLATFORM_SKINS.map((id) => <button key={id} type="button" className={`p64-skin-card ${!libraryTheme && active.platform === id ? "is-equipped" : ""}`}
        aria-pressed={!libraryTheme && active.platform === id} onClick={() => { equipTheme(null, "library"); updateAppearance({ platformSkin: id as PlatformSkinId }); }}>
        <span className={`p64-skin-thumbnail is-${id}`} aria-hidden="true"><span className="p64-skin-mini-book">✧</span></span>
        <strong>{SKIN_MANIFEST[id].label}</strong><small>{SKIN_MANIFEST[id].material}</small>
        <span className="p64-skin-status">{!libraryTheme && active.platform === id ? "EQUIPPED" : "INCLUDED · EQUIP"}</span>
      </button>)}
    </div>
    <h3 className="p64-theme-section-title">The Skin Collection</h3>
    <p className="p64-theme-hint">Included editions and your own installed designs. Library skins dress the desk; Reader skins change the pages inside an adventure.</p>
    <div className="p64-theme-collection">
      {packs.map((pack) => {
        const equipped = (pack.target === "library" ? libraryTheme?.id : readerTheme?.id) === pack.id;
        const custom = !INCLUDED_PACKS.some((item) => item.id === pack.id);
        return <div className="p64-theme-tile" key={pack.id}>
          <div className="p64-theme-swatch" style={{ background: pack.palette.leather, borderColor: pack.palette.frame }} aria-hidden="true">
            <div style={{ background: pack.palette.paper, color: pack.palette.ink, borderColor: pack.palette.frame }}>✧ <span style={{ background: pack.palette.accent }} /></div>
          </div>
          <strong>{pack.name}</strong><small>{pack.target === "library" ? "Desk & journal" : "Adventure Reader"} · {pack.material}</small>
          <div className="p64-theme-tile-actions">
            <button className="button" type="button" aria-pressed={equipped} onClick={() => { try { equipTheme(equipped ? null : pack.id, pack.target); setFeedback(""); } catch (e) { setFeedback(String(e)); } }}>{equipped ? "UNEQUIP" : "EQUIP"}</button>
            <button className="button button-quiet" type="button" onClick={() => saveJSON(pack)}>EXPORT</button>
            {custom && <button className="button button-quiet" type="button" onClick={() => { try { removeTheme(pack.id); setFeedback(`“${pack.name}” removed from this browser.`); } catch (e) { setFeedback(String(e)); } }}>REMOVE</button>}
          </div>
        </div>;
      })}
    </div>
    <fieldset className="p64-wardrobe-reading"><legend>Inside an adventure</legend>
      <label><input type="radio" name="p64-reader-mode" checked={preferences.readerMode === "follow-world"}
        onChange={() => updateAppearance({ readerMode: "follow-world", readerOverride: null })} /> Follow the world's visual style (unless you've equipped a Reader skin above)</label>
      <label><input type="radio" name="p64-reader-mode" checked={preferences.readerMode === "plain"}
        onChange={() => updateAppearance({ readerMode: "plain", readerOverride: null })} /> Use the simpler, high-legibility Reader (overrides cosmetics)</label>
      <label className="p64-wardrobe-motion"><input type="checkbox" checked={preferences.reducedMotion}
        onChange={(event) => updateAppearance({ reducedMotion: event.target.checked })} /> Reduce decorative motion and skip fades</label>
    </fieldset>
    <div className="p64-theme-workshop-header">
      <div><h3>Skin Workshop</h3><p>Paint your own pages. Keep your dice honest.</p></div>
      <div className="p64-theme-workshop-controls">
        <button type="button" className="button" aria-expanded={workshop} onClick={() => setWorkshop(!workshop)}>{workshop ? "CLOSE WORKSHOP" : "DESIGN A SKIN"}</button>
        <button type="button" className="button button-quiet" onClick={() => filePicker.current?.click()}>INSTALL JSON</button>
        <input ref={filePicker} hidden aria-label="Choose a Quillairo theme manifest" type="file" accept=".json,application/json" onChange={(event) => { void importFile(event); }} />
      </div>
    </div>
    {workshop && <div className="p64-theme-workshop" aria-label="Theme creator">
      <div className="p64-theme-fields">
        <label>Edition name<input className="input" maxLength={48} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="p64-theme-select-field">
          <span>Applies to</span>
          <TerminalSelect
            ariaLabel="Theme target"
            className="p64-theme-select"
            value={target}
            options={[{ value: "library", label: "The Library / Desk" }, { value: "reader", label: "Adventure Reader" }]}
            onChange={(value) => {
              const next = value as ThemeTarget;
              setTarget(next);
              const sample = INCLUDED_PACKS.find((pack) => pack.target === next);
              if (sample) {
                setPalette({ ...sample.palette });
                setMaterial(sample.material);
              }
            }}
          />
        </div>
        <div className="p64-theme-select-field">
          <span>Material</span>
          <TerminalSelect
            ariaLabel="Theme material"
            className="p64-theme-select"
            value={material}
            options={MATERIALS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
            onChange={(value) => setMaterial(value as ThemeMaterial)}
          />
        </div>
        <div className="p64-theme-colors">{KEYS.map(({key,label}) => <label key={key}>{label}<input type="color" value={palette[key]} onChange={(e) => setPalette((prev) => ({ ...prev, [key]: e.target.value }))} /></label>)}</div>
        <p className="p64-theme-contrast">Ink: {contrastRatio(palette.paper, palette.ink).toFixed(1)}:1 · Secondary: {contrastRatio(palette.paper, palette.muted).toFixed(1)}:1 · Action: {contrastRatio(palette.accent, palette.accentText).toFixed(1)}:1 (all need 4.5:1)</p>
      </div>
      <div className="p64-theme-live-preview" style={{ background: palette.desk }}>
        <div className="p64-theme-live-binding" style={{background:palette.leather,borderColor:palette.frame}}>
          <article style={{background:palette.paper,color:palette.ink,borderColor:palette.frame}}>
            <small style={{color:palette.muted}}>CHAPTER ONE · THE BEGINNING</small>
            <h4>Something wonderful is probably afoot.</h4>
            <p>The map disagrees with the compass. Naturally, the compass looks very pleased with itself.</p>
            <span className="p64-theme-live-action" style={{background:palette.accent,color:palette.accentText}}>Open the suspicious door →</span>
          </article>
        </div>
      </div>
      <div className="p64-theme-workshop-save"><button type="button" className="button button-primary" onClick={createAndInstall}>INSTALL MY DESIGN</button>
        <button type="button" className="button" onClick={() => { try { saveJSON(makePack()); setFeedback("Theme JSON exported. Import it on another device to use it there."); } catch (e) { setFeedback(e instanceof Error ? e.message : "Invalid theme."); } }}>EXPORT JSON</button></div>
    </div>}
    {feedback && <p role="status" className="p64-theme-feedback">{feedback}</p>}
    <p className="p64-wardrobe-footnote">These packs are cosmetic, stored in this browser for your account. They aren't purchases, don't sync between devices, and can't change RPG mechanics. Export JSON to keep a copy. Future marketplace themes will use server-verified ownership.</p>
  </section>;
}
