import { useEffect, useMemo, useState } from "react";
import { TerminalSelect } from "../../components/ui/TerminalSelect";
import {
  CATALOG, DEMO_OWNED, PREVIEW_WORLDS, SCENE_COMPOSITING, FREE_DEFAULTS, sceneRectStyle,
  resolveScene, resolvedLighting,
  type AppearanceMode, type LightingId,
} from "../../features/cosmetics/environmentCatalog";
import "./spaceLab.css";

type Props = { onLightingChange: (id: LightingId) => void };
const MODE_CHOICES: { id: AppearanceMode; title: string; detail: string }[] = [
  { id: "follow_world", title: "Follow the World", detail: "Use the adventure's suggested atmosphere" },
  { id: "my_setup", title: "My Setup", detail: "Keep your favorite reading atmosphere" },
  { id: "custom_mix", title: "Custom Mix", detail: "Choose which slots follow the world" },
];
const LIGHTS: { id: LightingId; label: string }[] = [
  { id: "light.sunlit", label: "Golden Hour" },
  { id: "light.amber", label: "Amber Study" },
  { id: "light.moonlit", label: "Moonlit Desk" },
];

// Preview only: no state writes, purchases, auth mutations or gameplay effects.
export function SpaceLab({ onLightingChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [mode, setMode] = useState<AppearanceMode>("follow_world");
  const [worldId, setWorldId] = useState("brighter");
  const [myLighting, setMyLighting] = useState<LightingId>("light.amber");
  const [myLeft, setMyLeft] = useState("prop.left.seal-photo");
  const [myRight, setMyRight] = useState("prop.right.compass-photo");
  const [followForProps, setFollowForProps] = useState<"world" | "mine">("mine");
  const [followForLight, setFollowForLight] = useState<"world" | "mine">("mine");
  const result = useMemo(() => resolveScene({
    mode,
    world: PREVIEW_WORLDS[worldId].recommendation,
    mine: { ...FREE_DEFAULTS, lighting: myLighting, prop_left: myLeft, prop_right: myRight },
    slotSource: { lighting: followForLight, prop_left: followForProps, prop_right: followForProps },
    owned: DEMO_OWNED,
  }), [mode, worldId, myLighting, myLeft, myRight, followForLight, followForProps]);
  const light = resolvedLighting(result);

  useEffect(() => onLightingChange(light), [onLightingChange, light]);
  useEffect(() => {
    if (!isOpen) return;
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [isOpen]);

  return (
    <>
      <div className="space-scene-plane" aria-hidden="true">
        {(["prop_left", "prop_right"] as const).map((slot) => {
          const item = result[slot].item;
          if (!item?.asset || !item.anchorId) return null;
          const anchor = SCENE_COMPOSITING.propAnchors[item.anchorId];
          return <img className={`space-overlay-prop space-overlay-${slot} ${item.material === "photographic-alpha" ? "is-photographic" : "is-illustrated"}`} key={`${slot}:${item.id}`} src={item.asset} alt="" style={sceneRectStyle(anchor)} draggable={false}/>;
        })}
        {showZones ? (
          <div className="space-layout-guides">
            <span className="space-spine-guide" style={{left:`${SCENE_COMPOSITING.geometry.spineX * 100}%`}} />
            <span className="space-book-guide" style={sceneRectStyle(SCENE_COMPOSITING.geometry.book)} />
            <div className="space-safe-space space-safe-left" style={sceneRectStyle(SCENE_COMPOSITING.contentSafeZones.left)}>Left ink area</div>
            <div className="space-safe-space space-safe-right" style={sceneRectStyle(SCENE_COMPOSITING.contentSafeZones.right)}>Right ink area</div>
          </div>
        ) : null}
      </div>
      <button className="space-workshop-launch" type="button" aria-expanded={isOpen} aria-controls="space-workshop" onClick={() => setIsOpen(!isOpen)}>
        <span aria-hidden="true">✧</span> {isOpen ? "Close the workshop" : "Make this space yours"}
      </button>
      {isOpen ? (
        <aside id="space-workshop" className="space-workshop" aria-label="Environment workshop preview">
          <div className="space-workshop-heading">
            <div><p className="space-kicker">PASS 64.4P · PHOTOGRAPHIC LAYERS</p><h1>My reading space</h1></div>
            <button type="button" aria-label="Close environment workshop" className="space-close" onClick={() => setIsOpen(false)}>×</button>
          </div>
          <p className="space-intro">Make the atmosphere your own. This is a temporary visual preview—not a store or saved account setting.</p>
          <fieldset className="space-mode-fieldset">
            <legend>How should this world look?</legend>
            <div className="space-mode-options">
              {MODE_CHOICES.map((choice) => (
                <label className={`space-mode ${mode === choice.id ? "is-selected" : ""}`} key={choice.id}>
                  <input type="radio" name="space-mode" checked={mode === choice.id} onChange={() => setMode(choice.id)} />
                  <strong>{choice.title}</strong><span>{choice.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-field-row">
            <span className="space-field-label">Preview a world's suggestion</span>
            <TerminalSelect
              ariaLabel="Preview a world's suggestion"
              className="space-world-select"
              value={worldId}
              options={Object.entries(PREVIEW_WORLDS).map(([id, world]) => ({ value: id, label: world.name }))}
              onChange={setWorldId}
            />
          </div>
          <fieldset className="space-palette">
            <legend>My preferred light</legend>
            <div className="space-swatches">
              {LIGHTS.map((choice) => <label key={choice.id} className={`space-swatch ${myLighting === choice.id ? "is-selected" : ""}`}>
                <input type="radio" name="space-light" checked={myLighting === choice.id} onChange={() => setMyLighting(choice.id)} />
                <span className={`space-swatch-dot space-swatch-${choice.id.replace("light.", "")}`} aria-hidden="true" />
                <span>{choice.label}</span>
              </label>)}
            </div>
          </fieldset>
          <fieldset className="space-decor-fieldset">
            <legend>Little things, your way</legend>
            <p className="space-decor-caption">Real transparent photo-cutout accents on calibrated desk anchors. Earlier scene objects remain in the photograph until a clean plate is approved.</p>
            {(["prop_left", "prop_right"] as const).map((slot) => {
              const value = slot === "prop_left" ? myLeft : myRight;
              const setValue = slot === "prop_left" ? setMyLeft : setMyRight;
              return <div className="space-field-row" key={slot}>
                <span className="space-field-label">{slot === "prop_left" ? "Left desk accent" : "Right desk accent"}</span>
                <TerminalSelect
                  ariaLabel={slot === "prop_left" ? "Choose left desk accent" : "Choose right desk accent"}
                  className="space-world-select space-decor-select"
                  value={value}
                  options={Object.values(CATALOG).filter((item) => item.slot === slot).map((item) => ({value:item.id,label:item.label}))}
                  onChange={setValue}
                />
              </div>;
            })}
          </fieldset>
          {mode === "custom_mix" ? (
            <fieldset className="space-source">
              <legend>For lighting, use</legend>
              <label><input type="radio" name="light-source" checked={followForLight === "world"} onChange={() => setFollowForLight("world")} /> World suggestion</label>
              <label><input type="radio" name="light-source" checked={followForLight === "mine"} onChange={() => setFollowForLight("mine")} /> My preferred light</label>
              <span className="space-source-divider">Desk accents</span>
              <label><input type="radio" name="prop-source" checked={followForProps === "world"} onChange={() => setFollowForProps("world")} /> World accents</label>
              <label><input type="radio" name="prop-source" checked={followForProps === "mine"} onChange={() => setFollowForProps("mine")} /> My accents</label>
            </fieldset>
          ) : null}
          <p className="space-resolution" role="status">Now showing: <strong>{result.lighting.item?.label}</strong> <span>({result.lighting.source})</span><span className="space-resolution-props">Accents: {result.prop_left.item?.label} · {result.prop_right.item?.label}</span></p>
          <label className="space-guides"><input type="checkbox" checked={showZones} onChange={(event) => setShowZones(event.target.checked)} /> Show reading-safe zones</label>
          <p className="space-technical">Spine-aligned safe zones use the {SCENE_COMPOSITING.imageWidth} × {SCENE_COMPOSITING.imageHeight} image plate. The photographic accent assets have real alpha and their own shadow layer. The legacy tabletop still contains baked-in objects; those are not individually removable.</p>
          <div className="space-actions">
            <button type="button" onClick={() => {setMode("follow_world");setWorldId("brighter");setMyLighting("light.amber");setFollowForLight("mine");setMyLeft("prop.left.seal-photo");setMyRight("prop.right.compass-photo");setFollowForProps("mine");setShowZones(false);}}>Reset preview</button>
            <button type="button" className="space-done" onClick={() => setIsOpen(false)}>View the book <span aria-hidden="true">↗</span></button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
