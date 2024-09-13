import type { Block } from "./block.js";
import type { Bool } from "./bool.js";
import type { Call } from "./call.js";
import type { Expr } from "./expr.js";
import type { Float } from "./float.js";
import type { Fn } from "./fn.js";
import type { Global } from "./global.js";
import type { Id, Identifier } from "./identifier.js";
import type { Int } from "./int.js";
import { type VoidModule } from "./module.js";
import { LexicalContext } from "./lib/lexical-context.js";
import type { List } from "./list.js";
import type { MacroLambda } from "./macro-lambda.js";
import type { MacroVariable } from "./macro-variable.js";
import type { Macro } from "./macros.js";
import type { Parameter } from "./parameter.js";
import type { StringLiteral } from "./string-literal.js";
import type { ObjectLiteral } from "./object-literal.js";
import type {
  FnType,
  PrimitiveType,
  ObjectType,
  Type,
  TypeAlias,
  DsArrayType,
} from "./types.js";
import type { Variable } from "./variable.js";
import type { Whitespace } from "./whitespace.js";
import { NamedEntity } from "./named-entity.js";
import { ScopedEntity } from "./scoped-entity.js";
import { Declaration } from "./declaration.js";
import { Use } from "./use.js";
import { Match } from "./match.js";

export type SyntaxMetadata = {
  location?: SourceLocation;
  parent?: Expr;
  attributes?: Map<string, unknown>;
};

export abstract class Syntax {
  /** For tagged unions */
  abstract readonly syntaxType: string;
  readonly syntaxId = getSyntaxId();
  private attributes: Map<string, unknown>;
  location?: SourceLocation;
  parent?: Expr;

  constructor(metadata: SyntaxMetadata) {
    const { location, parent } = metadata;
    this.location = location;
    this.parent = parent;
    this.attributes = metadata.attributes ?? new Map();
  }

  get parentFn(): Fn | undefined {
    return this.parent?.isFn() ? this.parent : this.parent?.parentFn;
  }

  get parentModule(): VoidModule | undefined {
    return this.parent?.isModule() ? this.parent : this.parent?.parentModule;
  }

  get metadata() {
    return {
      location: this.location,
      parent: this.parent,
      attributes: structuredClone(this.attributes),
    };
  }

  getAllEntities(): NamedEntity[] {
    if (!this.isScopedEntity()) return this.parent?.getAllEntities() ?? [];
    return this.lexicon.getAllEntities();
  }

  registerEntity(v: NamedEntity, alias?: string): void {
    if (!this.isScopedEntity()) return this.parent?.registerEntity(v, alias);
    this.lexicon.registerEntity(v, alias);
  }

  /** Will resolve a sibling module, or a direct ancestor */
  resolveModule(name: Id, level = 0): VoidModule | undefined {
    if (!this.isModule()) {
      return this.parentModule?.resolveModule(name, level);
    }

    if (this.name.is(name)) return this;

    // We check root module as its where we find src and std
    if (level < 2 || this.isRoot) {
      const sibling = this.resolveEntity(name);
      if (sibling?.isModule()) return sibling;
    }

    return this.parentModule?.resolveModule(name, level + 1);
  }

  /** Recursively searches for the entity up the parent tree */
  resolveEntity(name: Id): NamedEntity | undefined {
    if (!this.isScopedEntity()) return this.parent?.resolveEntity(name);

    if (this.isModule()) return this.lexicon.resolveEntity(name);

    // Crawl up blocks until we hit a module
    return this.lexicon.resolveEntity(name) ?? this.parent?.resolveEntity(name);
  }

  /** Recursively searches for the fn entity(s) up the parent tree */
  resolveFns(id: Id, start: Fn[] = []): Fn[] {
    if (!this.isScopedEntity()) {
      return this.parent?.resolveFns(id, start) ?? start;
    }

    start.push(...this.lexicon.resolveFns(id));
    if (this.parent) return this.parent.resolveFns(id, start);
    return start;
  }

  getCloneOpts(parent?: Expr): SyntaxMetadata {
    return {
      ...this.metadata,
      parent: parent ?? this.parent,
    };
  }

  /** Clone this object (Implementations should not carry over resolved type expression) */
  abstract clone(parent?: Expr): Expr;

  /** Should emit in compliance with core language spec */
  abstract toJSON(): unknown;

  setAttribute(key: string, value: unknown) {
    this.attributes.set(key, value);
  }

  getAttribute(key: string): unknown {
    return this.attributes.get(key);
  }

  hasAttribute(key: string): boolean {
    return this.attributes.has(key);
  }

  isScopedEntity(): this is ScopedEntity {
    return (this as unknown as ScopedEntity).lexicon instanceof LexicalContext;
  }

  isExpr(): this is Expr {
    return true;
  }

  isStringLiteral(): this is StringLiteral {
    return this.syntaxType === "string-literal";
  }

  isList(): this is List {
    return this.syntaxType === "list";
  }

  isMatch(): this is Match {
    return this.syntaxType === "match";
  }

  isFloat(): this is Float {
    return this.syntaxType === "float";
  }

  isInt(): this is Int {
    return this.syntaxType === "int";
  }

  isBool(): this is Bool {
    return this.syntaxType === "bool";
  }

  isWhitespace(): this is Whitespace {
    return this.syntaxType === "whitespace";
  }

  isObjectType(): this is ObjectType {
    return this.isType() && this.kindOfType === "object";
  }

  isDsArrayType(): this is DsArrayType {
    return this.isType() && this.kindOfType === "ds-array";
  }

  isPrimitiveType(): this is PrimitiveType {
    return this.isType() && this.kindOfType === "primitive";
  }

  isIdentifier(): this is Identifier {
    return this.syntaxType === "identifier";
  }

  isFnType(): this is FnType {
    return this.isType() && this.kindOfType === "fn";
  }

  isFn(): this is Fn {
    return this.syntaxType === "fn";
  }

  isVariable(): this is Variable {
    return this.syntaxType === "variable";
  }

  isGlobal(): this is Global {
    return this.syntaxType === "global";
  }

  isMacro(): this is Macro {
    return this.syntaxType === "macro";
  }

  isMacroVariable(): this is MacroVariable {
    return this.syntaxType === "macro-variable";
  }

  isMacroLambda(): this is MacroLambda {
    return this.syntaxType === "macro-lambda";
  }

  isModule(): this is VoidModule {
    return this.syntaxType === "module";
  }

  isCall(): this is Call {
    return this.syntaxType === "call";
  }

  isParameter(): this is Parameter {
    return this.syntaxType === "parameter";
  }

  isType(): this is Type {
    return this.syntaxType === "type";
  }

  isTypeAlias(): this is TypeAlias {
    return this.isType() && this.kindOfType === "type-alias";
  }

  isBlock(): this is Block {
    return this.syntaxType === "block";
  }

  isDeclaration(): this is Declaration {
    return this.syntaxType === "declaration";
  }

  isUse(): this is Use {
    return this.syntaxType === "use";
  }

  isObjectLiteral(): this is ObjectLiteral {
    return this.syntaxType === "object-literal";
  }
}

let currentSyntaxId = 0;
const getSyntaxId = () => {
  const current = currentSyntaxId;
  currentSyntaxId += 1;
  return current;
};

export class SourceLocation {
  /** The exact character index the syntax starts */
  startIndex: number;
  /** The exact character index the syntax ends */
  endIndex: number;
  /** The line the syntax is located in */
  line: number;
  /** The column within the line the syntax begins */
  column: number;
  /** The column index in the line where the syntax ends  */
  endColumn?: number;

  filePath: string;

  constructor(opts: {
    startIndex: number;
    endIndex: number;
    line: number;
    column: number;
    filePath: string;
  }) {
    this.startIndex = opts.startIndex;
    this.endIndex = opts.endIndex;
    this.line = opts.line;
    this.column = opts.column;
    this.filePath = opts.filePath;
  }

  toString() {
    return `${this.filePath}:${this.line}:${this.column + 1}${
      this.endColumn ? `-${this.endColumn + 1}` : ""
    }`;
  }
}
