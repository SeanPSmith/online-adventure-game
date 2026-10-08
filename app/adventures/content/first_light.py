"""Finite, curated introduction. No model calls or generated content required."""
from app.adventures.models import AdventureDefinition, SceneDefinition, ChoiceDefinition, CheckSpec
from app.characters.models import Skill

def choice(id, label, description, skill=None):
    return ChoiceDefinition(id=id, label=label, description=description,
                            check=CheckSpec(difficulty=8, skill=skill) if skill else None)

FIRST_LIGHT = AdventureDefinition(
    id="first_light", title="FIRST LIGHT",
    description="Carry a lost lantern home before dawn. A gentle introduction to choices, dice, and playing together.",
    starting_scene_id="harbor", tags=("starter", "hopeful", "short"),
    metadata={"starter_adventure": True, "world_title": "LANTERN HARBOR",
              "difficulty": "introductory", "expected_minutes": "5–10", "player_count": "1–2",
              "terminal_scene_ids": ["home"], "ending_label": "A LIGHT BROUGHT HOME",
              "player_synopsis": "A lighthouse keeper has lost the lantern that guides fishing boats through the harbor. Find a safe route across the tideway and bring it home. Three short turns for 1–2 players; no AI generation is needed."},
    scenes={
        "harbor": SceneDefinition(id="harbor", title="THE LANTERN ON THE QUAY", ascii_art="", body=(
            "A brass lantern glows beside an empty fishing boat. Across the harbor, the lighthouse is dark.\n\n"
            "An old ferryman nods toward the keeper's cottage. 'That light belongs up there.'\n\n"
            "Choose what your Hero does. An action with a dice check uses your Hero's abilities; a poor roll still moves this story forward."),
            choices=(choice("ask", "ASK THE FERRYMAN", "Find out which path is safest."),
                     choice("look", "READ THE TIDE MARKS", "Use Awareness to inspect the crossing.", Skill.AWARENESS)),
            default_next_scene_id="crossing"),
        "crossing": SceneDefinition(id="crossing", title="THE TIDEWAY", ascii_art="", body=(
            "The ferry rope stretches across a narrow channel. The lantern casts warm circles over the water.\n\n"
            "There is room for everyone aboard. You can wait for a calm moment or steady the boat yourself.\n\n"
            "Playing together? Each Hero chooses an action. The turn resolves once everyone locks in."),
            choices=(choice("wait", "WAIT FOR CALM WATER", "Use Awareness to spot a calm moment.", Skill.AWARENESS),
                     choice("steady", "STEADY THE FERRY", "Use Discipline to keep the lantern dry.", Skill.DISCIPLINE)),
            default_next_scene_id="cottage"),
        "cottage": SceneDefinition(id="cottage", title="THE KEEPER'S DOOR", ascii_art="", body=(
            "The cottage windows are dark, but a kettle whistles inside. A tired voice asks who is there.\n\n"
            "The lantern is nearly home. Decide how you deliver it. Your Hero's progress is saved automatically."),
            choices=(choice("knock", "KNOCK AND RETURN THE LIGHT", "Tell the keeper where you found it."),
                     choice("leave", "LEAVE IT ON THE STEP", "Let the lantern announce its own return.")),
            default_next_scene_id="home"),
        "home": SceneDefinition(id="home", title="FIRST LIGHT", ascii_art="", body=(
            "The keeper lifts the lantern into the lighthouse window. A golden beam sweeps across the harbor.\n\n"
            "Out on the tide, a fishing boat answers with a bell. You brought a small light home, and it was enough.\n\n"
            "Your first adventure is complete. Find this Chronicle in My Adventures, or choose another story on Home."), choices=()),
    },
)
FIRST_LIGHT.validate()
