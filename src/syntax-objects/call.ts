import { Expr } from "./expr.js";
import { Fn } from "./fn.js";
import { Identifier } from "./identifier.js";
import { LexicalContext } from "./lexical-context.js";
import { List } from "./list.js";
import { Syntax, SyntaxMetadata } from "./syntax.js";
import { ObjectType, Type } from "./types.js";

/** Defines a function call */
export class Call extends Syntax {
  readonly syntaxType = "call";
  fn?: Fn | ObjectType;
  fnName: Identifier;
  args: List;
  typeArgs?: List;
  _type?: Type;

  constructor(
    opts: SyntaxMetadata & {
      fnName: Identifier;
      fn?: Fn;
      args: List;
      type?: Type;
      lexicon?: LexicalContext;
      typeArgs?: List;
    }
  ) {
    super(opts);
    this.fnName = opts.fnName;
    this.fn = opts.fn;
    this.args = opts.args;
    this.args.parent = this;
    this.typeArgs = opts.typeArgs;
    if (this.typeArgs) this.typeArgs.parent = this;
    this._type = opts.type;
  }

  get children() {
    return [...this.args.toArray(), ...(this.typeArgs?.toArray() ?? [])];
  }

  set type(type: Type | undefined) {
    this._type = type;
  }

  get type() {
    if (!this._type && this.fn?.isFn()) {
      this._type = this.fn.returnType;
    }

    if (!this._type && this.fn?.isObjectType()) {
      this._type = this.fn;
    }

    return this._type;
  }

  eachArg(fn: (expr: Expr) => void) {
    this.args.each(fn);
    return this;
  }

  argAt(index: number) {
    return this.args.at(index);
  }

  exprArgAt(index: number): Expr {
    const expr = this.argAt(index);

    if (!expr) {
      throw new Error(`No expression found at ${index}`);
    }

    return expr;
  }

  // Returns the value of the labeled argument at the given index
  labeledArgAt(index: number): Expr {
    const label = this.args.at(index);

    if (!label?.isCall() || !label?.calls(":")) {
      throw new Error(`No label found at ${index}`);
    }

    return label.exprArgAt(1);
  }

  // Returns the value of the labeled argument at the given index
  optionalLabeledArgAt(index: number): Expr | undefined {
    try {
      return this.labeledArgAt(index);
    } catch (_e) {
      return undefined;
    }
  }

  callArgAt(index: number): Call {
    const call = this.args.at(index);
    if (!call?.isCall()) {
      throw new Error(`No call at ${index}`);
    }
    return call;
  }

  identifierArgAt(index: number): Identifier {
    const call = this.args.at(index);
    if (!call?.isIdentifier()) {
      throw new Error(`No identifier at ${index}`);
    }
    return call;
  }

  argArrayMap<T>(fn: (expr: Expr) => T): T[] {
    return this.args.toArray().map(fn);
  }

  calls(name: string) {
    return this.fnName.is(name);
  }

  toJSON() {
    return [this.fnName, ...this.args.toArray()];
  }

  clone(parent?: Expr) {
    return new Call({
      ...this.getCloneOpts(parent),
      fnName: this.fnName.clone(),
      args: this.args.clone(),
      typeArgs: this.typeArgs?.clone(),
    });
  }
}
