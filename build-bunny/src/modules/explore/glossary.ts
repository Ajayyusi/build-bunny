/**
 * "What is this called?" (handoff: no technical labels on the first screen
 * unless the child asks). The proper names for what an AI activity does,
 * each with one plain sentence, opened on request from the level. Grade 5
 * to 7 children are the ones who'll mostly want it; nobody has to.
 *
 * Terms are chosen from a level's concept tags, so every AI level gets the
 * words for its own idea. Client-safe. Copy: student.glossary.<term>.
 */

export const GLOSSARY_TERMS = [
  "machineLearning",
  "trainingData",
  "label",
  "classifier",
  "nearestNeighbour",
  "feature",
  "decisionBoundary",
  "mislabelledData",
  "bias",
  "spuriousCorrelation",
  "testSet",
  "falsePositive",
  "confidence",
  "computerVision",
  "pixel",
  "resolution",
  "kernel",
  "clustering",
  "outlier",
  "kMeans",
  "localOptimum",
  "regression",
  "leastSquares",
  "uncertainty",
  "extrapolation",
  "deepfake",
  "languageModel",
  "personalData",
  "targetedAd",
  "humanInTheLoop",
] as const;
export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number];

/** Which terms each concept tag brings, in the order they're listed. */
export const TERMS_BY_TAG: Readonly<Record<string, readonly GlossaryTerm[]>> = {
  classification: ["machineLearning", "trainingData", "label", "classifier", "nearestNeighbour"],
  boundary: ["decisionBoundary"],
  boundaries: ["decisionBoundary"],
  "data-quality": ["mislabelledData"],
  features: ["feature"],
  bias: ["bias"],
  "spurious-correlation": ["feature", "spuriousCorrelation"],
  "train-test-split": ["trainingData", "testSet"],
  evaluation: ["testSet"],
  "cost-sensitivity": ["falsePositive"],
  "computer-vision": ["computerVision"],
  pixels: ["pixel", "resolution", "kernel"],
  clustering: ["machineLearning", "clustering"],
  "model-selection": ["clustering"],
  outliers: ["outlier"],
  "data-cleaning": ["outlier"],
  data: ["outlier"],
  kmeans: ["kMeans"],
  "training-loop": ["kMeans"],
  "local-optima": ["localOptimum"],
  regression: ["regression", "leastSquares"],
  prediction: ["uncertainty", "extrapolation"],
  misinformation: ["deepfake", "languageModel"],
  privacy: ["personalData"],
  "cyber-safety": ["personalData"],
  "media-literacy": ["targetedAd", "personalData"],
  ml: ["machineLearning", "confidence", "humanInTheLoop"],
};

/** The terms for a level, from its tags: no duplicates, catalog order kept per tag. */
export function termsForTags(tags: readonly string[]): GlossaryTerm[] {
  const out: GlossaryTerm[] = [];
  for (const tag of tags) for (const term of TERMS_BY_TAG[tag] ?? []) if (!out.includes(term)) out.push(term);
  return out;
}
