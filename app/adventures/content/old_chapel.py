from app.adventures.models import (
    AdventureDefinition,
    CheckSpec,
    ChoiceDefinition,
    SceneDefinition,
)

from app.characters.models import (
    Skill,
    Stat,
)


# =========================================================
# THE OLD CHAPEL
#
# This deliberately reproduces the current live chapel
# content before we move session.py over to the adventure
# registry.
# =========================================================

OLD_CHAPEL = AdventureDefinition(

    id=
        "old_chapel",

    title=
        "THE OLD CHAPEL",

    description=
        (
            "A short supernatural investigation "
            "centered on an abandoned hillside chapel."
        ),

    starting_scene_id=
        "chapel_road",

    tags=(
        "horror",
        "mystery",
        "supernatural",
        "short",
    ),

    metadata={
        "difficulty":
            "introductory",

        "tone":
            "ominous",

        "weirdness":
            2,
    },

    scenes={

        # =====================================================
        # CHAPEL ROAD
        # =====================================================

        "chapel_road":
            SceneDefinition(

                id=
                    "chapel_road",

                title=
                    "THE OLD CHAPEL",

                body=(
                    "The road ends beneath a dead oak tree.\n\n"
                    "Beyond it, an abandoned chapel leans against "
                    "the hillside. Its doors stand slightly open.\n\n"
                    "Something moves among the graves."
                ),

                ascii_art=r"""
                   +
                   |
              _____|_____
             /           \
            /      +      \
           /_______________\
           |      ___      |
           |     |   |     |
           |     |   |     |
        ___|_____|___|_____|___
           /   /     \   \
          /___/       \___\
""".strip(
                    "\n"
                ),

                choices=(

                    ChoiceDefinition(

                        id=
                            "enter_chapel",

                        label=
                            "ENTER THE CHAPEL",
                    ),


                    ChoiceDefinition(

                        id=
                            "search_graveyard",

                        label=
                            "SEARCH THE GRAVEYARD",

                        check=
                            CheckSpec(

                                difficulty=
                                    12,

                                skill=
                                    Skill.INVESTIGATION,
                            ),
                    ),


                    ChoiceDefinition(

                        id=
                            "watch_and_listen",

                        label=
                            "WATCH AND LISTEN",

                        check=
                            CheckSpec(

                                difficulty=
                                    10,

                                skill=
                                    Skill.AWARENESS,
                            ),
                    ),
                ),

                default_next_scene_id=
                    "chapel_bell",
            ),


        # =====================================================
        # CHAPEL BELL
        # =====================================================

        "chapel_bell":
            SceneDefinition(

                id=
                    "chapel_bell",

                title=
                    "THE BELL",

                body=(
                    "Before either of you can move farther, "
                    "the chapel bell rings once.\n\n"
                    "There is no wind.\n\n"
                    "A pale light appears behind the stained glass."
                ),

                ascii_art=r"""
                 ___________
                /           \
               /      +      \
              /_______________\
                   |     |
                ___|     |___
               |           |
               |     O     |
               |           |
               |___________|

                    DONG
""".strip(
                    "\n"
                ),

                choices=(

                    ChoiceDefinition(

                        id=
                            "approach_door",

                        label=
                            "APPROACH THE DOOR",

                        check=
                            CheckSpec(

                                difficulty=
                                    11,

                                skill=
                                    Skill.DISCIPLINE,
                            ),
                    ),


                    ChoiceDefinition(

                        id=
                            "circle_building",

                        label=
                            "CIRCLE THE BUILDING",

                        check=
                            CheckSpec(

                                difficulty=
                                    12,

                                skill=
                                    Skill.STEALTH,
                            ),
                    ),


                    ChoiceDefinition(

                        id=
                            "call_out",

                        label=
                            "CALL OUT",

                        check=
                            CheckSpec(

                                difficulty=
                                    10,

                                stat=
                                    Stat.PRESENCE,
                            ),
                    ),
                ),

                default_next_scene_id=
                    "chapel_road",
            ),
    },
)


OLD_CHAPEL.validate()
