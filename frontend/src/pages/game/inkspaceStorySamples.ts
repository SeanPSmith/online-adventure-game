/** Pass 64.4I — explicitly fictional, deterministic art-direction samples.
 * Not adventure data, Director output, saved progression, or a story API.
 */
export type InkspaceMode = "narrative" | "art-forward" | "illuminated";
export type InkspacePageArt = Readonly<{
  src: string;
  alt: string;
  caption?: string;
  placement?: "opening" | "interlude" | "ending";
}>;
export type InkspacePageContent = Readonly<{
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  openingParagraph?: string;
  bodyParagraphs?: readonly string[];
  quote?: Readonly<{ text: string; attribution?: string }>;
  callout?: Readonly<{ label?: string; text: string }>;
  artPrimary?: InkspacePageArt;
  artSecondary?: InkspacePageArt;
  rubricLabel?: string;
  ornaments?: readonly string[];
}>;
export type InkspaceStorySpread = Readonly<{
  id: string;
  mode: InkspaceMode;
  theme: "brighter-world" | "manuscript";
  leftPage: InkspacePageContent;
  rightPage: InkspacePageContent;
}>;

export const INKSPACE_STORIES: Readonly<Record<InkspaceMode, InkspaceStorySpread>> = {
  narrative: {
    id: "road-that-watches-back", mode: "narrative", theme: "manuscript",
    leftPage: {
      eyebrow: "FROM THE OPEN CHRONICLE", title: "The Road That Watches Back",
      subtitle: "Some roads are older than maps.",
      openingParagraph: "The forest did not begin at the edge of the road. It began in the spaces between your thoughts, in the places you stopped looking.",
      bodyParagraphs: [
        "At the milepost, three arrows pointed toward lost towns. Two names were hidden by moss; the third had been scratched away.",
        "Beyond the birches, a bell rang. Your companion looked up, and the road held its breath.",
      ],
      rubricLabel: "A NOTE IN THE MARGIN",
      artSecondary: {
        src: "/art/pass64/inkspace/forgotten-crossroads-cutout.png",
        alt: "An ink-and-watercolor sketch of a weathered crossroads sign below distant blue mountains.",
        placement: "ending",
      },
      ornaments: ["botanical", "illuminated-initial"],
    },
    rightPage: {
      eyebrow: "THE WANDERER'S CODEX",
      artPrimary: {
        src: "/art/pass64/inkspace/river-fortress-cutout.png",
        alt: "Watercolor landscape of a ruined stone bridge, a misty waterfall, trees, and a distant fortress.",
        caption: "THE NORTHERN PASS · LEAF XVII",
        placement: "opening",
      },
      bodyParagraphs: [
        "Northward, water fell through a gorge like distant voices. Eastward, the road climbed toward an empty tower.",
        "The wood was older than your map. Now it was waiting.",
      ],
      quote: { text: "Every road remembers the ones who choose it.", attribution: "The Wanderer's Codex" },
      ornaments: ["filigree"],
    },
  },
  "art-forward": {
    id: "atlas-of-small-wonders", mode: "art-forward", theme: "brighter-world",
    leftPage: {
      eyebrow: "THE ATLAS OF POSSIBILITIES", title: "Where the Mountains Keep Secrets",
      subtitle: "A page from the traveler's unfinished atlas.",
      artPrimary: {
        src: "/art/pass64/inkspace/harbor-traveler-cutout.png",
        alt: "Painted sunlit fantasy coastline with mountains, a distant castle, a traveler, and their dog.",
        caption: "PLATE IV · BEYOND THE HARBOR",
        placement: "interlude",
      },
      rubricLabel: "A PLACE NOT YET NAMED",
      ornaments: ["botanical"],
    },
    rightPage: {
      eyebrow: "NOTES FROM THE ROAD",
      openingParagraph: "Morning found the valley full of gold. Even the stones seemed to remember sunlight from a thousand summers.",
      bodyParagraphs: [
        "Far below, little boats crossed a river so clear that the clouds appeared to travel beneath them. Somewhere on the opposite shore, a bell called strangers home.",
        "You marked the place with a tiny blue flower. A name could come later; first, you wanted to remember how it felt.",
      ],
      callout: { label: "FIELD NOTE · NO. 04", text: "The map may be accurate. The wonder never is." },
      artSecondary: {
        src: "/art/pass64/inkspace/forgotten-crossroads-cutout.png",
        alt: "Hand-painted vignette of an old path and mountain signpost.",
        placement: "ending",
      },
      ornaments: ["filigree"],
    },
  },
  illuminated: {
    id: "illuminated-forest", mode: "illuminated", theme: "manuscript",
    leftPage: {
      eyebrow: "THE ILLUMINATED CHRONICLE", title: "The Keeper of the Green Door",
      subtitle: "An old promise, written in vermilion.",
      openingParagraph: "Before the first king raised a banner, there was a door in the oldest tree, and beside it a woman who remembered every name the wind had carried.",
      bodyParagraphs: [
        "Travelers offered coins. She asked for stories. Some gave her both; those who had nothing still found the door opened for them.",
        "On the morning you arrived, the iron latch had turned red with rust, yet someone had polished the little brass keyhole.",
      ],
      rubricLabel: "HERE BEGINS THE THIRD LEAF",
      ornaments: ["illuminated-initial", "botanical", "filigree"],
    },
    rightPage: {
      eyebrow: "AN IMAGE IN THE MARGIN",
      artPrimary: {
        src: "/art/pass64/inkspace/river-fortress-cutout.png",
        alt: "An illuminated landscape vignette showing a stone bridge and misty tower among trees.",
        caption: "A ROAD THROUGH THE ANCIENT WOOD",
        placement: "opening",
      },
      callout: { label: "IN RED INK", text: "A promise is a kind of doorway. Mind how you enter." },
      bodyParagraphs: [
        "She touched the bark. Fine gold veins caught the light; then the door answered with a gentle click.",
        "Your name appeared along its edge, as if freshly written.",
      ],
      quote: { text: "What is remembered is never truly lost.", attribution: "A marginal note" },
      ornaments: ["botanical", "filigree"],
    },
  },
} as const;

export const INKSPACE_MODES: ReadonlyArray<Readonly<{ id: InkspaceMode; name: string }>> = [
  { id: "narrative", name: "Story" },
  { id: "art-forward", name: "Illustrated" },
  { id: "illuminated", name: "Illuminated" },
];
