import type { Bool } from "./bool.mjs";
import type { Float } from "./float.mjs";
import type { Fn } from "./fn.mjs";
import type { Identifier } from "./identifier.mjs";
import type { Int } from "./int.mjs";
import type { List } from "./list.mjs";
import { Parameter } from "./parameter.mjs";
import type { StringLiteral } from "./string-literal.mjs";
import type { Type } from "./types.mjs";
import { Variable } from "./variable.mjs";
import type { Whitespace } from "./whitespace.mjs";
import type { Global } from "./global.mjs";
import { MacroVariable } from "./macro-variable.mjs";
import { Macro } from "./macros.mjs";
import { MacroLambda } from "./macro-lambda.mjs";
import { Call } from "./call.mjs";
import { Block } from "./block.mjs";
import { VoidModule } from "./module.mjs";

export type Expr =
  | PrimitiveExpr
  | Type
  | Fn
  | Macro
  | Variable
  | Parameter
  | Global
  | MacroVariable
  | MacroLambda
  | VoidModule
  | Call
  | Block;

/**
 * These are the Expr types that must be returned until all macros have been expanded (reader, syntax, and regular)
 */
export type PrimitiveExpr =
  | Bool
  | Int
  | Float
  | StringLiteral
  | Identifier
  | Whitespace
  | List;
