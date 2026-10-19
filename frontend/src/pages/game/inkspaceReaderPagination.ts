/** Pass 64.4J — deterministic manuscript pagination. Presentation only.
 * Server remains authoritative for actual narration, choices, dice and XP.
 */
export type ReaderChoice = Readonly<{ id: string; label: string }>;
export type ReaderDocument = Readonly<{
  id: string; eyebrow: string; title: string; subtitle: string;
  paragraphs: readonly string[];
  art: Readonly<{ src: string; alt: string; caption?: string }>;
  choices?: readonly ReaderChoice[];
}>;
export type ReaderLeaf = Readonly<{
  index: number;
  title: boolean;
  art: boolean;
  text: readonly string[];
  choices: boolean;
}>;
export type ReaderSpread = Readonly<{ left: ReaderLeaf; right: ReaderLeaf }>;
export type ReaderDimensions = Readonly<{ width: number; height: number; fontSize: number }>;

// Canvas measurements match the reader's Georgia typography closely, with
// intentional extra clearance rather than crowding ink against paper edges.
function lineCounter(width: number, size: number): (s: string) => number {
  const ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (ctx) ctx.font = `${size}px Georgia`;
  const maxWidth = Math.max(120, width);
  return (text: string) => {
    let lines = 1, used = 0;
    for (const word of text.split(/\s+/)) {
      const px = ctx ? ctx.measureText(`${word} `).width : (word.length + 1) * size * .53;
      if (used > 0 && used + px > maxWidth) { lines += 1; used = 0; }
      used += px;
    }
    return lines;
  };
}

export function paginateReader(documentData: ReaderDocument, dims: ReaderDimensions): ReaderSpread[] {
  const font = Math.max(12, dims.fontSize);
  const lineHeight = font * 1.51;
  const pageHeight = Math.max(180, dims.height - 42); // folio inset and footer
  const linesFor = lineCounter(dims.width - 35, font);
  const pages: { index: number; title: boolean; art: boolean; text: string[]; choices: boolean }[] = [];
  const newPage = () => {
    const index = pages.length;
    const entry = { index, title: index === 0, art: index === 1, text: [] as string[], choices: false };
    pages.push(entry);
    return entry;
  };
  let page = newPage();
  let occupied = 0;
  const reserved = (entry: typeof page) => (entry.title ? Math.min(152, pageHeight * .35) : 0) +
    (entry.art ? Math.min(206, pageHeight * .43) : 0);
  const usable = (entry: typeof page) => Math.max(lineHeight * 3, pageHeight - reserved(entry) - 22);
  const add = (text: string) => {
    const count = linesFor(text);
    const need = count * lineHeight + font * .70;
    page.text.push(text);
    occupied += need;
  };
  for (const paragraph of documentData.paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let current = "";
    for (const word of words) {
      const attempt = current ? `${current} ${word}` : word;
      const projected = linesFor(attempt) * lineHeight + font * .70;
      if (current && occupied + projected > usable(page)) {
        // Prefer paragraph boundaries; split long paragraphs safely by words.
        add(current);
        page = newPage(); occupied = 0;
        current = word;
      } else if (!current && occupied + projected > usable(page) && page.text.length) {
        page = newPage(); occupied = 0; current = word;
      } else current = attempt;
    }
    if (current) {
      if (occupied + linesFor(current) * lineHeight + font * .70 > usable(page) && page.text.length) {
        page = newPage(); occupied = 0;
      }
      add(current);
    }
  }
  if (documentData.choices?.length) {
    // The choice page is explicit: the player reads narration first, then chooses.
    // No roll, state mutation, or Director request occurs in this lab.
    if (page.text.length || page.title || page.art) page = newPage();
    page.choices = true;
  }
  if (pages.length % 2) newPage();
  const result: ReaderSpread[] = [];
  for (let i = 0; i < pages.length; i += 2) result.push({ left: pages[i], right: pages[i + 1] });
  return result;
}

export const READER_DEMO: ReaderDocument = {
  id: "road-that-watches-back-ch1",
  eyebrow: "FROM THE OPEN CHRONICLE · CHAPTER XVII",
  title: "The Road That Watches Back",
  subtitle: "Some roads are older than maps.",
  art: {
    src: "/art/pass64/inkspace/river-fortress-cutout.png",
    alt: "Transparent watercolor study of a ruined stone bridge, misty waterfalls, pine woods, and a distant tower.",
    caption: "THE NORTHERN PASS · AN ILLUMINATED FIELD SKETCH",
  },
  paragraphs: [
    "The forest did not begin at the edge of the road. It began in the spaces between your thoughts, in the places you stopped looking. The trees had watched travelers for centuries, and their roots remembered every footprint, whether it was meant to be found or not.",
    "At the milepost, three arrows pointed toward lost towns. Two names were hidden by moss; the third had been scratched away. Your companion nudged your elbow, and somewhere beyond the birches a bell rang exactly once.",
    "You unfolded the map. The inked river looked almost like the one below, but the bridge was wrong. The cartographer had drawn seven arches. Across the gorge stood only six, and beneath the missing span a pale mist climbed against the current.",
    "A blue-black bird settled on the signpost, tilted its head, and spoke in a voice you recognized. ‘You've come late,’ it said. ‘The road was beginning to think you would never return.’",
    "Northward, water plunged between rocks with the steady hush of distant voices. Eastward, the road wound toward an empty tower where bright glass flashed in a window too high to reach. Westward, the pine woods shut quietly behind you.",
    "The bell sounded again. This time the whole valley seemed to listen. You could feel the road under your boots, not moving exactly, but waiting—as if the next step belonged as much to it as it did to you.",
    "On the back of the map, beneath a stain shaped like a heart, someone had written a warning in faded red ink: Every road remembers the ones who choose it.",
  ],
  choices: [
    { id: "bridge", label: "Cross the broken bridge before the bell sounds again." },
    { id: "tower", label: "Follow the bright window in the distant tower." },
    { id: "raven", label: "Ask the strange bird who it has mistaken you for." },
  ],
};
