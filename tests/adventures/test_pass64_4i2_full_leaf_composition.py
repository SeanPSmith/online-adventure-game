"""Pass 64.4I.2: balanced page-print areas without changing manuscript motion/gameplay."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[2]
CAT = (ROOT / "frontend/src/features/cosmetics/environmentCatalog.ts").read_text(encoding="utf-8")
CSS = (ROOT / "frontend/src/pages/game/inkspaceStory.css").read_text(encoding="utf-8")
STORY = (ROOT / "frontend/src/pages/game/InkspaceStoryPage.tsx").read_text(encoding="utf-8")

def rect(name):
    m = re.search(rf"\b{name}:\s*\{{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*width:\s*([\d.]+),\s*height:\s*([\d.]+)", CAT)
    assert m is not None, name
    return tuple(map(float, m.groups()))

def test_proportional_margins_are_balanced_and_use_more_paper():
    lp, rp, l, r = (rect(k) for k in ("leftPage", "rightPage", "left", "right"))
    lo, lg = (l[0]-lp[0])/lp[2], (lp[0]+lp[2]-l[0]-l[2])/lp[2]
    ro, rg = (rp[0]+rp[2]-r[0]-r[2])/rp[2], (r[0]-rp[0])/rp[2]
    assert .10 < lo < .13 and .10 < ro < .13
    assert .045 < lg < .075 and .045 < rg < .075
    assert abs(lo-ro) < .01 and abs(lg-rg) < .01
    assert lo > lg and ro > rg
    assert l[2] > .26 and r[2] > .28
    assert l[1] == r[1] and l[3] == r[3] and l[3] >= .59

def test_physical_book_stays_stationary_only_real_ink_is_masked():
    assert "SCENE_COMPOSITING.contentSafeZones[side]" in STORY
    assert "style.maskImage = maskURL" in STORY
    assert "style.webkitMaskImage = maskURL" in STORY
    assert ".inkspace-page-ink" in CSS and "mask-size:100% 100%" in CSS
    assert ".inkspace-leaf--left{clip-path:polygon(" in CSS
    assert ".inkspace-leaf--right{clip-path:polygon(" in CSS
    assert "frontend/src/pages/game/AdventurePage.tsx" not in CSS


def test_small_screen_keeps_single_column_and_live_html_content():
    assert "@media(max-width:860px)" in CSS
    assert ".inkspace-leaf{position:relative" in CSS
    assert '<h1 className="inkspace-title">' in STORY
    assert '<img src={art.src} alt={art.alt}' in STORY
    assert "window.confirm" not in STORY
