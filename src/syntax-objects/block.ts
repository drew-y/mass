import { Expr } from "./expr.js";
import { Child } from "./lib/child.js";
import { List } from "./list.js";
import { ScopedSyntax, ScopedSyntaxMetadata } from "./scoped-entity.js";
import { Type } from "./types.js";

export class Block extends ScopedSyntax {
  readonly syntaxType = "block";
  #body: Child<List>;
  type?: Type;

  constructor(
    opts: ScopedSyntaxMetadata & {
      body: List | Expr[];
      type?: Type;
    }
  ) {
    super(opts);
    const { body, type } = opts;
    this.#body = new Child(body instanceof Array ? new List(body) : body, this);
    this.type = type;
  }

  get children() {
    return this.body.toArray();
  }

  get body() {
    return this.#body.value;
  }

  set body(body: List) {
    this.#body.value = body;
  }

  lastExpr() {
    return this.body.last();
  }

  each(fn: (expr: Expr, index: number, array: Expr[]) => Expr) {
    this.body.each(fn);
    return this;
  }

  /** Sets the parent on each element immediately before the mapping of the next */
  applyMap(fn: (expr: Expr, index: number, array: Expr[]) => Expr) {
    const body = this.body;
    this.body = new List({ ...this.body.metadata, value: [] });
    body.each((expr, index, array) => this.body.push(fn(expr, index, array)));
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
    });
  }
}
