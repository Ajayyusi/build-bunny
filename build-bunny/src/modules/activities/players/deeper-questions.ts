/**
 * Grades 5 to 7: the deeper questions asked after a pass outside the Teach
 * levels (shared/DeeperQuestion.tsx). Option ids, and which one the reply
 * agrees with. Copy: student.play.aiMode.deeper.<id>.
 */
export const DEEPER = {
  trend: { options: ["wider", "narrower", "same"], best: "wider" },
  pixel: { options: ["n64", "n192", "n8"], best: "n192" },
  boundary: { options: ["notSure", "tart", "random"], best: "notSure" },
  group: { options: ["up", "down", "same"], best: "up" },
  whoDecides: { options: ["two", "none", "eight"], best: "two" },
  isThatReal: { options: ["source", "looks", "sure"], best: "source" },
} as const;
export type DeeperId = keyof typeof DEEPER;
