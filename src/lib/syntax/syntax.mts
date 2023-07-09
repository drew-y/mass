import { Bool } from "./bool.mjs";
import { Call } from "./call.mjs";
import type { Expr } from "./expr.mjs";
import { ExternFn } from "./extern-fn.mjs";
import { Float } from "./float.mjs";
import { Fn } from "./fn.mjs";
import { Global } from "./global.mjs";
import { Id, Identifier } from "./identifier.mjs";
import { Int } from "./int.mjs";
import {
  Entity,
  FnEntity,
  LexicalContext,
  MacroEntity,
} from "./lexical-context.mjs";
import { List } from "./list.mjs";
import { MacroVariable } from "./macro-variable.mjs";
import { Macro } from "./macros.mjs";
import { Parameter } from "./parameter.mjs";
import { StringLiteral } from "./string-literal.mjs";
import { FnType, PrimitiveType, ObjectType, Type } from "./types.mjs";
import { Variable } from "./variable.mjs";
import { Whitespace } from "./whitespace.mjs";

export type SourceLocation = {
  /** The exact character index the syntax starts */
  startIndex: number;
  /** The exact character index the syntax ends */
  endIndex: number;
  /** The line the syntax is located in */
  line: number;
  /** The column within the line the syntax begins */
  column: number;

  filePath: string;
};

export type SyntaxOpts = {
  location?: SourceLocation;
  parent?: Expr;
  lexicon?: LexicalContext;
};

export abstract class Syntax {
  readonly syntaxId = getSyntaxId();
  readonly location?: SourceLocation;
  readonly lexicon: LexicalContext;
  parent?: Expr;
  /** For tagged unions */
  abstract readonly syntaxType: string;

  constructor({ location, parent, lexicon }: SyntaxOpts) {
    this.location = location;
    this.parent = parent;
    this.lexicon = lexicon ?? new LexicalContext();
  }

  get parentFn(): Fn | undefined {
    return this.parent?.syntaxType === "fn"
      ? this.parent
      : this.parent?.parentFn;
  }

  get context() {
    return {
      location: this.location,
      parent: this.parent,
      lexicon: this.lexicon,
    };
  }

  registerEntity(v: Entity) {
    this.lexicon.registerEntity(v);
    if (v.syntaxType === "parameter" || v.syntaxType === "variable") {
      this.registerLocalWithParentFn(v);
    }
  }

  resolveEntity(name: Id): Entity | undefined {
    return this.lexicon.resolveEntity(name) ?? this.parent?.resolveEntity(name);
  }

  resolveMacroEntity(name: Id): MacroEntity | undefined {
    return (
      this.lexicon.resolveMacroEntity(name) ??
      this.parent?.resolveMacroEntity(name)
    );
  }

  resolveFns(id: Id, start: FnEntity[] = []): FnEntity[] {
    start.push(...this.lexicon.resolveFns(id));
    if (this.parent) return this.parent.resolveFns(id, start);
    return start;
  }

  resolveFnById(id: string): FnEntity | undefined {
    return this.lexicon.resolveFnById(id) ?? this.parent?.resolveFnById(id);
  }

  getCloneOpts(parent?: Expr): SyntaxOpts {
    return {
      ...this.context,
      parent: parent ?? this.parent,
    };
  }

  abstract clone(parent?: Expr): Expr;

  /** Should emit in compliance with core language spec */
  abstract toJSON(): any;

  private registerLocalWithParentFn(v: Variable | Parameter): void {
    if (!this.parent) {
      throw new Error(`Not in fn, cannot register ${v}`);
    }

    if (this.parent.syntaxType === "fn") {
      this.parent?.registerLocal(v);
      return;
    }

    return this.parent.registerLocalWithParentFn(v);
  }

  isStringLiteral(): this is StringLiteral {
    return this instanceof StringLiteral;
  }

  isList(): this is List {
    return this instanceof List;
  }

  isFloat(): this is Float {
    return this instanceof Float;
  }

  isInt(): this is Int {
    return this instanceof Int;
  }

  isBool(): this is Bool {
    return this instanceof Bool;
  }

  isWhitespace(): this is Whitespace {
    return this instanceof Whitespace;
  }

  isObjectType(): this is ObjectType {
    return this instanceof ObjectType;
  }

  isPrimitiveType(): this is PrimitiveType {
    return this instanceof PrimitiveType;
  }

  isIdentifier(): this is Identifier {
    return this instanceof Identifier;
  }

  isFnType(): this is FnType {
    return this instanceof FnType;
  }

  isFn(): this is Fn {
    return this instanceof Fn;
  }

  isExternFn(): this is ExternFn {
    return this instanceof ExternFn;
  }

  isVariable(): this is Variable {
    return this instanceof Variable;
  }

  isGlobal(): this is Global {
    return this instanceof Global;
  }

  isMacro(): this is Macro {
    return this.syntaxType === "macro";
  }

  isMacroVariable(): this is MacroVariable {
    return this instanceof MacroVariable;
  }

  isCall(): this is Call {
    return this instanceof Call;
  }

  isParameter(): this is Parameter {
    return this instanceof Parameter;
  }

  isType(): this is Type {
    return this.syntaxType === "type";
  }
}

let currentSyntaxId = 0;
const getSyntaxId = () => {
  const current = currentSyntaxId;
  currentSyntaxId += 1;
  return current;
};
