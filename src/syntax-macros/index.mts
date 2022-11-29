import { fn } from "./fn.mjs";
import { functionalNotation } from "./functional-notation.mjs";
import { processGreedyOps } from "./greedy-ops.mjs";
import { infix } from "./infix.mjs";
import { macro } from "./macro.mjs";
import { moduleSyntaxMacro } from "./module.mjs";
import { parentheticalElision } from "./parenthetical-elision.mjs";
import { SyntaxMacro } from "./types.mjs";

/** Caution: Order matters */
export const syntaxMacros: SyntaxMacro[] = [
  functionalNotation,
  (ast) => parentheticalElision(ast),
  processGreedyOps,
  // infix,
  // moduleSyntaxMacro,
  // macro,
  // fn,
];
