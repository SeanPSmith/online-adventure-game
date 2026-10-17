import { useAppearance } from "./AppearanceContext";
import { SKIN_MANIFEST, PLATFORM_SKINS, resolveAppearance, type PlatformSkinId } from "./themeContract";
import "./wardrobe.css";

export function AppearanceWardrobe() {
  const { preferences, updateAppearance } = useAppearance();
  const active = resolveAppearance(preferences, null);
  return <section className="p64-wardrobe" id="wardrobe" aria-labelledby="p64-wardrobe-title">
    <div className="p64-wardrobe-heading"><span className="eyebrow">THE WARDROBE · YOUR PERSONAL EDITION</span>
      <h2 id="p64-wardrobe-title">Dress the story, not the odds.</h2>
      <p>Pick how your library looks. No extra strength, secret rerolls, or suspiciously convenient lightning.</p>
    </div>
    <div className="p64-wardrobe-choices" role="group" aria-label="Choose your library appearance">
      {PLATFORM_SKINS.map((id) => <button key={id} type="button" className={`p64-skin-card ${active.platform === id ? "is-equipped" : ""}`}
        aria-pressed={active.platform === id} onClick={() => updateAppearance({ platformSkin: id as PlatformSkinId })}>
        <span className={`p64-skin-thumbnail is-${id}`} aria-hidden="true"><span className="p64-skin-mini-book">✧</span></span>
        <strong>{SKIN_MANIFEST[id].label}</strong><small>{SKIN_MANIFEST[id].material}</small>
        <span className="p64-skin-status">{active.platform === id ? "EQUIPPED" : "INCLUDED · EQUIP"}</span>
      </button>)}
    </div>
    <fieldset className="p64-wardrobe-reading"><legend>Inside an adventure</legend>
      <label><input type="radio" name="p64-reader-mode" checked={preferences.readerMode === "follow-world"}
        onChange={() => updateAppearance({ readerMode: "follow-world", readerOverride: null })} /> Follow the author's world theme</label>
      <label><input type="radio" name="p64-reader-mode" checked={preferences.readerMode === "plain"}
        onChange={() => updateAppearance({ readerMode: "plain", readerOverride: null })} /> Use a simpler, high-contrast reader</label>
      <label className="p64-wardrobe-motion"><input type="checkbox" checked={preferences.reducedMotion}
        onChange={(event) => updateAppearance({ reducedMotion: event.target.checked })} /> Reduce decorative motion</label>
    </fieldset>
    <p className="p64-wardrobe-footnote">The starter editions are included. Collectible and purchased skins are a future feature; nothing here charges tokens or grants ownership.</p>
  </section>;
}
