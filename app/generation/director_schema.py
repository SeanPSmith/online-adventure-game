from __future__ import annotations

import re

from typing import (
    Literal,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class DirectorCheckDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    difficulty: int = Field(
        ge=3,
        le=16,
    )

    skill: str | None

    stat: str | None


    @model_validator(
        mode="after",
    )
    def validate_check_target(
        self,
    ) -> "DirectorCheckDraft":

        if (
            self.skill is None
            and self.stat is None
        ):

            raise ValueError(
                "A check requires either a skill or a stat."
            )


        if (
            self.skill is not None
            and self.stat is not None
        ):

            raise ValueError(
                "Use either a skill check or a stat check, not both."
            )


        return self


class DirectorChoiceDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    # Short, punchy card title.  The UI may later render this as the face of a
    # Fallout-style choice card, so keep it readable at a glance.
    label: str = Field(
        min_length=2,
        max_length=90,
    )

    # The fuller player-facing explanation of what the choice actually means.
    # This is intentionally separate from the title so menus can stay compact
    # without sacrificing clarity.
    description: str = Field(
        min_length=8,
        max_length=240,
    )

    archetype: Literal[
        "safe",
        "bold",
        "reckless",
        "clever",
        "social",
        "weird",
        "mercenary",
        "heroic",
        "cruel",
        "chaotic",
        "stealth",
        "investigative",
    ]

    tone: Literal[
        "cautious",
        "assertive",
        "aggressive",
        "whimsical",
        "deceptive",
        "compassionate",
        "pragmatic",
        "defiant",
        "curious",
        "desperate",
    ]

    risk_level: Literal[
        "low",
        "moderate",
        "high",
        "severe",
        "extreme",
    ]

    reward_level: Literal[
        "low",
        "moderate",
        "high",
        "major",
    ]

    impact_level: Literal[
        "local",
        "meaningful",
        "scene_shifting",
    ]

    possible_gains: list[str] = Field(
        min_length=1,
        max_length=3,
    )

    possible_costs: list[str] = Field(
        min_length=1,
        max_length=3,
    )

    check: DirectorCheckDraft | None


    @field_validator(
        "label",
        "description",
        mode="after",
    )
    @classmethod
    def strip_choice_text(
        cls,
        value: str,
    ) -> str:

        return value.strip()


    @field_validator(
        "possible_gains",
        "possible_costs",
        mode="after",
    )
    @classmethod
    def clean_choice_lists(
        cls,
        values: list[str],
    ) -> list[str]:

        cleaned = [
            str(value).strip()
            for value in values
            if str(value).strip()
        ]

        if not cleaned:
            raise ValueError(
                "Choice gains/costs must contain at least one meaningful item."
            )

        return cleaned


class DirectorPlayerPositionDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    player_name: str = Field(
        min_length=1,
        max_length=120,
    )

    location: str = Field(
        min_length=1,
        max_length=220,
    )

    status: str = Field(
        max_length=220,
    )


class DirectorNpcStateDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    name: str = Field(
        min_length=1,
        max_length=120,
    )

    location: str = Field(
        min_length=1,
        max_length=220,
    )

    attitude: str = Field(
        max_length=180,
    )

    status: str = Field(
        max_length=220,
    )


class DirectorThreatDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    name: str = Field(
        min_length=1,
        max_length=160,
    )

    status: str = Field(
        max_length=260,
    )

    urgency: Literal[
        "low",
        "moderate",
        "high",
        "immediate",
    ]


class DirectorKnowledgeDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    holder: str = Field(
        min_length=1,
        max_length=120,
    )

    fact: str = Field(
        min_length=1,
        max_length=320,
    )


class DirectorItemStateDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    name: str = Field(
        min_length=1,
        max_length=160,
    )

    holder: str = Field(
        max_length=120,
    )

    significance: str = Field(
        max_length=260,
    )


class DirectorConsequenceDraft(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
    )

    # Compact game-facing name for the consequence/effect. Never copy the
    # full narration into this field; it is rendered prominently in the HUD.
    effect_name: str = Field(
        min_length=2,
        max_length=48,
    )

    description: str = Field(
        min_length=1,
        max_length=320,
    )

    affected: str = Field(
        max_length=160,
    )

    permanence: Literal[
        "temporary",
        "lasting",
        "permanent",
    ]

    # Required-but-nullable in the strict provider schema.  Narrative-only
    # consequences use null/null/0; the server remains authoritative over
    # whether a proposed modifier is accepted.
    modifier_stat: str | None

    modifier_skill: str | None

    modifier_value: int = Field(
        ge=-2,
        le=2,
    )

    # Health IMPACT severity proposal, not literal HP. The server converts this
    # bounded tier into level/max-health-scaled damage or recovery. Negative
    # values are wounds, positive values are healing, and 0 is narrative-only.
    health_delta: int = Field(
        ge=-5,
        le=4,
    )

    @model_validator(mode="after")
    def validate_mechanical_target(self) -> "DirectorConsequenceDraft":
        has_stat = bool(str(self.modifier_stat or "").strip())
        has_skill = bool(str(self.modifier_skill or "").strip())
        if has_stat and has_skill:
            raise ValueError("A consequence may target a stat or a skill, not both.")
        if self.modifier_value != 0 and not (has_stat or has_skill):
            raise ValueError("A non-zero modifier requires exactly one stat or skill target.")
        if self.modifier_value == 0 and (has_stat or has_skill):
            raise ValueError("A modifier target requires a non-zero modifier value.")
        return self


class DirectorStoryStateDraft(
    BaseModel
):
    """
    Durable AI-directed soft story state.

    This is not mechanical authority. The server still owns all dice,
    character stats, inventory, HP, flags, and checks.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    current_goal: str = Field(
        max_length=320,
    )

    story_phase: Literal[
        "setup",
        "escalation",
        "convergence",
        "finale",
    ]

    player_positions: list[
        DirectorPlayerPositionDraft
    ] = Field(
        max_length=4,
    )

    active_npcs: list[
        DirectorNpcStateDraft
    ] = Field(
        max_length=8,
    )

    active_threats: list[
        DirectorThreatDraft
    ] = Field(
        max_length=6,
    )

    known_facts: list[
        str
    ] = Field(
        max_length=12,
    )

    player_private_knowledge: list[
        DirectorKnowledgeDraft
    ] = Field(
        max_length=8,
    )

    unresolved_threads: list[
        str
    ] = Field(
        max_length=8,
    )

    resolved_threads: list[
        str
    ] = Field(
        max_length=6,
    )

    important_items: list[
        DirectorItemStateDraft
    ] = Field(
        max_length=8,
    )

    active_advantages: list[
        str
    ] = Field(
        max_length=6,
    )

    recent_consequences: list[
        DirectorConsequenceDraft
    ] = Field(
        max_length=6,
    )

    closed_opportunities: list[
        str
    ] = Field(
        max_length=6,
    )


_TRAILING_CJK_RECAP_NOISE = re.compile(
    r"(?:\s*[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\U00020000-\U0002EBEF\U00030000-\U0003134F]+[\u3000-\u303F\s]*)+$"
)


def sanitize_recap_text(value: str) -> str:
    """Strip model-only trailing CJK glyph noise from English result recaps.

    Tales of Two's player-facing runtime is currently English.  We deliberately
    target only a trailing CJK/Kana/Hangul run so punctuation, accented names,
    em-dashes, and other legitimate Unicode inside the recap are preserved.
    """
    clean = value.replace("\u200b", "").replace("\ufeff", "").strip()
    clean = _TRAILING_CJK_RECAP_NOISE.sub("", clean).rstrip()
    return clean


class DirectorRecapDraft(
    BaseModel
):
    """Fast, non-authoritative player-facing narration for frozen TURN FACTS."""

    model_config = ConfigDict(
        extra="forbid",
    )

    resolution_narration: str = Field(
        min_length=20,
        max_length=1400,
    )

    @field_validator(
        "resolution_narration",
        mode="before",
    )
    @classmethod
    def strip_text(
        cls,
        value: str,
    ) -> str:

        return sanitize_recap_text(value)




class DirectorQuickEventOptionDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=36, pattern=r"^[a-z0-9_\-]+$")
    label: str = Field(min_length=2, max_length=70)
    description: str = Field(min_length=8, max_length=220)

    @field_validator("id", "label", "description", mode="after")
    @classmethod
    def strip_qte_option_text(cls, value: str) -> str:
        return value.strip()


class DirectorQuickEventEffectDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=48)
    description: str = Field(min_length=8, max_length=220)
    modifier_stat: str | None
    modifier_skill: str | None
    modifier_value: int = Field(ge=-2, le=2)
    duration_turns: Literal[1]

    @model_validator(mode="after")
    def validate_effect_target(self) -> "DirectorQuickEventEffectDraft":
        has_stat = bool(str(self.modifier_stat or "").strip())
        has_skill = bool(str(self.modifier_skill or "").strip())
        if has_stat == has_skill:
            raise ValueError("A QTE effect requires exactly one stat or skill target.")
        if self.modifier_value == 0:
            raise ValueError("A QTE effect must have a non-zero modifier.")
        return self


class DirectorQuickEventDraft(BaseModel):
    """Director-authored fiction for a server-owned split-second challenge."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal[
        "quick_reaction",
        "gut_check",
        "split_second",
        "danger_beat",
        "opportunity",
    ]
    title: str = Field(min_length=2, max_length=80)
    story_context: str = Field(min_length=12, max_length=240)
    prompt: str = Field(min_length=12, max_length=420)
    options: list[DirectorQuickEventOptionDraft] = Field(min_length=2, max_length=3)
    correct_option_id: str = Field(min_length=1, max_length=36)
    success_text: str = Field(min_length=12, max_length=320)
    failure_text: str = Field(min_length=12, max_length=320)
    success_effect: DirectorQuickEventEffectDraft
    failure_effect: DirectorQuickEventEffectDraft

    @model_validator(mode="after")
    def validate_qte_contract(self) -> "DirectorQuickEventDraft":
        ids = [option.id for option in self.options]
        if len(ids) != len(set(ids)):
            raise ValueError("QTE option ids must be distinct.")
        if self.correct_option_id not in ids:
            raise ValueError("correct_option_id must reference one supplied QTE option.")
        if self.success_effect.modifier_value <= 0:
            raise ValueError("QTE success_effect must be a positive temporary buff.")
        if self.failure_effect.modifier_value >= 0:
            raise ValueError("QTE failure_effect must be a negative temporary nerf.")
        return self


class DirectorStoryTurnDraft(
    BaseModel
):
    """
    Authoritative Story Director output for the next playable beat.

    Previous-turn narration is generated independently by DirectorRecapDraft so
    this schema stays focused on continuity, state, choices, and the new scene.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    title: str = Field(
        min_length=1,
        max_length=140,
    )

    scene_body: str = Field(
        min_length=20,
        max_length=1800,
    )

    choices: list[
        DirectorChoiceDraft
    ] = Field(
        min_length=0,
        max_length=7,
    )

    # Required-but-nullable keeps OpenAI strict structured output happy. Python
    # decides cadence; the Director returns null when no QTE is requested.
    quick_event: DirectorQuickEventDraft | None

    memory_summary: str = Field(
        min_length=10,
        max_length=600,
    )

    story_state: DirectorStoryStateDraft

    pressure_level: Literal[
        "calm",
        "rising",
        "tense",
        "danger",
        "release",
    ]

    scene_function: Literal[
        "breather",
        "discovery",
        "social",
        "exploration",
        "challenge",
        "consequence",
        "climax",
    ]

    completed: bool

    ending_label: str = Field(
        max_length=180,
    )

    @field_validator(
        "title",
        "scene_body",
        "memory_summary",
        "ending_label",
        mode="after",
    )
    @classmethod
    def strip_text(
        cls,
        value: str,
    ) -> str:

        return value.strip()

    @model_validator(
        mode="after",
    )
    def validate_turn_shape(
        self,
    ) -> "DirectorStoryTurnDraft":

        if self.completed:
            if self.choices:
                raise ValueError(
                    "A completed adventure cannot offer more choices."
                )
            if self.quick_event is not None:
                raise ValueError(
                    "A completed adventure cannot schedule a quick event."
                )
            return self

        if len(self.choices) < 3:
            raise ValueError(
                "An active adventure turn requires at least 3 choices."
            )

        normalized = [
            choice.label.casefold()
            for choice in self.choices
        ]
        if len(normalized) != len(set(normalized)):
            raise ValueError(
                "Director choices must be distinct."
            )

        checked_count = sum(
            1
            for choice in self.choices
            if choice.check is not None
        )
        if checked_count < 2:
            raise ValueError(
                "Active turns must offer at least 2 checked choices."
            )

        archetypes = {choice.archetype for choice in self.choices}
        risk_levels = {choice.risk_level for choice in self.choices}

        if len(self.choices) >= 4 and len(archetypes) < 3:
            raise ValueError(
                "Choice menus with 4+ options require at least 3 distinct archetypes."
            )

        if len(risk_levels) < 2:
            raise ValueError(
                "Active choice menus require at least 2 distinct risk levels."
            )

        if len(self.choices) >= 4 and not any(
            choice.risk_level in {"high", "severe", "extreme"}
            for choice in self.choices
        ):
            raise ValueError(
                "Choice menus with 4+ options require at least one genuinely risky option."
            )

        if len(self.choices) >= 4 and not any(
            choice.impact_level == "scene_shifting"
            for choice in self.choices
        ):
            raise ValueError(
                "Choice menus with 4+ options require at least one scene-shifting option."
            )

        safe_count = sum(
            1
            for choice in self.choices
            if choice.archetype == "safe" or choice.tone == "cautious"
        )
        if safe_count > 1:
            raise ValueError(
                "Offer at most one explicitly safe/cautious choice per turn."
            )

        # QTE mechanics are never story prose. The fictional cue may be present,
        # but the UI prompt/options/timer/effect language must remain isolated in
        # quick_event so readers encounter the reaction only when the modal opens.
        if self.quick_event is not None:
            body = " ".join(self.scene_body.casefold().split())
            forbidden_mechanics = (
                "qte",
                "quick reaction",
                "correct answer",
                "right answer",
                "wrong answer",
                "countdown",
                "reaction timer",
                "buff",
                "nerf",
                "next round bonus",
            )
            leaked = [phrase for phrase in forbidden_mechanics if phrase in body]

            prompt = " ".join(self.quick_event.prompt.casefold().split())
            if len(prompt) >= 24 and prompt in body:
                leaked.append("quick-event prompt")

            for option in self.quick_event.options:
                label = " ".join(option.label.casefold().split())
                if len(label) >= 8 and label in body:
                    leaked.append(f"quick-event option '{option.label}'")

            if leaked:
                raise ValueError(
                    "QTE leakage in scene_body: " + ", ".join(leaked)
                )

        return self


class DirectorTurnDraft(
    BaseModel
):
    """
    AI-authored narrative output.

    No canonical mechanical mutation is accepted here.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    title: str = Field(
        min_length=1,
        max_length=140,
    )

    resolution_narration: str = Field(
        min_length=20,
        max_length=1400,
    )

    scene_body: str = Field(
        min_length=20,
        max_length=1800,
    )

    choices: list[
        DirectorChoiceDraft
    ] = Field(
        min_length=0,
        max_length=7,
    )

    memory_summary: str = Field(
        min_length=10,
        max_length=900,
    )

    story_state: DirectorStoryStateDraft

    pressure_level: Literal[
        "calm",
        "rising",
        "tense",
        "danger",
        "release",
    ]

    scene_function: Literal[
        "breather",
        "discovery",
        "social",
        "exploration",
        "challenge",
        "consequence",
        "climax",
    ]

    completed: bool

    ending_label: str = Field(
        max_length=180,
    )


    @field_validator(
        "title",
        "resolution_narration",
        "scene_body",
        "memory_summary",
        "ending_label",
        mode="after",
    )
    @classmethod
    def strip_text(
        cls,
        value: str,
    ) -> str:

        return value.strip()


    @model_validator(
        mode="after",
    )
    def validate_turn_shape(
        self,
    ) -> "DirectorTurnDraft":

        if self.completed:

            if self.choices:

                raise ValueError(
                    "A completed adventure cannot offer more choices."
                )

            return self


        if (
            len(
                self.choices
            )
            < 3
        ):

            raise ValueError(
                "An active adventure turn requires at least 3 choices."
            )


        normalized = [
            choice.label.casefold()

            for choice
            in self.choices
        ]


        if (
            len(
                normalized
            )
            != len(
                set(
                    normalized
                )
            )
        ):

            raise ValueError(
                "Director choices must be distinct."
            )


        checked_count = sum(
            1
            for choice
            in self.choices
            if choice.check is not None
        )


        if (
            checked_count < 2
        ):

            raise ValueError(
                "Active turns must offer at least 2 checked choices."
            )


        archetypes = {
            choice.archetype
            for choice in self.choices
        }

        risk_levels = {
            choice.risk_level
            for choice in self.choices
        }

        if len(self.choices) >= 4 and len(archetypes) < 3:
            raise ValueError(
                "Choice menus with 4+ options require at least 3 distinct archetypes."
            )

        if len(risk_levels) < 2:
            raise ValueError(
                "Active choice menus require at least 2 distinct risk levels."
            )

        if len(self.choices) >= 4 and not any(
            choice.risk_level in {"high", "severe", "extreme"}
            for choice in self.choices
        ):
            raise ValueError(
                "Choice menus with 4+ options require at least one genuinely risky option."
            )

        if len(self.choices) >= 4 and not any(
            choice.impact_level == "scene_shifting"
            for choice in self.choices
        ):
            raise ValueError(
                "Choice menus with 4+ options require at least one scene-shifting option."
            )

        safe_count = sum(
            1
            for choice in self.choices
            if choice.archetype == "safe" or choice.tone == "cautious"
        )

        if safe_count > 1:
            raise ValueError(
                "Offer at most one explicitly safe/cautious choice per turn."
            )


        return self
