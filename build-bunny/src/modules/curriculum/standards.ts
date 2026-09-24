/**
 * Suggested alignment of the curriculum's concept tags to the CSTA K–12
 * Computer Science Standards (2017): level 1B (grades 3–5) and level 2
 * (grades 6–8). This is Build Bunny's own reading of which standards a level
 * practises, shown to teachers as "suggested alignment" — it is not an
 * endorsement by CSTA and not a claim that one level meets a standard.
 *
 * Tags with no entry (e.g. "learn", which only marks a worked-example step)
 * contribute nothing.
 */
export const CSTA_CODES = [
  "1B-AP-08",
  "1B-AP-09",
  "1B-AP-10",
  "1B-AP-11",
  "1B-AP-13",
  "1B-AP-15",
  "1B-AP-17",
  "1B-CS-02",
  "1B-DA-06",
  "1B-DA-07",
  "1B-IC-20",
  "1B-NI-05",
  "2-AP-11",
  "2-AP-12",
  "2-AP-13",
  "2-AP-17",
  "2-CS-02",
  "2-DA-07",
  "2-DA-08",
  "2-DA-09",
  "2-IC-20",
  "2-IC-21",
  "2-IC-23",
] as const;

export type CstaCode = (typeof CSTA_CODES)[number];

const AI_MODELS: CstaCode[] = ["1B-DA-07", "2-DA-09"];
const DATA_PREP: CstaCode[] = ["1B-DA-06", "2-DA-08"];

export const TAG_STANDARDS: Readonly<Record<string, readonly CstaCode[]>> = {
  sequencing: ["1B-AP-10"],
  loops: ["1B-AP-10", "2-AP-12"],
  conditionals: ["1B-AP-10", "2-AP-12"],
  logic: ["2-AP-12"],
  variables: ["1B-AP-09", "2-AP-11"],
  functions: ["1B-AP-11", "2-AP-13"],
  debugging: ["1B-AP-15", "2-AP-17"],
  "reading-code": ["1B-AP-15"],
  algorithms: ["1B-AP-08"],
  creative: ["1B-AP-13", "1B-AP-17"],
  robot: ["1B-CS-02"],
  sensors: ["2-CS-02"],
  ai: AI_MODELS,
  ml: AI_MODELS,
  classification: AI_MODELS,
  features: AI_MODELS,
  prediction: AI_MODELS,
  regression: AI_MODELS,
  evaluation: AI_MODELS,
  "training-loop": AI_MODELS,
  "train-test-split": AI_MODELS,
  "model-selection": AI_MODELS,
  boundary: ["2-DA-09"],
  boundaries: ["2-DA-09"],
  "cost-sensitivity": ["2-DA-09"],
  "local-optima": ["2-DA-09"],
  clustering: ["1B-DA-07"],
  kmeans: ["1B-DA-07"],
  "spurious-correlation": ["1B-DA-07"],
  data: DATA_PREP,
  "data-quality": ["2-DA-08"],
  "data-cleaning": ["2-DA-08"],
  outliers: ["2-DA-08"],
  pixels: ["2-DA-07"],
  "computer-vision": ["2-DA-07"],
  ethics: ["1B-IC-20", "2-IC-21"],
  bias: ["2-IC-21"],
  privacy: ["1B-NI-05", "2-IC-23"],
  "cyber-safety": ["1B-NI-05", "2-IC-23"],
  misinformation: ["2-IC-20"],
  "media-literacy": ["2-IC-20"],
};

/** Distinct codes for a set of tags, in the catalogue's order. */
export function standardsForTags(tags: readonly string[]): CstaCode[] {
  const found = new Set<CstaCode>();
  for (const tag of tags) for (const code of TAG_STANDARDS[tag] ?? []) found.add(code);
  return CSTA_CODES.filter((code) => found.has(code));
}
