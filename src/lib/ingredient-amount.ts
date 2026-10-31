/**
 * Splits an ingredient line into its leading amount and the rest, so the
 * amount can be set in bold: "**12 oz** spaghetti". Lines scan by amount when
 * you're shopping or cooking, and recipe apps set them apart for that reason.
 *
 * Deliberately conservative. Ingredient lines are free text from extraction,
 * so anything that doesn't open with a number — "Fresh basil", "Pinch of
 * salt" — comes back whole rather than half-bolded. A unit is only taken when
 * it's one of the familiar kitchen ones; otherwise just the number is.
 */

const NUMBER = String.raw`(?:\d+(?:[.,]\d+)?(?:\/\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞])`;
// "1 1/2", "1½" — a whole number followed by a fraction.
const MIXED = String.raw`${NUMBER}(?:\s+\d+\/\d+|\s*[½⅓⅔¼¾⅛⅜⅝⅞])?`;
// "2-3", "2 to 3".
const RANGE = String.raw`${MIXED}(?:\s*(?:-|–|to)\s*${MIXED})?`;
const UNIT = [
  "cups?", "c", "tablespoons?", "tbsps?", "tbs", "teaspoons?", "tsps?",
  "ounces?", "oz", "pounds?", "lbs?", "grams?", "g", "kilograms?", "kg",
  "millilit(?:er|re)s?", "ml", "lit(?:er|re)s?", "l", "quarts?", "qt",
  "pints?", "pt", "cloves?", "cans?", "jars?", "slices?", "sticks?",
  "bunch(?:es)?", "handfuls?", "sprigs?", "pieces?", "packages?", "pkgs?",
  "pinch(?:es)?", "dash(?:es)?", "heads?", "stalks?", "fillets?",
].join("|");

const AMOUNT = new RegExp(
  String.raw`^(${RANGE}(?:\s*(?:${UNIT})\.?(?=\s|$))?)\s+(\S.*)$`,
  "i"
);

export interface IngredientParts {
  amount?: string;
  rest: string;
}

export function splitIngredientAmount(line: string): IngredientParts {
  const text = line.trim();
  const match = AMOUNT.exec(text);
  if (!match) return { rest: text };
  return { amount: match[1], rest: match[2] };
}
