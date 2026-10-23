import { activeHeroEffects, heroEffectDescription, heroEffectDuration, heroEffectModifiers, heroEffectName, type RawHeroEffect } from "./heroEffects";
import "./heroEffects.css";

/** Shared read-only effect ledger for live Inkbound, Classic, and Hero sheets. */
export function HeroEffectDetails({ effect, compact = false }: { effect: RawHeroEffect; compact?: boolean }) {
  const modifiers = heroEffectModifiers(effect);
  const description = heroEffectDescription(effect);
  return <div className={`qe-effect ${compact ? "qe-effect-compact" : ""}`}>
    <div className="qe-effect-heading">
      <strong>{heroEffectName(effect)}</strong>
      <span className="qe-effect-duration">{heroEffectDuration(effect)}</span>
    </div>
    {modifiers.length > 0 ? <div className="qe-effect-modifiers" aria-label="Effect modifiers">
      {modifiers.map((modifier, index) => <span key={`${modifier}:${index}`}>{modifier}</span>)}
    </div> : null}
    {!compact && description ? <p className="qe-effect-description">{description}</p> : null}
  </div>;
}

export function HeroEffectList({ effects, compact = false, limit, showEmpty = true }: {
  effects: readonly RawHeroEffect[] | null | undefined; compact?: boolean; limit?: number; showEmpty?: boolean;
}) {
  const active = activeHeroEffects(effects);
  const visible = limit == null ? active : active.slice(0, Math.max(0, limit));
  if (!active.length) return showEmpty ? <p className="qe-effect-empty">No active effects.</p> : null;
  return <div className={`qe-effect-list ${compact ? "qe-effect-list-compact" : ""}`}>
    {visible.map((effect, index) => <HeroEffectDetails
      key={`${String(effect.effect_id ?? effect.source_key ?? heroEffectName(effect))}:${index}`}
      effect={effect} compact={compact}
    />)}
    {active.length > visible.length ? <small className="qe-effect-overflow">+{active.length - visible.length} more on your Hero sheet</small> : null}
    {!compact && active.some((effect) => heroEffectModifiers(effect).length > 0) ? (
      <small className="qe-effect-note">Only the strongest matching modifier per effect applies; combined effect bonuses and penalties are capped at ±4 per check.</small>
    ) : null}
  </div>;
}
