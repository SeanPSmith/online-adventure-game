from app.adventures.models import (
    AdventureDefinition,
    CheckSpec,
    ChoiceDefinition,
    FlagCondition,
    FlagEffect,
    SceneDefinition,
)

from app.characters.models import (
    Skill,
    Stat,
)


# =========================================================
# THE WINDROAD LANTERN
#
# A compact whimsical fantasy travel adventure intended to
# prove that the engine can run content completely separate
# from The Old Chapel.
#
# The structure is deliberately small:
#
#     HILL ROAD
#         ↓
#     BROKEN BRIDGE
#         ↓
#     LANTERN MARKET
#         ↓
#     SKY FERRY
#         ↓
#     HILL ROAD
#
# It also exercises world flags and conditional choices.
# =========================================================

WINDROAD_LANTERN = AdventureDefinition(

    id=
        "windroad_lantern",

    title=
        "THE WINDROAD LANTERN",

    description=
        (
            "A whimsical fantasy journey through windy hills, "
            "a broken bridge, a lantern market, and a ferry "
            "that sails the evening sky."
        ),

    starting_scene_id=
        "hill_road",

    tags=(
        "fantasy",
        "whimsy",
        "travel",
        "adventure",
        "gentle",
    ),

    metadata={
        "difficulty":
            "introductory",

        "tone":
            "whimsical",

        "weirdness":
            3,
    },

    scenes={

        # =====================================================
        # HILL ROAD
        # =====================================================

        "hill_road":
            SceneDefinition(

                id=
                    "hill_road",

                title=
                    "THE WINDROAD",

                body=(
                    "The road curls over green hills beneath a "
                    "wide blue sky.\n\n"
                    "Tiny paper charms tied to the fence posts "
                    "flutter whenever the wind changes direction.\n\n"
                    "Far ahead, a yellow lantern hangs from a "
                    "walking stick planted beside the road. "
                    "No traveler is anywhere near it."
                ),

                ascii_art=r"""
          _       _       _
       __/ \_____/ \_____/ \__
     _/                     __\_
    /     .       .       .     \
---/-------------------------------\---
       |       |       |
      [ ]     [ ]     [ ]
                 *
                /|\
                 |
""".strip(
                    "\n"
                ),

                choices=(

                    ChoiceDefinition(

                        id=
                            "take_lantern",

                        label=
                            "TAKE THE LANTERN",

                        set_flags=(
                            FlagEffect(

                                key=
                                    "has_windroad_lantern",

                                value=
                                    True,
                            ),
                        ),
                    ),


                    ChoiceDefinition(

                        id=
                            "inspect_charms",

                        label=
                            "INSPECT THE PAPER CHARMS",

                        check=
                            CheckSpec(

                                difficulty=
                                    9,

                                skill=
                                    Skill.KNOWLEDGE,
                            ),

                        set_flags=(
                            FlagEffect(

                                key=
                                    "understands_wind_charms",

                                value=
                                    True,
                            ),
                        ),
                    ),


                    ChoiceDefinition(

                        id=
                            "follow_road",

                        label=
                            "FOLLOW THE ROAD",
                    ),
                ),

                default_next_scene_id=
                    "broken_bridge",
            ),


        # =====================================================
        # BROKEN BRIDGE
        # =====================================================

        "broken_bridge":
            SceneDefinition(

                id=
                    "broken_bridge",

                title=
                    "THE BROKEN BRIDGE",

                body=(
                    "The road ends at a narrow ravine.\n\n"
                    "Half of the old wooden bridge hangs crooked "
                    "over the water below. On the opposite bank, "
                    "a round blue creature in a straw hat waves "
                    "frantically beside a cart full of peaches."
                ),

                ascii_art=r"""
      road                    road
=======\                    /=======
        \__              __/
           \            /
            \          /
             \________/
              ~ ~ ~ ~
            ~  river  ~
              ~ ~ ~ ~
""".strip(
                    "\n"
                ),

                choices=(

                    ChoiceDefinition(

                        id=
                            "repair_bridge",

                        label=
                            "REPAIR THE BRIDGE",

                        check=
                            CheckSpec(

                                difficulty=
                                    11,

                                skill=
                                    Skill.TECHNOLOGY,
                            ),

                        set_flags=(
                            FlagEffect(

                                key=
                                    "bridge_repaired",

                                value=
                                    True,
                            ),
                        ),
                    ),


                    ChoiceDefinition(

                        id=
                            "find_crossing",

                        label=
                            "SEARCH FOR A SAFE CROSSING",

                        check=
                            CheckSpec(

                                difficulty=
                                    10,

                                skill=
                                    Skill.SURVIVAL,
                            ),
                    ),


                    ChoiceDefinition(

                        id=
                            "ask_the_wind",

                        label=
                            "ASK THE WIND CHARMS FOR HELP",

                        check=
                            CheckSpec(

                                difficulty=
                                    8,

                                stat=
                                    Stat.PRESENCE,
                            ),

                        visible_if=(
                            FlagCondition(

                                key=
                                    "understands_wind_charms",

                                equals=
                                    True,
                            ),
                        ),

                        set_flags=(
                            FlagEffect(

                                key=
                                    "wind_helped_crossing",

                                value=
                                    True,
                            ),
                        ),
                    ),
                ),

                default_next_scene_id=
                    "lantern_market",
            ),


        # =====================================================
        # LANTERN MARKET
        # =====================================================

        "lantern_market":
            SceneDefinition(

                id=
                    "lantern_market",

                title=
                    "THE LANTERN MARKET",

                body=(
                    "By sunset the road reaches a market built "
                    "beneath enormous flowering trees.\n\n"
                    "Lanterns drift between the branches without "
                    "strings. Vendors sell cloudberries, bottled "
                    "songs, brass keys, and steaming dumplings.\n\n"
                    "A fox-faced ticket keeper guards the stairs "
                    "to the sky ferry."
                ),

                ascii_art=r"""
      .      *       .       *
   .-^-.
  /     \       o       o
 /_______\    (___)   (___)
 | [] [] |     | |     | |
_|_______|_____|_|_____|_|____
   lantern market       /\
                        ||
                    SKY FERRY
""".strip(
                    "\n"
                ),

                choices=(

                    ChoiceDefinition(

                        id=
                            "trade_lantern",

                        label=
                            "TRADE THE STRANGE LANTERN FOR PASSAGE",

                        visible_if=(
                            FlagCondition(

                                key=
                                    "has_windroad_lantern",

                                equals=
                                    True,
                            ),
                        ),

                        set_flags=(
                            FlagEffect(

                                key=
                                    "ferry_passage",

                                value=
                                    True,
                            ),
                        ),
                    ),


                    ChoiceDefinition(

                        id=
                            "help_vendor",

                        label=
                            "HELP A DUMPLING VENDOR CATCH RUNAWAY POTS",

                        check=
                            CheckSpec(

                                difficulty=
                                    10,

                                skill=
                                    Skill.ACROBATICS,
                            ),

                        set_flags=(
                            FlagEffect(

                                key=
                                    "ferry_passage",

                                value=
                                    True,
                            ),
                        ),
                    ),


                    ChoiceDefinition(

                        id=
                            "convince_keeper",

                        label=
                            "CONVINCE THE TICKET KEEPER",

                        check=
                            CheckSpec(

                                difficulty=
                                    11,

                                skill=
                                    Skill.PERSUASION,
                            ),

                        set_flags=(
                            FlagEffect(

                                key=
                                    "ferry_passage",

                                value=
                                    True,
                            ),
                        ),
                    ),
                ),

                default_next_scene_id=
                    "sky_ferry",
            ),


        # =====================================================
        # SKY FERRY
        # =====================================================

        "sky_ferry":
            SceneDefinition(

                id=
                    "sky_ferry",

                title=
                    "THE SKY FERRY",

                body=(
                    "The ferry rises silently above the market.\n\n"
                    "Below, the hills become green islands in a "
                    "silver sea of evening mist. The moon appears "
                    "close enough to touch.\n\n"
                    "The captain points toward a distant mountain "
                    "where a single red light blinks from the peak.\n\n"
                    "\"That,\" she says, \"is where the road goes next.\""
                ),

                ascii_art=r"""
                    .       *
             __________________
        ____/__________________\____
       /____________________________\
              \              /
               \____________/
                    ||
                    ||
             ~ ~ ~  ||  ~ ~ ~
          hills below the clouds
""".strip(
                    "\n"
                ),

                choices=(

                    ChoiceDefinition(

                        id=
                            "watch_mountain",

                        label=
                            "WATCH THE DISTANT MOUNTAIN",

                        check=
                            CheckSpec(

                                difficulty=
                                    9,

                                skill=
                                    Skill.AWARENESS,
                            ),
                    ),


                    ChoiceDefinition(

                        id=
                            "talk_to_captain",

                        label=
                            "ASK THE CAPTAIN ABOUT THE RED LIGHT",

                        check=
                            CheckSpec(

                                difficulty=
                                    9,

                                skill=
                                    Skill.PERSUASION,
                            ),
                    ),


                    ChoiceDefinition(

                        id=
                            "enjoy_the_ride",

                        label=
                            "SIT BACK AND ENJOY THE RIDE",
                    ),
                ),

                default_next_scene_id=
                    "hill_road",
            ),
    },
)


WINDROAD_LANTERN.validate()
