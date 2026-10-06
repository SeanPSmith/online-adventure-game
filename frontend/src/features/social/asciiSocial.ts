export type AsciiReactionGroup =
  | "HAPPY"
  | "CHAOS"
  | "SUSPICIOUS"
  | "PANIC"
  | "SAD"
  | "IDLE"
  | "SOCIAL";

export interface AsciiReaction {
  value: string;
  label: string;
  group: AsciiReactionGroup;
}

export const ASCII_REACTIONS: AsciiReaction[] = [
  { value: ":)", label: "happy", group: "HAPPY" },
  { value: ":D", label: "grin", group: "HAPPY" },
  { value: ";)", label: "wink", group: "HAPPY" },
  { value: ":P", label: "tongue", group: "HAPPY" },
  { value: "^_^", label: "pleased", group: "HAPPY" },
  { value: "\\(^_^)/", label: "victory", group: "HAPPY" },
  { value: "(•̀ᴗ•́)و", label: "nailed it", group: "HAPPY" },
  { value: "(ﾉ◕ヮ◕)ﾉ", label: "hype", group: "HAPPY" },

  { value: ">:D", label: "villain", group: "CHAOS" },
  { value: ">:(", label: "angry", group: "CHAOS" },
  { value: "(ง'̀-'́)ง", label: "fight", group: "CHAOS" },
  { value: "(╬ಠ益ಠ)", label: "rage", group: "CHAOS" },
  { value: "(╯°□°)╯︵ ┻━┻", label: "table flip", group: "CHAOS" },
  { value: "┬─┬ ノ( ゜-゜ノ)", label: "table restore", group: "CHAOS" },
  { value: "XD", label: "laughing", group: "CHAOS" },
  { value: "x_x", label: "dead", group: "CHAOS" },

  { value: "<_<", label: "side eye left", group: "SUSPICIOUS" },
  { value: ">_>", label: "side eye right", group: "SUSPICIOUS" },
  { value: "(¬_¬)", label: "skeptical", group: "SUSPICIOUS" },
  { value: "(¬‿¬)", label: "smug", group: "SUSPICIOUS" },
  { value: "ಠ_ಠ", label: "disapproval", group: "SUSPICIOUS" },
  { value: "ಠ‿ಠ", label: "sinister pleased", group: "SUSPICIOUS" },
  { value: "(•_•)", label: "stare", group: "SUSPICIOUS" },
  { value: "( •_•)>⌐■-■", label: "putting on shades", group: "SUSPICIOUS" },
  { value: "(⌐■_■)", label: "cool", group: "SUSPICIOUS" },

  { value: ":O", label: "shocked", group: "PANIC" },
  { value: "O_O", label: "stunned", group: "PANIC" },
  { value: "o_o", label: "confused", group: "PANIC" },
  { value: "@_@", label: "dizzy", group: "PANIC" },
  { value: ">_<", label: "frustrated", group: "PANIC" },
  { value: "Σ(°△°|||)", label: "panic", group: "PANIC" },
  { value: "(⊙_⊙;)", label: "alarm", group: "PANIC" },
  { value: "(°ロ°)!", label: "what", group: "PANIC" },

  { value: ":(", label: "sad", group: "SAD" },
  { value: ":'(", label: "crying", group: "SAD" },
  { value: "T_T", label: "tears", group: "SAD" },
  { value: "ಥ_ಥ", label: "devastated", group: "SAD" },
  { value: "(×_×)", label: "wrecked", group: "SAD" },
  { value: "._.", label: "awkward", group: "SAD" },
  { value: ":/", label: "unsure", group: "SAD" },

  { value: "-_-", label: "unimpressed", group: "IDLE" },
  { value: "(-_-)", label: "waiting", group: "IDLE" },
  { value: "(-_-) zzz", label: "sleeping", group: "IDLE" },
  { value: "(－_－) zzZ", label: "very sleeping", group: "IDLE" },
  { value: "(￣ω￣;)", label: "patiently awkward", group: "IDLE" },
  { value: "¯\\_(ツ)_/¯", label: "shrug", group: "IDLE" },
  { value: "┐('～`;)┌", label: "what can you do", group: "IDLE" },

  { value: "<3", label: "heart", group: "SOCIAL" },
  { value: ":3", label: "cute", group: "SOCIAL" },
  { value: "(づ｡◕‿‿◕｡)づ", label: "hug", group: "SOCIAL" },
  { value: "(^_^)/", label: "hello", group: "SOCIAL" },
  { value: "o/", label: "wave", group: "SOCIAL" },
  { value: "\\o/", label: "celebrate", group: "SOCIAL" },
  { value: "( ͡° ͜ʖ ͡°)", label: "mischief", group: "SOCIAL" },
];

export const ASCII_REACTION_GROUPS: AsciiReactionGroup[] = [
  "HAPPY",
  "SOCIAL",
  "SUSPICIOUS",
  "PANIC",
  "CHAOS",
  "SAD",
  "IDLE",
];

export function presenceFace(online: boolean, ready: boolean) {
  if (!online) return "(-_-)";
  if (ready) return "(^_^)/";
  return "o_o";
}

export function notificationFace(kind: string) {
  if (kind === "room_invite") return "(^_^)/";
  if (kind === "partner_joined") return "o/";
  if (kind === "your_turn") return ">_>";
  if (kind === "partner_locked") return "(•̀ᴗ•́)و";
  if (kind === "results_ready") return "\\o/";
  return ":)";
}
