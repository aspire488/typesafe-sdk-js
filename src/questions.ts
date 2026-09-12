import { TypeSafeError } from "./errors";
import type {
  ChoiceCriteria,
  ChoiceQuestion,
  EntryType,
  NoulQuestion,
  Questions,
  ScoreCriteria,
  ScoreList,
  ScoreMap,
  ScoreQuestion,
} from "./types";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Create a yes/no question with optional descriptions for either outcome.
 *
 * @param instructions - The question as text, a JSON object or array; defaults to `null`.
 * @param criteria - Optional descriptions of the yes and no outcomes.
 */
export const noul = (
  instructions: EntryType = null,
  criteria?: NoulQuestion["criteria"],
): NoulQuestion => ({
  type: "noul",
  instructions,
  criteria,
});

/**
 * Create a score question using an ordered rubric.
 *
 * @param instructions - The question as text, a JSON object or array, or `null`.
 * @param criteria - A nonempty array or map indexed from zero with no gaps; descriptions may be `null`.
 */
export const score = <const T extends ScoreCriteria>(
  instructions: EntryType,
  criteria: T,
): ScoreQuestion<T> => ({
  type: "score",
  instructions,
  criteria,
});

/**
 * Create a question that selects between named alternatives.
 *
 * @param instructions - The question as text, a JSON object or array, or `null`.
 * @param criteria - Labels mapped to descriptions, or `null` for undescribed labels.
 */
export const choice = <const T extends ChoiceCriteria>(
  instructions: EntryType,
  criteria: T,
): ChoiceQuestion<T> => {
  if (Array.isArray(criteria)) {
    throw new TypeSafeError("Choice criteria must be a map of labels to descriptions, not a list.");
  }
  return { type: "choice", instructions, criteria };
};

// ---------------------------------------------------------------------------
// Wire normalization
// ---------------------------------------------------------------------------

const isScoreList = (criteria: ScoreCriteria): criteria is ScoreList => Array.isArray(criteria);

/** Validate score keys and convert the map to a nonempty array indexed from zero. */
export const scoreMapToList = (map: ScoreMap, name: string): ScoreList => {
  const keys = Object.keys(map)
    .map((key) => {
      const n = Number(key);
      if (!Number.isInteger(n) || n < 0) {
        throw new TypeSafeError(
          `Score question "${name}" has criteria key "${key}"; keys must be non-negative integers.`,
        );
      }
      return n;
    })
    .sort((a, b) => a - b);
  if (keys.length === 0) throw noScores(name);

  const expected = keys.map((_, i) => i);
  if (keys.some((k, i) => k !== expected[i])) {
    throw new TypeSafeError(
      `Score question "${name}" defines scores ${keys.join(", ")}, but scores must run from 0 ` +
        `with no gaps (expected ${expected.join(", ")}).`,
    );
  }
  return keys.map((k) => map[k]) as unknown as ScoreList;
};

const noScores = (name: string): TypeSafeError =>
  new TypeSafeError(`Score question "${name}" has no criteria; at least one score is required.`);

/** Validate nonempty questions and score criteria, converting score maps to arrays. */
export const toWireQuestions = <Q extends Questions>(questions: Q): Q => {
  if (Object.keys(questions).length === 0) {
    throw new TypeSafeError("At least one question is required.");
  }
  let changed = false;
  const wire: Questions = Object.create(null);
  for (const [name, question] of Object.entries(questions)) {
    if (question.type !== "score") {
      wire[name] = question;
    } else if (isScoreList(question.criteria)) {
      if (question.criteria.length === 0) throw noScores(name);
      wire[name] = question;
    } else {
      wire[name] = { ...question, criteria: scoreMapToList(question.criteria, name) };
      changed = true;
    }
  }
  return changed ? (wire as Q) : questions;
};
