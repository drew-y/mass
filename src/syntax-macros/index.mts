import { functionalNotation } from "./functional-notation.mjs";
import { infix } from "./infix.mjs";
import { parentheticalElision } from "./parenthetical-elision.mjs";
import { SyntaxMacro } from "./types.mjs";

export const syntaxMacros: SyntaxMacro[] = [
  functionalNotation,
  parentheticalElision,
  infix,
];
