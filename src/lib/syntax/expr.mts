import type { Bool } from "./bool.mjs";
import type { Float } from "./float.mjs";
import type { Identifier } from "./identifier.mjs";
import type { Int } from "./int.mjs";
import type { List } from "./list.mjs";
import type { StringLiteral } from "./string-literal.mjs";
import type { Type } from "./types.mjs";
import type { Whitespace } from "./whitespace.mjs";

export type Expr =
  | Bool
  | Int
  | Float
  | StringLiteral
  | Identifier
  | Whitespace
  | List
  | Type;
