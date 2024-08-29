import { Expr } from "./expr.js";
import { List } from "./list.js";
import { ScopedSyntax, ScopedSyntaxMetadata } from "./scoped-entity.js";
import { Type } from "./types.js";

export class Block extends ScopedSyntax {
  readonly syntaxType = "block";
  private _body!: List;
  type?: Type;

  constructor(
    opts: ScopedSyntaxMetadata & {
      body: List;
      type?: Type;
    }
  ) {
    super(opts);
    this.body = opts.body;
    this.type = opts.type;
  }

  get body() {
    return this._body;
  }

  set body(body: List) {
    if (body) {
      body.parent = this;
    }

    this._body = body;
  }

  lastExpr() {
    return this.body.last();
  }

  each(fn: (expr: Expr, index: number, array: Expr[]) => Expr) {
    this.body.each(fn);
    return this;
  }

  applyMap(fn: (expr: Expr, index: number, array: Expr[]) => Expr) {
    this.body = this.body.map(fn);
    return this;
  }

  /**  Calls the evaluator function on the block's body and returns the result of the last evaluation. */
  evaluate(evaluator: (expr: Expr) => Expr): Expr | undefined {
    return this.body.map(evaluator).last();
  }

  toJSON() {
    return ["block", ...this.body.toJSON()];
  }

  clone(parent?: Expr) {
    return new Block({
      ...this.getCloneOpts(parent),
      body: this.body.clone(),
      type: this.type,
    });
  }
}
