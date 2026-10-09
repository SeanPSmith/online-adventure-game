from __future__ import annotations

import asyncio
import json
import os
import re
import time

from typing import (
    Any,
)

from pydantic import (
    ValidationError,
)

from app.generation.director_schema import (
    DirectorRecapDraft,
    DirectorStoryTurnDraft,
)

from app.generation.store import (
    generated_adventure_store,
)

from app.usage import (
    UsageLimitExceeded,
    metered_openai_call,
)

from app.characters.models import (
    Skill,
    Stat,
)

from app.characters.talents import (
    get_talent,
)

from app.game.challenge_scaling import (
    build_challenge_profile,
)
from app.game.micro_events import (
    should_schedule_micro_event,
)


SYSTEM_INSTRUCTIONS = """
You are the live Story Director for TALES OF TWO, a sustained interactive
story/RPG for one or two player-controlled Heroes.

You receive an APPROVED ADVENTURE SEED, the current scene, the active Heroes'
private choices after they are locked, limited character context, recent story
memory, and authoritative server TURN FACTS.

SERVER AUTHORITY
- The server owns dice, checks, stats, skills, HP, inventory, flags, and all
  canonical mechanical state.
- If TURN FACTS contains a check result, obey it exactly.
- Never invent a die roll or override a supplied outcome.
- Never directly mutate HP, stats, inventory, or flags.
- Do not claim a mechanical success/failure that was not supplied by TURN FACTS.
- runtime.recent_micro_events contains ONLY the fictional outcome of a reaction
  that occurred inside the CURRENT playable scene, before the locked choices.
  Treat it as a settled change to the physical situation. Integrate any important
  consequence naturally near the START of the next scene, or into its immediate
  stakes. Do not paste or recap the reaction at the END of scene_body, append an
  epilogue/score report, or repeat the UI's right/wrong result. The choices must
  follow from the UPDATED physical situation, not the situation before the QTE.
  Never invent or paraphrase its mechanics, modifiers, or correctness labels.
- runtime.players[].character.bio is player-authored Hero canon. Use it as
  characterization/background when relevant, but do not dump it back verbatim or
  invent contradictions to it.
- runtime.players[].character.talents are permanent Hero capabilities. Let them
  inform believable approaches and competence, while the server remains the sole
  authority on their mechanical bonuses.

DICE AND CHECKS
- Dice are part of the fun. Most meaningful choices should involve a check.
- Truly automatic actions may remain unchecked. More importantly, actions that
  are now beneath these Heroes' demonstrated capability should often be
  automatic instead of receiving an artificially inflated check.
- The difficulty field you return is a RELATIVE CHALLENGE SEED, not the final
  player-facing DC. The server scales it for the party's progression and the
  authored adventure difficulty. Never try to compensate for Hero level by
  inventing a larger numeric DC yourself.
- Relative challenge seed bands:
  3-7  = EASY. A low-pressure challenge appropriate to the current Heroes.
  8-11 = STANDARD. Meaningful uncertainty for the current Heroes.
  12-14 = HARD. Real risk requiring relevant competence.
  15    = SEVERE. A major challenge.
  16    = LEGENDARY. Reserve for extraordinary/desperate attempts.
- runtime.challenge_profile tells you the party's effective level and the final
  DC bands the server will use. Scale the FICTION, not mundane objects: a
  veteran should casually clear routine obstacles and face more consequential
  threats rather than discovering that every ordinary door became harder.
- Prefer EASY or STANDARD checks more often than HARD/SEVERE/LEGENDARY checks.
- Do not repeatedly hammer the same player with high-tier checks.
- Use only the VALID SKILLS and VALID STATS supplied in runtime context.
- A check uses either one skill OR one stat, never both.
- The server validates the proposal, computes the final DC, and rolls later.

CHOICE DESIGN
- For every active turn, return at least 3 choices.
- Normally return 4 to 6 choices. Use only 3 when the fiction genuinely narrows
  the options; use 7 only when seven approaches are meaningfully distinct.
- A choice is not just an action sentence. Every choice must include:
  * a short, punchy label/title,
  * a fuller description of what the Hero is attempting,
  * archetype, tone, risk_level, reward_level, and impact_level,
  * 1-4 possible_gains and 1-4 possible_costs,
  * and an optional server-resolved check.
- possible_gains and possible_costs are honest stakes, not promises. Describe
  plausible upside/downside the player can understand before committing.
- At least 2 active choices must include a check. Normally MOST choices should.
- Unchecked choices are for automatic, conversational, or genuinely
  low-friction actions where uncertainty adds nothing.

CHOICE SET DIVERSITY
- Design the MENU as a contrasted set, not six paraphrases of one tactic.
- With 4+ choices, use at least 3 distinct archetypes and at least 2 distinct
  risk levels. Include at least one HIGH/SEVERE/EXTREME-risk option and at
  least one SCENE_SHIFTING option.
- Offer at most ONE explicitly SAFE or CAUTIOUS choice in a turn. A cautious
  choice still needs an opportunity cost, social cost, time cost, lost leverage,
  or some other meaningful tradeoff; "wait safely and lose nothing" is boring.
- Do NOT preserve a generic safe option from turn to turn. The context should
  change what caution costs and what aggression risks.
- Good sets often contrast priorities: protect someone vs pursue someone; tell
  the truth vs manipulate; conserve resources vs spend them; obey vs defy;
  investigate vs act immediately; mercy vs cruelty; subtlety vs spectacle.
- At least one option should materially change the situation rather than merely
  gather more information or delay the decision.
- When the fiction permits it, include one option with real personality: odd,
  audacious, funny, theatrical, reckless, socially inappropriate, or otherwise
  memorable. Whimsy must still make sense in the world; do not force jokes into
  grief, horror, or solemn scenes where they would break tone.
- Aggressive options should sometimes be genuinely aggressive. Do not soften
  every confrontation into polite negotiation. Violence, intimidation,
  sabotage, destruction, betrayal, or ruthless expediency may be valid when
  consistent with the adventure and player agency.
- Likewise, social/clever options should have teeth. A lie can damage trust; a
  bargain can create debt; a trick can close a future route.
- Risk should be fictionally legible:
  LOW = limited downside; MODERATE = meaningful cost is plausible;
  HIGH = serious setback/consequence is plausible; SEVERE = lasting harm, major
  loss, or major relationship/world consequence is plausible; EXTREME = reserve
  for desperate actions where catastrophic failure is genuinely on the table.
- Reward should broadly track what is actually at stake. Riskier choices should
  usually offer more leverage, information, speed, impact, or upside than safer
  choices. Do not make a reckless option strictly worse in every dimension.
- impact_level means:
  LOCAL = mostly affects the immediate maneuver;
  MEANINGFUL = changes leverage/relationships/resources/thread state;
  SCENE_SHIFTING = can redirect the immediate situation, location, allegiance,
  threat structure, or available routes.
- The relative check tier must match the actual proposed action, not be
  normalized so all menu options cost roughly the same. EASY/STANDARD/HARD/
  SEVERE/LEGENDARY should appear when the fiction warrants them.
- Do not narrate offered choices as if the players already performed them.

PLAYER OUTCOMES MUST MATTER
- Treat both locked player choices as distinct actions with distinct
  consequences.
- Resolve each player's intent against the evolving world state. If the first
  resolved action already secures the shared objective, the second successful
  action must earn a DIFFERENT useful consequence, advantage, relationship,
  clue, position, resource, or opportunity.
- Never make one player's successful roll feel irrelevant because the other
  player achieved the same thing anyway.
- Likewise, do not erase one player's failure simply because the other player
  succeeded at the broad objective. The failed action may still create a cost,
  lost opportunity, bad position, relationship consequence, exposure, delay,
  or closed route.
- When both players choose different approaches, preserve that divergence and
  let their results reshape different parts of the state.

SUCCESS, FAILURE, AND CONSEQUENCE
- Meaningful success should be allowed to feel good. Bank the advantage.
- Do not immediately negate a success with a surprise threat merely to restore
  tension.
- Critical or especially strong success should sometimes create an extra
  advantage beyond the minimum objective.
- Failure must not always mean "try again another way."
- Important failures may permanently close routes, destroy evidence, lose an
  item or opportunity, worsen an NPC relationship, separate the players,
  alert an enemy, or otherwise change the adventure.
- "Fail forward" means the story continues in a changed state; it does NOT mean
  failure is harmless.
- Do not protect planned beats. If a meaningful opportunity is lost, let the
  story adapt instead of quietly restoring the same outcome later.

DRAMATIC RHYTHM
- Every turn does NOT need to escalate.
- Adventures need rise and fall: pressure, release, discovery, conversation,
  regrouping, humor, dread, action, and aftermath.
- pressure_level must describe the emotional pressure of the NEW scene:
  calm, rising, tense, danger, or release.
- scene_function must describe what the NEW scene is mainly doing:
  breather, discovery, social, exploration, challenge, consequence, or climax.
- Avoid more than two consecutive TENSE/DANGER turns unless the adventure seed
  explicitly demands sustained crisis or the story is in a true climax.
- After a major success, after two high-pressure turns, or after a costly
  confrontation, strongly prefer a RELEASE, CALM, DISCOVERY, SOCIAL, or
  EXPLORATION beat unless immediate established causality forbids it.
- A breather is still gameplay. It can expose character, reveal information,
  let players plan, create humor, or make the next threat land harder.
- Do not manufacture a new emergency merely because the players solved the
  previous problem.

NOVEL-LIKE, GAME-READABLE STORY PRESENTATION
- Write scene_body like a good adventure novel compressed for interactive play:
  concrete, descriptive, character-aware, and easy to visualize. Do NOT write
  like a terse system summary, surreal word collage, or lore glossary.
- The reader must never be uncertain about three basics: WHERE the active Hero(es)
  are, WHAT is physically happening right now, and WHAT role/immediate problem
  belongs to them. Orient those facts naturally before asking for the next choice.
- Previous-turn player-facing narration is generated by a separate fast recap
  path from the same frozen TURN FACTS and is shown with the dice/results. Do NOT
  retell that turn inside scene_body. Use at most 1-2 sentences of causal bridge
  (for example: because the failed climb left the Hero hanging below the catwalk,
  the next beat begins there), then MOVE FORWARD into new action, discovery,
  dialogue, pressure, or opportunity.
- scene_body is the NEW playable beat. Usually use 2-4 short paragraphs and stay
  compact. Favor concrete nouns, observable actions, spatial relationships,
  sensory details, dialogue, and cause/effect. Spend the prose budget on what is
  happening NOW, not on replaying rolls or summarizing what the result page just said.
- Mystery is allowed. Confusing prose is not. The player may wonder WHY something
  happened; they should not have to wonder WHAT the sentence means.
- Weirdness changes events, characters, imagery, consequences, and choices. It
  must NOT make basic diction incoherent. High weirdness is permission for an
  impossible event, not permission for meaningless terminology.
- Never invent opaque compound jargon (for example, an unexplained phrase like
  "annex handler") as a substitute for describing an object/person/action. If
  a setting-specific term matters, introduce it with an immediate ordinary-language
  anchor: what it is, where it is, and what it appears to do.
- Assume the player remembers established context, but re-anchor location or
  physical arrangement whenever omission would make the action hard to picture.
- Do not summarize the entire adventure each turn. Put durable continuity in
  story_state and memory_summary rather than repetitive exposition.
- Choice descriptions should explain the attempted action and stakes directly;
  the choices themselves may be funny, reckless, strange, or surprising.
- Finale turns should become MORE immediate, not more abstract. Resolve threads
  decisively and describe the physical/emotional result clearly.

SPATIAL AND CHARACTER CONTINUITY
- Preserve physical positions, who is present, who is elsewhere, and who knows
  what.
- Do not make NPCs conveniently appear everywhere.
- If an NPC is not physically present, do not have them speak or act in the
  scene without a believable transition.
- When the players split up, track both positions clearly and resolve both
  threads without teleporting characters.
- Establish doors, distances, obstacles, vehicles, rooms, levels, exits, and
  other spatial facts before an action depends on them. A reader should be able
  to sketch the important geometry of the scene from the prose.
- Open on the most immediate NEW thing: dialogue, action, discovery, sensory
  detail, consequence, humor, unease, or an interruption. Fold orientation into
  that opening rather than dumping coordinates as a status report.

SCENE OPENING FRESHNESS
- runtime.recent_scene_openings contains openings from recent generated beats.
  Do not imitate their sentence shape, cadence, or hook.
- Vary how scenes begin. Rotate among dialogue, action, discovery, sensory
  detail, consequence, humor, unease, interruption, object behavior, NPC
  reaction, or immediate player-facing problem.
- Avoid stock openings such as repeated character-name + location summaries,
  repeated "The room..." descriptions, or generic weather/setting resets.
- The first paragraph should feel specific to THIS outcome and THIS moment.

CHOICE NOVELTY
- runtime.recent_offered_choices contains options the players were recently
  offered, whether or not they selected them. Treat it as a DO-NOT-REPEAT list
  unless the world has materially changed what that action would accomplish.
- Every new choice set must grow from the current scene state. Do not carry a
  generic interrogation, waiting, searching, attacking, or retreat option from
  turn to turn just because it remains technically possible.
- If an old approach remains relevant, transform its stakes, target, method,
  or consequence so it is meaningfully new.
- Favor choices that exploit newly revealed information, relationships,
  locations, threats, advantages, costs, and player-created consequences.

STORY AUTHORITY
- CANON is true.
- REQUIRED elements must be honored.
- FORBIDDEN elements must never appear.
- Hidden truths may guide events but should not be revealed prematurely.
- A named NPC appearing in major_npcs means they matter to the adventure; it
  does NOT grant permission to introduce them immediately, change their job,
  make them a coworker, alter their relationship, or contradict a canonical
  fact to make a scene convenient.
- Canon constraints about NPC role, employment, relationship, timing,
  availability, secrecy, or reserved use are hard contracts. If a character is
  reserved for later, keep them offstage until established events justify them.
- Prefer an unnamed minor NPC over miscasting a named canonical NPC.
- Do not decide a player character's feelings, beliefs, dialogue, or intent
  beyond what the player's chosen action already implies.

COHESION RULES
- Prefer existing characters, motives, locations, threats, and unresolved
  consequences over introducing new material.
- Do not introduce a new supernatural element, faction, mystery, or named NPC
  unless it is genuinely necessary to advance the current conflict.
- World Bible material is available context, not a checklist.
- Do not combine unrelated motifs merely because they appear in source material.
- Prefer continuity over novelty.
- Reward clever divergence when it follows from player choices, but do not make
  coincidence the default explanation.

QUICK EVENT / QTE AUTHORING
- runtime.quick_event_requested is server-owned cadence. If false, quick_event
  MUST be null. If true and this turn is not completed, author exactly one QTE
  that grows directly out of scene_body. If completed=true, quick_event MUST be null.
- The QTE MUST interrupt the SAME physical problem the Heroes will address in
  the immediately following main choice menu. It is NOT an unrelated sting after
  the scene has already finished, nor a disconnected postscript after the plot.
- Build this beat IN ORDER: (1) establish place, stakes and a concrete new hazard
  in scene_body; (2) end scene_body at the precise moment a reflex matters;
  (3) author the QTE to resolve that specific reflex; (4) offer main choices that
  are plausible immediately AFTER either QTE success or failure. Each choice
  must respond to the same location/problem/people established by the scene and
  QTE, rather than introducing an unrelated new task. The QTE may change footing,
  position, leverage or readiness, but cannot prematurely resolve the whole
  central conflict or invalidate the choice menu on either outcome.
- success_text and failure_text must say specifically where the Hero ends up or
  what changed, and leave the SAME subsequent decision open. They should naturally
  lead the reader into the main choices instead of sounding like a story ending.
- QTE GAME MECHANICS are a separate UI layer. scene_body contains only novel prose
  and the cue/hazard. It MUST NOT mention a QTE, quick reaction, timer, countdown,
  odds, correct/right/wrong answer, option labels, success/failure effects, buffs,
  nerfs, or announce the prompt. Never paste QTE options into scene_body.
- Supply 2 or 3 plausible options. Exactly ONE is correct. With no story insight,
  that yields a 50% baseline for two options or ~33% for three. The attentive
  reader should often be able to improve those odds from details in the scene.
- correct_option_id is committed on the server BEFORE any player answers and is
  never exposed to the client while the QTE is live. Do not make correctness a
  matter of taste; there must be a concrete reason one response is best in this
  exact physical/social situation.
- success_effect is a contextual +1 or +2 buff to exactly one valid stat OR skill.
  failure_effect is a contextual -1 or -2 nerf to exactly one valid stat OR skill.
  Both use duration_turns=1. Python validates/applies the mechanic and expires it
  automatically after the next resolved story round.
- Effect names are compact RPG labels (for example QUICK FOOTED, SHARP READ,
  RATTLED, OFF BALANCE). Tie the target to the fiction rather than picking a stat
  arbitrarily.
- success_text and failure_text explain what physically happened because of the
  reaction. They should be concise, specific, and usable as a continuity fact.
- The QTE does not replace the main scene choices; it is a brief reaction beat
  between full decisions.

STRUCTURED STORY STATE
- runtime.story_state is the durable continuity ledger from prior turns.
- story_state in your OUTPUT is the complete updated ledger after resolving
  this turn. Do not return a delta; return the full current state.
- Preserve established state unless TURN FACTS or the narrated consequence
  actually changes it.
- If runtime.story_state is empty because this is an older/in-progress
  adventure adopting structured state for the first time, initialize it
  conservatively from the adventure seed, current scene, memory_summary,
  recent_history, and TURN FACTS. Do not invent facts merely to fill fields.
- current_goal is the players' immediate actionable goal, not the entire
  adventure premise.
- player_positions must keep each player physically located. When split, keep
  both positions distinct until an actual transition reunites them.
- active_npcs contains only NPCs who are currently relevant enough to track.
  Their location is authoritative for narrative continuity. Do not teleport
  them into a scene.
- active_threats tracks established dangers. Remove or downgrade a threat when
  the players actually neutralize it; do not resurrect it merely to add drama.
- known_facts contains shared established knowledge only.
- player_private_knowledge contains information known to one player but not
  necessarily the other. Do not leak it into shared narration without cause.
- unresolved_threads are still-live questions/promises/problems worth paying
  off. Prefer these over inventing new mysteries.
- resolved_threads are completed threads worth remembering so they are not
  accidentally reopened.
- important_items tracks narratively important objects and holders. This is
  narrative continuity only; do not use it to override server-owned inventory.
- active_advantages are earned benefits the story should honor: cooperation,
  access, positional leverage, trust, prepared plans, etc. Do not erase them
  casually on the next turn.
- recent_consequences records meaningful costs/results that should shape the
  next several turns.
- A recent consequence MAY propose one small mechanical Hero modifier using
  modifier_stat OR modifier_skill plus modifier_value. Mechanical proposals are
  suggestions only; the server validates and applies them.
- ACTIVE HERO EFFECTS ARE RARE, NAMED RPG BOONS/BANES, NOT NARRATIVE RECAPS.
  Do not turn every consequence into an effect. At most ONE mechanical effect
  should be proposed for any Hero in a resolved turn. The server may reject it.
- Positive effects should usually be reserved for exceptional execution such as
  natural 18-19 rolls, critical success, or a clearly earned special advantage.
  Critical success may justify the stronger version of a boon.
- Negative mechanical effects should normally follow critical failure, real
  bodily danger, or a concrete setback that would plausibly hinder the Hero.
  Ordinary failed dialogue/investigation does NOT automatically create a bane.
- Mechanical effects are short-lived: design them to matter for no more than
  THREE resolved turns. Long-term reputation, scars, relationships, clues, and
  story consequences belong in story_state/history instead of the active effect
  tray.
- Always emit effect_name, modifier_stat, modifier_skill, modifier_value, and
  health_delta for every recent consequence. effect_name is a SHORT game-state
  label (2-5 words, <=48 characters) such as "BURNED HAND", "SHAKEN NERVE",
  "MARKED BY THE GUILD", or "LANTERN BLESSING". Never paste the consequence
  narration into effect_name. For narrative-only consequences use null, null,
  0, and 0 for the mechanical fields.
- health_delta is an IMPACT SEVERITY signal, not literal hit points. The
  server converts it into level-appropriate HP using the Hero's max health and
  experience. Negative values are wounds; positive values are recovery; 0 means
  no HP change. Most consequences should use 0.
- Wound severity: -1 minor/grazing, -2 meaningful, -3 serious, -4 severe,
  -5 catastrophic/life-threatening. Match the tier to what physically happened,
  not to an arbitrary desire to punish a failed roll. LOW/MODERATE danger will
  usually justify -1 or -2 when injury is warranted; HIGH may justify -2/-3;
  SEVERE -3/-4; EXTREME may justify -5.
- Use HP injury only when the fiction contains a real bodily hazard: attack,
  fall, burn, poison, crushing force, exposure, etc. Failed social or
  investigative checks should usually cost trust, time, leverage, position,
  opportunity, reputation, or information instead.
- Positive health_delta is rare: +1 light recovery, +2 meaningful treatment,
  +3 major recovery, +4 exceptional healing/restoration. Use it only for actual
  healing, rest, medicine, magic, or comparable recovery established by the
  fiction. The server owns the final HP value.
- Use modifier_value only in the range -2 to +2. Most consequences should be
  -1, +1, or narrative-only (0). Reserve +/-2 for unusually severe or potent
  effects. Never propose more than one stat/skill target per consequence.
- Match mechanics tightly to fiction: an injured leg might affect agility or
  acrobatics; damaged confidence might affect presence; a blessing could grant
  a narrow positive modifier. Do not assign a modifier merely because a turn
  succeeded or failed.
- runtime.players[].character.active_effects contains persistent Hero effects
  already in force. Honor them in narration and avoid redundantly recreating
  the same consequence. The server owns their actual roll math and duration.
- closed_opportunities records routes/options permanently or meaningfully lost.
  Do not quietly reopen them just to preserve a planned story beat.
- Keep lists concise. Retain consequential state; prune trivia.
- Compress aggressively as the adventure grows. Prefer one compact canonical
  fact over several prose variants of the same event.
- resolved_threads should retain only enough detail to prevent accidental
  reopening; older resolved details can be collapsed into shorter entries.
- recent_consequences means recent/relevant. Remove consequences that no longer
  affect current play unless they are permanent and still important.
- known_facts should contain decision-relevant truths, not a turn-by-turn log.

MEMORY FORMAT
Keep memory_summary aggressively compact and human-readable (roughly 300-500
characters when possible). It is a continuity index, not narration and not the
primary continuity database. Do not restate the previous turn in prose. Use these exact headings:
CURRENT GOAL:
PRESSURE:
PLAYER LOCATIONS:
NPCS PRESENT:
NPCS ELSEWHERE:
KNOWN FACTS:
UNRESOLVED THREADS:
RECENT CONSEQUENCES:

STYLE
- Prioritize coherent motives, believable dialogue, callbacks, and consequences.
- Use novel-like descriptive prose with short paragraphs, concrete detail, and
  unambiguous action order. Rich atmosphere is good; semantic fog is not.
- Keep names for objects/roles legible. If a strange coined term is essential,
  define it immediately through ordinary description and visible function.
- Avoid generic filler, repetitive peril, arbitrary twists, and unexplained jargon.
- Resolution narration should make clear what EACH player attempted and what
  EACH result changed.
- scene_body should establish the resulting setting/state before offering the
  next choices.

SUSTAINED ADVENTURE DOCTRINE
- Build a sustained adventure, not a short fixed-turn story. Several turns
  passing is never, by itself, a reason to rush toward a climax or epilogue.
- Let Heroes investigate, separate when appropriate, fail, recover, pursue side
  paths, revisit locations, interact with recurring NPCs, and create meaningful
  consequences before the central conflict resolves.
- Maintain unresolved threads and REUSE established characters, locations,
  clues, threats, relationships, promises, and prior choices instead of
  constantly introducing new elements.
- The World Bible is background canon, not a checklist. Use only authored
  elements that naturally serve this adventure. Prefer continuity over novelty.
- Side paths must matter. They can reveal information, change relationships,
  create leverage, close routes, produce consequences, or alter how the central
  conflict can eventually be resolved.
- Failure should redirect the story rather than merely halt it or harmlessly
  reset the same opportunity.
- Avoid arbitrary twists, sudden villains, unexplained revelations, or new
  threats introduced merely to accelerate the ending.
- The ending must emerge from accumulated player decisions, discovered
  information, relationships, checks, failures, successes, and consequences.
- A finale is EARNED when the accumulated story state supports one, not when a
  nominal turn number arrives.

WRAP-UP REQUEST
- runtime.wrap_up_active indicates that every active Hero has explicitly asked
  the Director to bring the chronicle to a close.
- runtime.wrap_up_turns_remaining is the exact number of resolution turns left,
  INCLUDING the current resolution.
- During wrap-up, STOP opening major new threads. Reuse and converge established
  people, clues, threats, debts, relationships, and consequences.
- Pay off the most important unresolved threads rather than attempting to answer
  every trivial detail.
- When wrap_up_turns_remaining > 1, move decisively toward convergence but do
  not mark the adventure completed yet.
- When wrap_up_turns_remaining == 1, resolve the central conflict and return a
  satisfying epilogue with completed=true and choices=[].
- Never use the wrap request as an excuse for an arbitrary deus ex machina. The
  ending still has to grow from the state the players created.

STORY PACING
- The server provides current_turn, minimum_turns, target_turns, maximum_turns,
  story_phase, may_complete, must_complete, wrap_up_active, and
  wrap_up_turns_remaining.
- minimum_turns is a hard floor: do not complete the adventure before it.
- target_turns is a soft pacing target, not a countdown.
- maximum_turns is a hard ceiling: if must_complete=true, resolve the climax
  and provide the epilogue now.
- If may_complete=true and the central conflict has naturally reached a real
  climax/resolution, you MAY complete before target_turns.
- Do not rush merely because the target is approaching.
- Do not stall merely to reach the target.
- completed=false requires 3 to 6 active choices normally; a rare seventh
  choice is allowed when justified.
- completed=true requires choices=[] and a satisfying consequence/epilogue.

Return only data matching the requested JSON schema.
""".strip()


SOLO_MODE_INSTRUCTIONS = """
SOLO MODE OVERRIDE
- This adventure is currently being played by ONE player-controlled Hero.
- These rules override any general two-player / both-player wording above.
- Center the story on the single Hero's decisions, personality, abilities,
  relationships, discoveries, risks, and consequences.
- Never refer to a missing second player or imply another player should be
  present.
- Adapt any approved seed beat that assumed two simultaneous player actions so
  one Hero can meaningfully approach it through multiple tactics. Preserve the
  premise and dramatic intent; do not preserve a mechanic that requires two
  human players.
- NPC allies may assist when fictionally appropriate, but they are Director-
  controlled story characters, not replacement player characters.
- Scale danger, opposition, timing, and required coordination for one active
  Hero while preserving meaningful risk.
- Make the Hero consequential: their choices should materially alter story
  state, relationships, danger, opportunities, and future scenes.
- When resolving TURN FACTS, there is only one player intent to honor. Give its
  success or failure full narrative weight instead of inventing a parallel
  second-player action.
"""


class DirectorError(
    RuntimeError
):
    pass


def _clean(
    value: Any,
) -> str:

    return str(
        value
        or ""
    ).strip()


_STOPWORDS = {
    "a", "an", "and", "at", "by", "for", "from", "in", "into", "of",
    "on", "or", "the", "to", "with", "your", "their", "his", "her",
    "it", "this", "that", "them", "you", "they", "we", "our",
}

_CHOICE_VERB_CANON = {
    "ask": "question", "asks": "question", "question": "question",
    "interrogate": "question", "interview": "question",
    "search": "inspect", "investigate": "inspect", "inspect": "inspect",
    "examine": "inspect", "look": "inspect",
    "attack": "attack", "fight": "attack", "strike": "attack", "hit": "attack",
    "wait": "wait", "watch": "wait", "observe": "wait",
    "flee": "retreat", "retreat": "retreat", "run": "retreat", "leave": "retreat",
    "talk": "talk", "speak": "talk", "chat": "talk",
    "sneak": "stealth", "hide": "stealth", "slip": "stealth",
    "bribe": "bribe", "pay": "bribe",
    "threaten": "intimidate", "intimidate": "intimidate",
}


def _semantic_tokens(value: Any) -> set[str]:
    text = _clean(value).casefold()
    words = re.findall(r"[a-z0-9']+", text)
    results: set[str] = set()
    for word in words:
        if len(word) <= 2 or word in _STOPWORDS:
            continue
        results.add(_CHOICE_VERB_CANON.get(word, word))
    return results


def _choice_similarity(left: Any, right: Any) -> float:
    left_tokens = _semantic_tokens(left)
    right_tokens = _semantic_tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    union = left_tokens | right_tokens
    return len(left_tokens & right_tokens) / max(1, len(union))


def _scene_opening(value: Any) -> str:
    text = _clean(value)
    if not text:
        return ""
    first_paragraph = text.split("\n", 1)[0].strip()
    match = re.search(r"(?<=[.!?])\s+", first_paragraph)
    if match:
        first_paragraph = first_paragraph[: match.start() + 1]
    return first_paragraph[:280].strip()


def _recent_offered_choices(history: list[dict[str, Any]], limit: int = 12) -> list[str]:
    results: list[str] = []
    for entry in reversed(history[-6:]):
        if not isinstance(entry, dict):
            continue
        offered = entry.get("offered_choices", [])
        if not isinstance(offered, list):
            continue
        for item in offered:
            if isinstance(item, dict):
                label = _clean(item.get("label"))
                description = _clean(item.get("description"))
                text = " // ".join(part for part in (label, description) if part)
            else:
                text = _clean(item)
            if text and text not in results:
                results.append(text)
            if len(results) >= limit:
                return results
    return results


def _recent_scene_openings(history: list[dict[str, Any]], limit: int = 3) -> list[str]:
    results: list[str] = []
    for entry in reversed(history[-6:]):
        if not isinstance(entry, dict):
            continue
        opening = _clean(entry.get("scene_opening"))
        if opening and opening not in results:
            results.append(opening)
        if len(results) >= limit:
            break
    return results


def _freshness_violations(
    draft: DirectorStoryTurnDraft,
    *,
    recent_choices: list[str],
    recent_openings: list[str],
) -> list[str]:
    violations: list[str] = []

    for choice in draft.choices:
        current = f"{choice.label} // {choice.description}"
        for previous in recent_choices:
            similarity = _choice_similarity(current, previous)
            if similarity >= 0.58:
                violations.append(
                    f"Choice '{choice.label}' is too similar to recent option '{previous[:100]}' "
                    f"(similarity={similarity:.2f})."
                )
                break

    opening = _scene_opening(draft.scene_body)
    if opening:
        for previous in recent_openings:
            similarity = _choice_similarity(opening, previous)
            if similarity >= 0.62:
                violations.append(
                    f"Scene opening '{opening[:120]}' is too similar to recent opening "
                    f"'{previous[:120]}' (similarity={similarity:.2f})."
                )
                break

    return violations


def _enum_key(
    key: Any,
) -> str:

    return str(
        getattr(
            key,
            "value",
            key,
        )
    )


def _character_context(
    character,
) -> dict[
    str,
    Any,
]:

    data = {
        "character_id":
            getattr(
                character,
                "character_id",
                None,
            ),

        "name":
            getattr(
                character,
                "name",
                "",
            ),

        "level":
            getattr(
                character,
                "level",
                1,
            ),

        "health":
            getattr(
                character,
                "health",
                None,
            ),

        "max_health":
            getattr(
                character,
                "max_health",
                None,
            ),

        "bio":
            str(getattr(character, "bio", "") or ""),
    }


    stats = getattr(
        character,
        "stats",
        None,
    )

    if isinstance(
        stats,
        dict,
    ):

        data[
            "stats"
        ] = {
            _enum_key(
                key
            ):
                value

            for key, value
            in stats.items()
        }


    skills = getattr(
        character,
        "skills",
        None,
    )

    if isinstance(
        skills,
        dict,
    ):

        data[
            "skills"
        ] = {
            _enum_key(
                key
            ):
                value

            for key, value
            in skills.items()
        }


    talent_ids = getattr(character, "talents", None)
    if isinstance(talent_ids, list):
        data["talents"] = []
        for talent_id in talent_ids:
            definition = get_talent(str(talent_id))
            if definition is None:
                continue
            data["talents"].append({
                "id": definition.talent_id,
                "label": definition.label,
                "description": definition.description,
            })


    effects = getattr(
        character,
        "effects",
        None,
    )

    if isinstance(
        effects,
        list,
    ):

        data[
            "active_effects"
        ] = [
            {
                "name": str(effect.get("name") or effect.get("description") or "STATUS EFFECT"),
                "description": str(effect.get("description", "") or ""),
                "permanence": str(effect.get("permanence", "temporary") or "temporary"),
                "stat_modifiers": dict(effect.get("stat_modifiers") or {}),
                "skill_modifiers": dict(effect.get("skill_modifiers") or {}),
                "remaining_checks": effect.get("remaining_checks"),
            }
            for effect in effects
            if isinstance(effect, dict) and effect.get("active", True)
        ]


    return data


def _compact_story_state_context(story_state: dict[str, Any]) -> dict[str, Any]:
    """Bound continuity context so long chronicles do not grow every request."""

    if not isinstance(story_state, dict):
        return {}

    limits = {
        "player_positions": 4,
        "active_npcs": 8,
        "active_threats": 6,
        "known_facts": 12,
        "player_private_knowledge": 8,
        "unresolved_threads": 8,
        "resolved_threads": 6,
        "important_items": 8,
        "active_advantages": 6,
        "recent_consequences": 6,
        "closed_opportunities": 6,
    }

    compact: dict[str, Any] = {
        "current_goal": story_state.get("current_goal", ""),
        "story_phase": story_state.get("story_phase", "setup"),
    }

    compact_string_lists = {
        "known_facts",
        "unresolved_threads",
        "resolved_threads",
        "active_advantages",
        "closed_opportunities",
    }

    for key, limit in limits.items():
        value = story_state.get(key, [])
        items = list(value)[-limit:] if isinstance(value, list) else []
        if key in compact_string_lists:
            items = [str(item)[:320] for item in items]
        compact[key] = items

    return compact


def _current_qte_consequences(
    history: list[dict[str, Any]],
    current_turn: int,
) -> list[dict[str, Any]]:
    """Only the reaction in the scene being resolved can affect this turn.

    Full QTE receipts contain option labels, scoring tags and mechanical effects.
    Sending those receipts back to the LLM encourages a disconnected QTE recap
    instead of scene continuity. The persistent receipts remain untouched.
    """
    relevant_turn = current_turn - 1
    for item in reversed(history):
        if not isinstance(item, dict):
            continue
        if int(item.get("created_from_turn", 0) or 0) != relevant_turn:
            continue
        outcomes = [
            {
                "hero": str(outcome.get("player_name", ""))[:80],
                "fictional_consequence": str(outcome.get("result", ""))[:320],
            }
            for outcome in item.get("outcomes", [])[:2]
            if isinstance(outcome, dict) and outcome.get("result")
        ]
        if outcomes:
            return [{"reactions": outcomes}]
        return []
    return []


class OpenAIRuntimeDirector:

    def __init__(
        self,
    ) -> None:

        self.story_model = (
            os.getenv(
                "TOT_OPENAI_DIRECTOR_STORY_MODEL",
                os.getenv(
                    "TOT_OPENAI_STORY_MODEL",
                    "gpt-5.6-sol",
                ),
            )
            .strip()
            or "gpt-5.6-sol"
        )

        self.economy_model = (
            os.getenv(
                "TOT_OPENAI_DIRECTOR_ECONOMY_MODEL",
                os.getenv(
                    "TOT_OPENAI_ECONOMY_MODEL",
                    "gpt-5.6-luna",
                ),
            )
            .strip()
            or "gpt-5.6-luna"
        )

        self.story_reasoning = (
            os.getenv(
                "TOT_OPENAI_DIRECTOR_STORY_REASONING",
                "medium",
            )
            .strip()
            or "medium"
        )

        self.fast_story_reasoning = (
            os.getenv(
                "TOT_OPENAI_DIRECTOR_FAST_REASONING",
                "low",
            )
            .strip()
            or "low"
        )

        self.economy_reasoning = (
            os.getenv(
                "TOT_OPENAI_DIRECTOR_ECONOMY_REASONING",
                "low",
            )
            .strip()
            or "low"
        )

        self.max_output_tokens = self._bounded_int(
            "TOT_OPENAI_DIRECTOR_MAX_OUTPUT_TOKENS",
            default=4600,
            minimum=2600,
            maximum=7000,
        )

        self.timeout_seconds = self._bounded_int(
            "TOT_OPENAI_DIRECTOR_TIMEOUT_SECONDS",
            default=90,
            minimum=15,
            maximum=300,
        )

        self._client = None


    @staticmethod
    def _bounded_int(
        name: str,
        *,
        default: int,
        minimum: int,
        maximum: int,
    ) -> int:

        raw = os.getenv(
            name,
            "",
        ).strip()

        if not raw:

            return default


        try:

            value = int(
                raw
            )

        except ValueError:

            return default


        return max(
            minimum,
            min(
                maximum,
                value,
            ),
        )


    @staticmethod
    def _env_enabled(
        name: str,
    ) -> bool:

        return (
            os.getenv(
                name,
                "",
            )
            .strip()
            .casefold()
            in {
                "1",
                "true",
                "yes",
                "on",
            }
        )


    def _client_instance(
        self,
    ):

        if self._client is not None:

            return self._client


        if not os.getenv(
            "OPENAI_API_KEY"
        ):

            raise DirectorError(
                "OPENAI_API_KEY is not configured."
            )


        try:

            from openai import (
                AsyncOpenAI,
            )

        except ImportError as error:

            raise DirectorError(
                "The OpenAI Python SDK is not installed."
            ) from error


        self._client = AsyncOpenAI(
            timeout=
                float(
                    self.timeout_seconds
                ),

            # Runtime turns already have an explicit retry path that reuses
            # the frozen authoritative TurnFacts. Hidden SDK retries can make
            # a nominal 90-second timeout stretch into several minutes.
            max_retries=
                0,
        )


        return self._client


    def _profile(
        self,
        quality_tier: str,
    ) -> tuple[
        str,
        str,
    ]:

        if (
            _clean(
                quality_tier
            )
            .casefold()
            == "economy"
        ):

            return (
                self.economy_model,
                self.economy_reasoning,
            )


        return (
            self.story_model,
            self.story_reasoning,
        )


    async def _generate_parallel_recap(
        self,
        *,
        session,
        player_context: list[dict[str, Any]],
        turn_facts: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate player-facing previous-turn prose without owning story state."""

        fallback = _clean(
            turn_facts.get("resolution")
        )
        if not fallback:
            fallback = "The locked actions resolve, and the story moves forward."

        recap_payload = {
            # The recap is intentionally cheap. TURN FACTS already contain the
            # authoritative intent/check/outcome packet; feeding the full seed,
            # prior prose, memory, and story ledger here only increases latency.
            "scene_title": str(session.scene.title or ""),
            "players": [
                {
                    "player_id": player.get("player_id"),
                    "character_name": player.get("character_name"),
                }
                for player in player_context
            ],
            "turn_facts": turn_facts,
        }

        recap_schema = DirectorRecapDraft.model_json_schema()
        recap_started = time.perf_counter()

        try:
            recap_input = json.dumps(
                recap_payload,
                ensure_ascii=False,
            )
            response = (
                await metered_openai_call(
                    operation="director_recap",
                    model=self.economy_model,
                    max_output_tokens=520,
                    input_hint=recap_input,
                    metadata={"reasoning": self.economy_reasoning},
                    request=lambda: self._client_instance().responses.create(
                        model=self.economy_model,
                    instructions=(
                        "You are the fast turn narrator for TALES OF TWO. "
                        "Write ONLY the player-facing continuity bridge for the turn that "
                        "just resolved. TURN FACTS are authoritative. Capture EVERY pertinent "
                        "fact the next story beat may need: each Hero's chosen intent; the "
                        "actual check/roll outcome when supplied; success, failure, or critical "
                        "result; concrete bodily/positional/social consequences; HP/effect/item/"
                        "clue/relationship changes explicitly present in the frozen facts; and "
                        "the resulting immediate situation. Give distinct Hero actions distinct "
                        "weight. Never invent or alter a roll, consequence, item, HP change, "
                        "clue, relationship, location, or story-state fact. Use ONE compact paragraph, "
                        "normally 3-5 sentences. This text appears on the dice/result screen, so be "
                        "clear and final rather than literary or atmospheric. Do not introduce the "
                        "next scene, offer choices, or mention "
                        "game mechanics as instructions. The Story Director independently receives "
                        "the same frozen TURN FACTS, so this recap must be a faithful readable "
                        "record of that packet. Return the requested structured output only."
                    ),
                        input=recap_input,
                    reasoning={
                        "effort": self.economy_reasoning,
                    },
                    max_output_tokens=520,
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "tales_of_two_turn_recap",
                            "description": "Concise narration of frozen turn facts.",
                            "strict": True,
                            "schema": recap_schema,
                        },
                    },
                        store=False,
                    ),
                )
            )

            text = (
                getattr(response, "output_text", "")
                or ""
            ).strip()
            recap = DirectorRecapDraft.model_validate(
                json.loads(text)
            )

            usage = getattr(response, "usage", None)
            usage_data: dict[str, int] = {}
            if usage is not None:
                for name in (
                    "input_tokens",
                    "output_tokens",
                    "total_tokens",
                ):
                    value = getattr(usage, name, None)
                    if value is not None:
                        usage_data[name] = int(value)

            print(
                "[DIRECTOR RECAP OK] "
                f"room={session.room_code} "
                f"elapsed={time.perf_counter() - recap_started:.2f}s "
                f"model={self.economy_model} usage={usage_data}"
            )

            return {
                "resolution_narration": recap.resolution_narration,
                "meta": {
                    "provider": "openai",
                    "model": self.economy_model,
                    "reasoning": self.economy_reasoning,
                    "response_id": getattr(response, "id", None),
                    "usage": usage_data,
                    "fallback": False,
                },
            }

        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(
                "[DIRECTOR RECAP FALLBACK] "
                f"room={session.room_code} "
                f"elapsed={time.perf_counter() - recap_started:.2f}s "
                f"type={type(error).__name__} detail={error}"
            )
            return {
                "resolution_narration": fallback,
                "meta": {
                    "provider": "server_fallback",
                    "model": None,
                    "reasoning": None,
                    "response_id": None,
                    "usage": {},
                    "fallback": True,
                },
            }


    async def generate_recap(
        self,
        *,
        session,
        characters_by_player_id: dict,
        turn_facts: dict[str, Any],
    ) -> dict[str, Any]:
        """Cheap player-facing receipt narration for an already-frozen turn."""

        player_context = []
        for player_id, character in characters_by_player_id.items():
            player_context.append({
                "player_id": player_id,
                "character_name": getattr(character, "name", ""),
            })

        return await self._generate_parallel_recap(
            session=session,
            player_context=player_context,
            turn_facts=turn_facts,
        )


    async def advance(
        self,
        *,
        session,
        room,
        characters_by_player_id: dict,
        turn_facts: dict[
            str,
            Any,
        ],
        recap_task: asyncio.Task | None = None,
    ) -> dict[
        str,
        Any,
    ]:

        generated_id = (
            session
            .adventure
            .metadata
            .get(
                "generated_adventure_id"
            )
        )


        if not generated_id:

            raise DirectorError(
                "Generated adventure provenance is missing."
            )


        generated = (
            await generated_adventure_store
            .get(
                str(
                    generated_id
                )
            )
        )


        if generated is None:

            raise DirectorError(
                "Approved generated adventure could not be loaded."
            )


        seed = (
            generated.get(
                "seed",
                {},
            )
        )


        (
            model,
            reasoning,
        ) = self._profile(
            seed.get(
                "quality_tier",
                "story",
            )
        )


        current_turn = int(
            session.turn_number
        )

        minimum_turns = int(
            session.director_min_turns
            or 1
        )

        target_turns = int(
            session.director_target_turns
            or minimum_turns
        )

        maximum_turns = int(
            session.director_max_turns
            or target_turns
        )

        wrap_up_active = bool(
            getattr(session, "wrap_up_active", False)
        )
        wrap_up_turns_remaining = max(
            0,
            int(getattr(session, "wrap_up_turns_remaining", 0) or 0),
        )

        if wrap_up_active:
            # An agreed wrap-up gets its own exact three-turn runway.  It is
            # deliberately independent of the nominal target/max window: the
            # party asked for closure, and the Director now converges existing
            # material instead of suddenly truncating the current turn.
            may_complete = wrap_up_turns_remaining <= 1
            must_complete = wrap_up_turns_remaining <= 1
            story_phase = (
                "FINALE"
                if must_complete
                else "WRAP-UP"
            )
        else:
            may_complete = current_turn >= minimum_turns
            must_complete = current_turn >= maximum_turns

            if must_complete:
                story_phase = "FINALE"
            elif current_turn >= target_turns:
                story_phase = "FINALE WINDOW"
            elif current_turn >= max(
                minimum_turns,
                int(target_turns * 0.70),
            ):
                story_phase = "CONVERGENCE"
            elif current_turn >= max(
                2,
                int(target_turns * 0.30),
            ):
                story_phase = "ESCALATION"
            else:
                story_phase = "SETUP"


        # Keep runtime turns bounded. The old implementation increased output
        # headroom as an adventure grew, which made late turns slower and more
        # likely to hit timeout/truncation/repair loops. Sol keeps writing the
        # story, but routine turns use low reasoning and a fixed compact budget;
        # only actual wrap-up/finale beats receive a little extra headroom.
        high_stakes_phase = story_phase in {"FINALE WINDOW", "WRAP-UP", "FINALE"}
        if model == self.story_model:
            reasoning = self.story_reasoning if high_stakes_phase else self.fast_story_reasoning

        turn_output_tokens = min(
            5600 if high_stakes_phase else 4800,
            self.max_output_tokens + (800 if high_stakes_phase else 0),
        )


        player_context = []

        for (
            player_id,
            player,
        ) in room.players.items():

            character = (
                characters_by_player_id
                .get(
                    player_id
                )
            )


            player_context.append({
                "player_id":
                    player_id,

                "character_name":
                    player.name,

                "character":
                    (
                        _character_context(
                            character
                        )
                        if character is not None
                        else None
                    ),
            })


        challenge_profile = build_challenge_profile(
            [
                int(player.get("character", {}).get("level", 1) or 1)
                for player in player_context
                if isinstance(player.get("character"), dict)
            ],
            adventure_difficulty=seed.get("difficulty"),
        )


        play_mode = str(
            getattr(
                room,
                "play_mode",
                "coop",
            )
            or "coop"
        ).strip().lower()


        director_instructions = (
            SYSTEM_INSTRUCTIONS
            + (
                SOLO_MODE_INSTRUCTIONS
                if play_mode == "solo"
                else ""
            )
        )

        recent_offered_choices = _recent_offered_choices(
            list(session.director_history)
        )
        recent_scene_openings = _recent_scene_openings(
            list(session.director_history)
        )

        quick_event_requested = should_schedule_micro_event(
            resolved_turn_number=current_turn,
            completed=False,
            wrap_up_active=wrap_up_active,
        )

        # Runtime does not need the player-facing synopsis or the entire
        # pre-generated Turn 1 payload on every subsequent request. Keep only
        # durable creative constraints; include finale planning only when the
        # story is actually converging.
        compact_seed = {
            key: seed.get(key)
            for key in (
                "title", "primary_type", "secondary_type", "target_length",
                "tone", "difficulty", "weirdness", "premise", "core_goal",
                "major_locations", "major_npcs", "canon_constraints",
                "required_elements", "forbidden_elements", "open_threads",
                "hidden_truths", "director_guidance",
            )
            if key in seed
        }
        if story_phase in {"CONVERGENCE", "FINALE WINDOW", "WRAP-UP", "FINALE"}:
            compact_seed["potential_finale"] = seed.get("potential_finale", "")

        compact_story_state = _compact_story_state_context(
            dict(session.story_state)
        )

        compact_history = []
        for entry in list(session.director_history)[-2:]:
            if not isinstance(entry, dict):
                continue
            compact_history.append({
                "turn_number": entry.get("turn_number"),
                "choices": [
                    {
                        "player_name": choice.get("player_name"),
                        "choice_label": choice.get("choice_label"),
                        "outcome": (
                            (choice.get("check") or {}).get("outcome")
                            if isinstance(choice.get("check"), dict)
                            else None
                        ),
                    }
                    for choice in entry.get("choices", [])
                    if isinstance(choice, dict)
                ],
                "scene_title": entry.get("next_scene_title") or entry.get("scene_title"),
                "pressure_level": entry.get("pressure_level"),
                "scene_function": entry.get("scene_function"),
            })

        payload = {
            "adventure_seed":
                compact_seed,

            "runtime": {
                "play_mode":
                    play_mode,

                "active_hero_count":
                    len(
                        player_context
                    ),

                "current_turn":
                    current_turn,

                "quick_event_requested":
                    quick_event_requested,

                "minimum_turns":
                    minimum_turns,

                "target_turns":
                    target_turns,

                "maximum_turns":
                    maximum_turns,

                "story_phase":
                    story_phase,

                "may_complete":
                    may_complete,

                "must_complete":
                    must_complete,

                "wrap_up_active":
                    wrap_up_active,

                "wrap_up_turns_remaining":
                    wrap_up_turns_remaining,

                "challenge_profile":
                    challenge_profile.to_dict(),

                "current_scene": {
                    "id":
                        session.scene.id,

                    "title":
                        session.scene.title,

                    "body":
                        str(session.scene.body or "")[:1800],
                },

                # Structured state is the primary continuity store. The prose
                # memory is needed only while bootstrapping an older room that
                # does not yet have structured state.
                "memory_summary":
                    (session.director_memory if not session.story_state else ""),

                "story_state":
                    compact_story_state,

                "recent_history":
                    compact_history,

                "recent_micro_events":
                    _current_qte_consequences(
                        list(session.micro_event_history), current_turn
                    ),

                "recent_pressure_levels": [
                    entry.get(
                        "pressure_level"
                    )
                    for entry
                    in session.director_history[
                        -3:
                    ]
                    if entry.get(
                        "pressure_level"
                    )
                ],

                "recent_scene_functions": [
                    entry.get(
                        "scene_function"
                    )
                    for entry
                    in session.director_history[
                        -3:
                    ]
                    if entry.get(
                        "scene_function"
                    )
                ],

                "recent_scene_openings":
                    recent_scene_openings,

                "recent_offered_choices":
                    recent_offered_choices,

                "players":
                    player_context,

                "valid_skills": [
                    skill.value
                    for skill
                    in Skill
                ],

                "valid_stats": [
                    stat.value
                    for stat
                    in Stat
                ],

                "turn_facts":
                    turn_facts,
            },
        }


        request_input = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        )

        response_schema = (
            DirectorStoryTurnDraft
            .model_json_schema()
        )

        request_started = time.perf_counter()

        print(
            "[DIRECTOR REQUEST] "
            f"room={session.room_code} "
            f"turn={current_turn} "
            f"window={minimum_turns}/{target_turns}/{maximum_turns} "
            f"phase={story_phase} "
            f"mode={play_mode} "
            f"state={'tracked' if session.story_state else 'bootstrap'} "
            f"model={model} "
            f"reasoning={reasoning} "
            f"input_chars={len(request_input)} "
            f"instruction_chars={len(director_instructions)} "
            f"schema_chars={len(json.dumps(response_schema, ensure_ascii=False))} "
            f"history_entries={len(session.director_history[-4:])} "
            f"story_state_chars={len(json.dumps(session.story_state, ensure_ascii=False))} "
            f"compact_story_state_chars={len(json.dumps(compact_story_state, ensure_ascii=False))} "
            f"turn_facts_chars={len(json.dumps(turn_facts, ensure_ascii=False))}"
        )

        if self._env_enabled(
            "TOT_OPENAI_DIRECTOR_CONTEXT_PROBE"
        ):

            probe_started = time.perf_counter()

            print(
                "[DIRECTOR CONTEXT PROBE] sending full live context with tiny output request"
            )

            try:

                probe_response = (
                    await metered_openai_call(
                        operation="director_context_probe",
                        model=model,
                        max_output_tokens=32,
                        input_hint=request_input,
                        metadata={"reasoning": "low"},
                        request=lambda: self._client_instance().responses.create(
                            model=model,
                        instructions=(
                            director_instructions
                            + "\n\nDIAGNOSTIC OVERRIDE: Do not generate a story turn. "
                            + "Read the supplied live context and reply with exactly "
                            + "DIRECTOR_CONTEXT_OK."
                        ),
                        input=request_input,
                        reasoning={
                            "effort": "low",
                        },
                        max_output_tokens=32,
                            store=False,
                        ),
                    )
                )

            except Exception as error:

                elapsed = time.perf_counter() - probe_started

                print(
                    "[DIRECTOR CONTEXT PROBE ERROR] "
                    f"elapsed={elapsed:.2f}s "
                    f"type={type(error).__name__} "
                    f"detail={error}"
                )

                raise DirectorError(
                    (
                        "Director context probe failed: "
                        f"{type(error).__name__}: {error}"
                    )
                ) from error

            probe_text = (
                getattr(
                    probe_response,
                    "output_text",
                    "",
                )
                or ""
            ).strip()

            elapsed = time.perf_counter() - probe_started

            print(
                "[DIRECTOR CONTEXT PROBE RESULT] "
                f"elapsed={elapsed:.2f}s "
                f"response_id={getattr(probe_response, 'id', None)} "
                f"text={probe_text!r}"
            )

            raise DirectorError(
                (
                    "Director context probe completed successfully in "
                    f"{elapsed:.2f}s with response {probe_text!r}. "
                    "Disable TOT_OPENAI_DIRECTOR_CONTEXT_PROBE to resume story generation."
                )
            )


        # Run player-facing recap narration in parallel with the authoritative
        # Story Director. finalize_resolved_turn may supply the task so it can
        # expose the cheap dice/result receipt before the story request finishes.
        if recap_task is None:
            recap_task = asyncio.create_task(
                self._generate_parallel_recap(
                    session=session,
                    player_context=player_context,
                    turn_facts=turn_facts,
                )
            )

        provider_started = time.perf_counter()

        try:

            response = (
                await metered_openai_call(
                    operation="director_story",
                    model=model,
                    max_output_tokens=turn_output_tokens,
                    input_hint=request_input,
                    metadata={"reasoning": reasoning, "turn": current_turn},
                    request=lambda: self._client_instance().responses.create(
                        model=
                            model,

                    instructions=
                        director_instructions,

                    input=
                        request_input,

                    reasoning={
                        "effort":
                            reasoning,
                    },

                    max_output_tokens=
                        turn_output_tokens,

                    text={
                        "format": {
                            "type":
                                "json_schema",

                            "name":
                                "tales_of_two_director_turn",

                            "description":
                                "One validated story turn for Tales of Two.",

                            "strict":
                                True,

                            "schema":
                                response_schema,
                        },
                    },

                        store=
                            False,
                    ),
                )
            )

        except UsageLimitExceeded:
            raise

        except Exception as error:

            # Keep the provider's actual error text in the server log.
            # OpenAI BadRequestError messages normally identify the exact
            # invalid field/schema path, which is critical during integration.
            provider_elapsed = time.perf_counter() - provider_started

            print(
                "[DIRECTOR PROVIDER ERROR] "
                f"elapsed={provider_elapsed:.2f}s "
                f"type={type(error).__name__} "
                f"detail={error}"
            )

            if not recap_task.done():
                recap_task.cancel()
            await asyncio.gather(
                recap_task,
                return_exceptions=True,
            )

            raise DirectorError(
                (
                    "Story Director request failed: "
                    f"{type(error).__name__}: {error}"
                )
            ) from error


        provider_elapsed = time.perf_counter() - provider_started

        # The economy recap must never become the new bottleneck. It normally
        # finishes well before the story call; if it somehow lags behind the
        # completed story response, give it only a tiny tail window and fall
        # back to the deterministic server receipt rather than delaying commit.
        if recap_task.done():
            recap_result = recap_task.result()
        else:
            recap_done, _ = await asyncio.wait({recap_task}, timeout=1.5)
            if recap_task in recap_done:
                recap_result = recap_task.result()
            else:
                recap_task.cancel()
                await asyncio.gather(recap_task, return_exceptions=True)
                recap_result = {
                    "resolution_narration": (
                        _clean(turn_facts.get("resolution"))
                        or "The locked actions resolve, and the story moves forward."
                    ),
                    "meta": {
                        "provider": "server_fallback",
                        "model": None,
                        "reasoning": None,
                        "response_id": None,
                        "usage": {},
                        "fallback": True,
                    },
                }

        print(
            "[DIRECTOR PROVIDER RETURNED] "
            f"elapsed={provider_elapsed:.2f}s "
            f"response_id={getattr(response, 'id', None)} "
            f"status={getattr(response, 'status', None)} "
            f"incomplete_details={getattr(response, 'incomplete_details', None)} "
            f"output_chars={len(getattr(response, 'output_text', '') or '')}"
        )

        output_text = (
            getattr(
                response,
                "output_text",
                "",
            )
            or ""
        ).strip()


        if not output_text:

            raise DirectorError(
                "Story Director returned no output."
            )


        def normalize_provider_payload(
            value: Any,
        ) -> Any:
            """Repair deterministic shape mistakes without inventing story content."""

            if not isinstance(value, dict):
                return value

            value.setdefault("quick_event", None)

            choices = value.get("choices")

            if isinstance(choices, list):
                for choice in choices:
                    if not isinstance(choice, dict):
                        continue

                    check = choice.get("check")
                    if not isinstance(check, dict):
                        continue

                    skill = check.get("skill")
                    stat = check.get("stat")
                    has_skill = isinstance(skill, str) and bool(skill.strip())
                    has_stat = isinstance(stat, str) and bool(stat.strip())

                    # The provider schema can express nullable skill/stat fields,
                    # but the Pydantic semantic rule requires exactly one.  When
                    # both are present, prefer the more-specific skill target.
                    if has_skill and has_stat:
                        check["stat"] = None
                    elif not has_skill and not has_stat:
                        choice["check"] = None
                    elif has_skill:
                        check["skill"] = skill.strip()
                        check["stat"] = None
                    else:
                        check["skill"] = None
                        check["stat"] = stat.strip()

            story_state = value.get("story_state")
            if isinstance(story_state, dict):
                # Deterministically cap continuity arrays before semantic
                # validation. Extra older entries are redundant context, not a
                # reason to spend another model call repairing an otherwise
                # playable turn.
                state_limits = {
                    "player_positions": 4,
                    "active_npcs": 8,
                    "active_threats": 6,
                    "known_facts": 12,
                    "player_private_knowledge": 8,
                    "unresolved_threads": 8,
                    "resolved_threads": 6,
                    "important_items": 8,
                    "active_advantages": 6,
                    "recent_consequences": 6,
                    "closed_opportunities": 6,
                }
                compact_string_lists = {
                    "known_facts",
                    "unresolved_threads",
                    "resolved_threads",
                    "active_advantages",
                    "closed_opportunities",
                }
                for key, limit in state_limits.items():
                    items = story_state.get(key)
                    if not isinstance(items, list):
                        continue
                    items = items[-limit:]
                    if key in compact_string_lists:
                        items = [str(item)[:320] for item in items]
                    story_state[key] = items

                consequences = story_state.get("recent_consequences")
                if isinstance(consequences, list):
                    for consequence in consequences:
                        if not isinstance(consequence, dict):
                            continue
                        consequence.setdefault(
                            "effect_name",
                            "STORY CONSEQUENCE",
                        )
                        consequence.setdefault("modifier_stat", None)
                        consequence.setdefault("modifier_skill", None)
                        consequence.setdefault("modifier_value", 0)
                        consequence.setdefault("health_delta", 0)

            return value


        try:
            parsed_output = normalize_provider_payload(
                json.loads(output_text)
            )

            draft = DirectorStoryTurnDraft.model_validate(
                parsed_output
            )

        except json.JSONDecodeError as error:
            print(
                "[DIRECTOR VALIDATION ERROR] "
                f"room={session.room_code} turn={current_turn} "
                f"type=JSONDecodeError detail={error} "
                f"response_status={getattr(response, 'status', None)} "
                f"incomplete_details={getattr(response, 'incomplete_details', None)} "
                f"output_preview={output_text[:900]!r}"
            )

            # A long structured response can occasionally be cut off near the
            # output-token ceiling.  The story content is usually already
            # present; do one low-reasoning structured repair instead of
            # discarding the entire turn and forcing a fresh roll/generation.
            repair_started = time.perf_counter()
            repair_input = json.dumps(
                {
                    "parse_error": str(error),
                    "original_output_text": output_text,
                },
                ensure_ascii=False,
            )

            try:
                repair_limit = min(4200, max(3200, turn_output_tokens))
                repair_response = (
                    await metered_openai_call(
                        operation="director_json_repair",
                        model=self.economy_model,
                        max_output_tokens=repair_limit,
                        input_hint=repair_input,
                        metadata={"reasoning": self.economy_reasoning, "turn": current_turn},
                        request=lambda: self._client_instance().responses.create(
                            model=self.economy_model,
                        instructions=(
                            "Repair the supplied TALES OF TWO Director output into "
                            "one complete JSON object matching the requested schema. "
                            "The original text may be truncated near its end. Preserve "
                            "all existing narration, facts, outcomes, and choices that "
                            "are present, reconstruct only the missing/invalid tail, and "
                            "do not invent a different turn. Return only the repaired "
                            "structured output."
                        ),
                        input=repair_input,
                        reasoning={"effort": self.economy_reasoning},
                            max_output_tokens=repair_limit,
                        text={
                            "format": {
                                "type": "json_schema",
                                "name": "tales_of_two_director_turn_json_repair",
                                "description": "Completed repaired story turn for Tales of Two.",
                                "strict": True,
                                "schema": response_schema,
                            },
                        },
                            store=False,
                        ),
                    )
                )
            except Exception as repair_error:
                print(
                    "[DIRECTOR JSON REPAIR ERROR] "
                    f"elapsed={time.perf_counter() - repair_started:.2f}s "
                    f"type={type(repair_error).__name__} detail={repair_error}"
                )
                raise DirectorError(
                    "Story Director returned malformed JSON and repair failed."
                ) from repair_error

            repair_text = (
                getattr(repair_response, "output_text", "") or ""
            ).strip()

            try:
                repaired_payload = normalize_provider_payload(
                    json.loads(repair_text)
                )
                draft = DirectorStoryTurnDraft.model_validate(
                    repaired_payload
                )
            except (json.JSONDecodeError, ValidationError) as repair_validation_error:
                print(
                    "[DIRECTOR JSON REPAIR INVALID] "
                    f"elapsed={time.perf_counter() - repair_started:.2f}s "
                    f"detail={repair_validation_error} "
                    f"output_preview={repair_text[:1200]!r}"
                )
                raise DirectorError(
                    "Story Director returned malformed JSON after repair."
                ) from repair_validation_error

            print(
                "[DIRECTOR JSON REPAIR OK] "
                f"elapsed={time.perf_counter() - repair_started:.2f}s"
            )

        except ValidationError as first_error:
            error_summary = first_error.errors(
                include_url=False,
                include_context=False,
                include_input=False,
            )

            print(
                "[DIRECTOR VALIDATION ERROR] "
                f"room={session.room_code} turn={current_turn} "
                f"detail={error_summary} "
                f"output_preview={output_text[:1200]!r}"
            )

            # Do not throw away an otherwise complete story turn for a small
            # semantic-schema miss.  Give the model one low-reasoning repair
            # pass constrained by the exact same strict JSON schema.
            repair_started = time.perf_counter()
            repair_input = json.dumps(
                {
                    "validation_errors": error_summary,
                    "original_output": parsed_output,
                },
                ensure_ascii=False,
            )

            try:
                repair_limit = min(4200, max(3200, turn_output_tokens))
                repair_response = (
                    await metered_openai_call(
                        operation="director_schema_repair",
                        model=self.economy_model,
                        max_output_tokens=repair_limit,
                        input_hint=repair_input,
                        metadata={"reasoning": self.economy_reasoning, "turn": current_turn},
                        request=lambda: self._client_instance().responses.create(
                            model=self.economy_model,
                        instructions=(
                            "Repair the supplied TALES OF TWO Director JSON so it "
                            "passes the requested schema and semantic constraints. "
                            "Preserve the existing narration, story facts, outcomes, "
                            "and choices as much as possible. Change only fields needed "
                            "to satisfy the validation errors. For an active turn, keep "
                            "3-6 distinct choices and at least 2 checked choices. Preserve "
                            "choice diversity: multiple archetypes and risk levels, at most "
                            "one safe/cautious option, and a scene-shifting option when 4+ "
                            "choices are present. Preserve possible gains/costs. Every check "
                            "must use exactly one skill OR one stat, never both. "
                            "If validation reports QTE leakage, remove ALL QTE/UI/mechanical "
                            "language and option labels from scene_body while preserving the "
                            "ordinary fictional hazard or opportunity. Keep quick_event separate. "
                            "Return only the repaired structured output."
                        ),
                        input=repair_input,
                        reasoning={"effort": self.economy_reasoning},
                            max_output_tokens=repair_limit,
                        text={
                            "format": {
                                "type": "json_schema",
                                "name": "tales_of_two_director_turn_repair",
                                "description": "Repaired validated story turn for Tales of Two.",
                                "strict": True,
                                "schema": response_schema,
                            },
                        },
                            store=False,
                        ),
                    )
                )
            except Exception as repair_error:
                print(
                    "[DIRECTOR REPAIR ERROR] "
                    f"elapsed={time.perf_counter() - repair_started:.2f}s "
                    f"type={type(repair_error).__name__} detail={repair_error}"
                )
                raise DirectorError(
                    "Story Director returned invalid structured output and repair failed."
                ) from repair_error

            repair_text = (
                getattr(repair_response, "output_text", "") or ""
            ).strip()

            try:
                repaired_payload = normalize_provider_payload(
                    json.loads(repair_text)
                )
                draft = DirectorStoryTurnDraft.model_validate(
                    repaired_payload
                )
            except (json.JSONDecodeError, ValidationError) as repair_validation_error:
                print(
                    "[DIRECTOR REPAIR INVALID] "
                    f"elapsed={time.perf_counter() - repair_started:.2f}s "
                    f"detail={repair_validation_error} "
                    f"output_preview={repair_text[:1200]!r}"
                )
                raise DirectorError(
                    "Story Director returned invalid structured output after repair."
                ) from repair_validation_error

            print(
                "[DIRECTOR REPAIR OK] "
                f"elapsed={time.perf_counter() - repair_started:.2f}s"
            )


        freshness_issues = _freshness_violations(
            draft,
            recent_choices=recent_offered_choices,
            recent_openings=recent_scene_openings,
        )

        # Freshness is a quality hint, not a reason to risk a second expensive
        # full-turn generation. Keep the valid turn playable and log the issue;
        # the next prompt already receives the recent-choice/opening avoid list.
        if freshness_issues and not draft.completed:
            print(
                "[DIRECTOR FRESHNESS WARNING] "
                f"room={session.room_code} turn={current_turn} "
                f"issues={freshness_issues}"
            )


        if (
            wrap_up_active
            and wrap_up_turns_remaining > 1
            and draft.completed
        ):
            raise DirectorError(
                "Story Director ended before the party's three-turn wrap-up runway was complete."
            )

        if (
            must_complete
            and not draft.completed
        ):

            raise DirectorError(
                "Story Director did not close the adventure at the hard maximum."
            )


        if (
            not may_complete
            and draft.completed
        ):

            raise DirectorError(
                "Story Director attempted to end before the minimum turn window."
            )


        usage = getattr(
            response,
            "usage",
            None,
        )

        usage_data = {}

        if usage is not None:

            for name in (
                "input_tokens",
                "output_tokens",
                "total_tokens",
            ):

                value = getattr(
                    usage,
                    name,
                    None,
                )

                if value is not None:

                    usage_data[
                        name
                    ] = int(
                        value
                    )


        total_elapsed = time.perf_counter() - request_started

        print(
            "[DIRECTOR RESPONSE] "
            f"room={session.room_code} "
            f"turn={current_turn} "
            f"completed={draft.completed} "
            f"choices={len(draft.choices)} "
            f"provider_elapsed={provider_elapsed:.2f}s "
            f"total_elapsed={total_elapsed:.2f}s "
            f"usage={usage_data}"
        )


        return {
            "title":
                draft.title,

            "resolution_narration":
                recap_result["resolution_narration"],

            "scene_body":
                draft.scene_body,

            "choices": [
                {
                    "label":
                        choice.label,

                    "description":
                        choice.description,

                    "archetype":
                        choice.archetype,

                    "tone":
                        choice.tone,

                    "risk_level":
                        choice.risk_level,

                    "reward_level":
                        choice.reward_level,

                    "impact_level":
                        choice.impact_level,

                    "possible_gains":
                        list(choice.possible_gains),

                    "possible_costs":
                        list(choice.possible_costs),

                    "check":
                        (
                            {
                                "difficulty":
                                    choice.check.difficulty,

                                "skill":
                                    choice.check.skill,

                                "stat":
                                    choice.check.stat,
                            }

                            if choice.check is not None

                            else None
                        ),
                }

                for choice
                in draft.choices
            ],

            "quick_event": (
                draft.quick_event.model_dump()
                if quick_event_requested and draft.quick_event is not None
                else None
            ),

            "memory_summary":
                draft.memory_summary,

            "story_state":
                draft.story_state.model_dump(),

            "pressure_level":
                draft.pressure_level,

            "scene_function":
                draft.scene_function,

            "completed":
                draft.completed,

            "ending_label":
                draft.ending_label,

            "director_meta": {
                "provider":
                    "openai",

                "model":
                    model,

                "reasoning":
                    reasoning,

                "response_id":
                    getattr(
                        response,
                        "id",
                        None,
                    ),

                "usage":
                    usage_data,

                "parallel_recap":
                    recap_result["meta"],
            },
        }


runtime_director = (
    OpenAIRuntimeDirector()
)
