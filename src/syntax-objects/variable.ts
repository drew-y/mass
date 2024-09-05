import { Expr } from "./expr.js";
import { NamedEntity, NamedEntityOpts } from "./named-entity.js";
import { Type } from "./types.js";

export class Variable extends NamedEntity {
  readonly syntaxType = "variable";
  isMutable: boolean;
  type?: Type;
  /** Set before the type was narrowed by the type checker */
  originalType?: Type;
  inferredType?: Type;
  annotatedType?: Type;
  typeExpr?: Expr;
  initializer: Expr;
  requiresCast = false;

  constructor(
    opts: NamedEntityOpts & {
      isMutable: boolean;
      initializer: Expr;
      type?: Type;
      typeExpr?: Expr;
    }
  ) {
    super(opts);
    this.isMutable = opts.isMutable;
    this.type = opts.type;
    this.typeExpr = opts.typeExpr;
    this.initializer = opts.initializer;
  }

  getIndex(): number {
    const index = this.parentFn?.getIndexOfVariable(this) ?? -1;

    if (index < 0) {
      throw new Error(`Variable ${this} is not registered with a function`);
    }

    return index;
  }

  toString() {
    return this.name.toString();
  }

  toJSON() {
    return [
      "define-variable",
      this.name,
      this.type,
      ["is-mutable", this.isMutable],
      this.initializer,
    ];
  }

  clone(parent?: Expr | undefined): Variable {
    return new Variable({
      ...super.getCloneOpts(parent),
      isMutable: this.isMutable,
      initializer: this.initializer,
      type: this.type,
    });
  }
}
