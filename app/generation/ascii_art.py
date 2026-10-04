from __future__ import annotations

from dataclasses import dataclass
import hashlib
import random
import re
from typing import Iterable

DEFAULT_WIDTH = 68
DEFAULT_HEIGHT = 22


@dataclass(frozen=True)
class AsciiSceneContext:
    title: str
    body: str
    goal: str = ""
    threat: str = ""
    mood: str = ""


_KEYWORDS: dict[str, tuple[str, ...]] = {
    "store": ("store", "shop", "market", "superette", "aisle", "checkout", "counter"),
    "road": ("road", "street", "highway", "drive", "car", "truck", "gas station"),
    "forest": ("forest", "woods", "tree", "grove", "trail", "camp"),
    "chapel": ("chapel", "church", "grave", "cemetery", "altar", "pew"),
    "water": ("water", "lake", "sea", "river", "shore", "boat", "dock"),
    "house": ("house", "home", "room", "hall", "kitchen", "bedroom", "basement", "barn", "farm"),
    "facility": ("facility", "lab", "warehouse", "factory", "station", "office", "vault"),
}

_NIGHT_WORDS = {
    "night", "dark", "midnight", "moon", "shadow", "eerie", "ominous", "late", "evening", "blackout"
}


class Canvas:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.pixels = [[" " for _ in range(width)] for _ in range(height)]

    def put(self, x: int, y: int, ch: str) -> None:
        if 0 <= x < self.width and 0 <= y < self.height and ch:
            self.pixels[y][x] = ch[0]

    def text(self, x: int, y: int, value: str) -> None:
        for i, ch in enumerate(value):
            self.put(x + i, y, ch)

    def hline(self, x1: int, x2: int, y: int, ch: str = "-") -> None:
        for x in range(max(0, x1), min(self.width, x2 + 1)):
            self.put(x, y, ch)

    def vline(self, x: int, y1: int, y2: int, ch: str = "|") -> None:
        for y in range(max(0, y1), min(self.height, y2 + 1)):
            self.put(x, y, ch)

    def rect(self, x: int, y: int, w: int, h: int) -> None:
        if w < 2 or h < 2:
            return
        self.put(x, y, "+")
        self.put(x + w - 1, y, "+")
        self.put(x, y + h - 1, "+")
        self.put(x + w - 1, y + h - 1, "+")
        self.hline(x + 1, x + w - 2, y, "-")
        self.hline(x + 1, x + w - 2, y + h - 1, "-")
        self.vline(x, y + 1, y + h - 2, "|")
        self.vline(x + w - 1, y + 1, y + h - 2, "|")

    def fill(self, x: int, y: int, w: int, h: int, pattern: str) -> None:
        chars = pattern or " "
        idx = 0
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, chars[idx % len(chars)])
                idx += 1

    def render(self) -> str:
        return "\n".join("".join(row).rstrip() for row in self.pixels)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def _score_theme(tokens: Iterable[str]) -> str:
    token_list = list(tokens)
    best = "generic"
    best_score = 0
    for theme, words in _KEYWORDS.items():
        score = sum(1 for token in token_list for word in words if word in token)
        if score > best_score:
            best = theme
            best_score = score
    return best


def _is_night(tokens: Iterable[str]) -> bool:
    return any(token in _NIGHT_WORDS for token in tokens)


def _stable_random_seed(*parts: str) -> int:
    digest = hashlib.sha256("||".join(parts).encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def _draw_stars(c: Canvas, rng: random.Random, horizon: int) -> None:
    star_count = max(8, c.width // 5)
    for _ in range(star_count):
        c.put(rng.randint(1, c.width - 2), rng.randint(1, max(2, horizon - 2)), rng.choice([".", "*", "+"]))


def _draw_moon(c: Canvas, rng: random.Random) -> None:
    x = rng.randint(c.width - 16, c.width - 8)
    y = rng.randint(1, 3)
    c.text(x, y, "  _..._ ")
    c.text(x, y + 1, " .::::::. ")
    c.text(x, y + 2, " :::::::' ")
    c.text(x, y + 3, " `:::'   ")


def _draw_ground(c: Canvas, horizon: int, ch: str = "_") -> None:
    c.hline(0, c.width - 1, horizon, ch)
    for y in range(horizon + 1, c.height):
        for x in range(c.width):
            if (x + y) % 11 == 0:
                c.put(x, y, ".")


def _draw_person(c: Canvas, x: int, y: int) -> None:
    figure = [" O ", "/|\\", "/ \\"]
    for dy, row in enumerate(figure):
        c.text(x, y + dy, row)


def _draw_store(c: Canvas, rng: random.Random, horizon: int) -> None:
    top = max(4, horizon - 8)
    c.rect(6, top, c.width - 12, 9)
    for shelf_y in (top + 2, top + 4, top + 6):
        c.hline(11, c.width - 12, shelf_y, "=")
        for x in range(12, c.width - 12, 4):
            c.text(x, shelf_y - 1, "[]")
    c.rect(c.width // 2 - 6, top + 1, 12, 6)
    c.text(c.width // 2 - 3, top + 3, "EXIT")
    c.text(10, top - 1, "SUPRETTE" if c.width > 54 else "STORE")
    _draw_person(c, 5, horizon + 1)
    if rng.random() > 0.4:
        _draw_person(c, c.width - 10, horizon + 1)


def _draw_road(c: Canvas, rng: random.Random, horizon: int) -> None:
    center = c.width // 2
    left0 = center - 1
    right0 = center + 1
    left1 = 5
    right1 = c.width - 6
    for y in range(horizon, c.height):
        t = (y - horizon) / max(1, c.height - horizon - 1)
        left = round(left0 * (1 - t) + left1 * t)
        right = round(right0 * (1 - t) + right1 * t)
        c.put(left, y, "/")
        c.put(right, y, "\\")
        c.put((left + right) // 2, y, "|")
        if y % 2 == 0:
            c.put((left + right) // 2 + 1, y, "|")
    car_y = c.height - 5
    car_x = center - 4 + rng.randint(-3, 3)
    c.text(car_x, car_y, " ____ ")
    c.text(car_x, car_y + 1, "/_[]_\\")
    c.text(car_x, car_y + 2, "o----o")


def _draw_forest(c: Canvas, rng: random.Random, horizon: int) -> None:
    for base_x in range(4, c.width - 4, 8):
        h = rng.randint(4, 7)
        top = horizon - h
        c.text(base_x, top, " /\\ ")
        c.text(base_x, top + 1, "/**\\")
        c.text(base_x, top + 2, " /**\\")
        for y in range(top + 3, horizon + 1):
            c.put(base_x + 2, y, "|")
    _draw_person(c, c.width // 2 - 2, horizon + 1)


def _draw_chapel(c: Canvas, rng: random.Random, horizon: int) -> None:
    top = max(4, horizon - 9)
    mid = c.width // 2
    c.text(mid - 8, top, "    /\\    ")
    c.text(mid - 8, top + 1, "   /  \\   ")
    c.text(mid - 8, top + 2, "  /_/\\_\\  ")
    c.rect(mid - 10, top + 3, 20, 8)
    c.text(mid - 1, top + 4, "+")
    c.rect(mid - 3, top + 6, 6, 5)
    for gx in (10, 16, c.width - 18, c.width - 10):
        c.text(gx, horizon, "|_|")
        c.text(gx, horizon + 1, " | ")
    _draw_person(c, 7, horizon + 1)


def _draw_water(c: Canvas, rng: random.Random, horizon: int) -> None:
    for y in range(horizon, c.height):
        for x in range(c.width):
            c.put(x, y, "~" if (x + y) % 3 else "-")
    boat_x = c.width // 2 - 7
    boat_y = horizon + 3
    c.text(boat_x, boat_y, "    |\\")
    c.text(boat_x, boat_y + 1, "   /| \\")
    c.text(boat_x, boat_y + 2, "__/____\\__")


def _draw_house(c: Canvas, rng: random.Random, horizon: int) -> None:
    top = max(4, horizon - 8)
    left = c.width // 2 - 12
    c.text(left + 4, top, "   /\\   ")
    c.text(left + 3, top + 1, "  /  \\  ")
    c.rect(left, top + 2, 24, 9)
    c.rect(left + 9, top + 6, 6, 5)
    for wx in (left + 3, left + 17):
        c.rect(wx, top + 4, 4, 3)
    _draw_person(c, left - 5, horizon + 1)


def _draw_facility(c: Canvas, rng: random.Random, horizon: int) -> None:
    top = max(4, horizon - 8)
    left = 6
    width = c.width - 12
    c.rect(left, top, width, 10)
    for x in range(left + 2, left + width - 3, 6):
        c.rect(x, top + 2, 4, 3)
    c.rect(c.width // 2 - 6, top + 5, 12, 5)
    c.text(c.width // 2 - 4, top + 7, "ACCESS")
    _draw_person(c, 8, horizon + 1)


def _draw_generic(c: Canvas, rng: random.Random, horizon: int) -> None:
    hill_y = horizon - 2
    for x in range(0, c.width, 6):
        c.put(x, hill_y + (x // 6) % 2, "^")
    _draw_person(c, c.width // 2 - 2, horizon + 1)
    c.text(c.width // 2 - 6, horizon - 3, "???")


def generate_scene_ascii_art(
    title: str,
    body: str,
    *,
    goal: str = "",
    threat: str = "",
    mood: str = "",
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
) -> str:
    width = max(44, min(width, 90))
    height = max(16, min(height, 32))
    context = AsciiSceneContext(title=title or "", body=body or "", goal=goal or "", threat=threat or "", mood=mood or "")
    tokens = _tokenize(" ".join([context.title, context.body, context.goal, context.threat, context.mood]))
    theme = _score_theme(tokens)
    night = _is_night(tokens)
    rng = random.Random(_stable_random_seed(context.title, context.body, context.goal, context.threat, context.mood, theme))

    c = Canvas(width, height)
    horizon = max(6, height // 2)
    if night:
        _draw_stars(c, rng, horizon)
        if rng.random() > 0.3:
            _draw_moon(c, rng)
    else:
        c.text(2, 1, "~" * 8)
        if width > 56:
            c.text(width - 14, 2, "._.   ._.")

    _draw_ground(c, horizon)

    drawer = {
        "store": _draw_store,
        "road": _draw_road,
        "forest": _draw_forest,
        "chapel": _draw_chapel,
        "water": _draw_water,
        "house": _draw_house,
        "facility": _draw_facility,
        "generic": _draw_generic,
    }.get(theme, _draw_generic)
    drawer(c, rng, horizon)

    # top title band - keeps a consistent silhouette without using huge labels.
    title_label = (title or "THE STORY CONTINUES").strip().upper()
    title_label = re.sub(r"[^A-Z0-9 !?&'/-]+", "", title_label)[: width - 6]
    if title_label:
        c.text(max(2, (width - len(title_label)) // 2), 0, title_label)

    # Add one subtle focal marker if there is a threat.
    if threat.strip():
        tx = rng.randint(width // 3, width - 8)
        ty = rng.randint(max(2, horizon - 6), max(3, horizon - 2))
        c.text(tx, ty, rng.choice(["@@", "##", "!!", "??"]))

    return c.render()


__all__ = ["generate_scene_ascii_art", "AsciiSceneContext"]
