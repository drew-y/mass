import { Call } from "./call.mjs";
import { Expr } from "./expr.mjs";
import { NamedEntity } from "./named-entity.mjs";
import { Syntax, SyntaxMetadata } from "./syntax.mjs";

/** Defines a declared namespace for external function imports */
export class Use extends Syntax {
  readonly syntaxType = "use";
  entities: NamedEntity[];
  path: Call;

  constructor(
    opts: SyntaxMetadata & {
      entities: NamedEntity[];
      path: Call;
    }
  ) {
    super(opts);
    this.entities = opts.entities;
    this.path = opts.path;
  }

  toJSON() {
    return ["use", this.entities.map((e) => e.name)];
  }

  clone(parent?: Expr) {
    return new Use({
      ...this.getCloneOpts(parent),
      entities: this.entities,
      path: this.path,
    });
  }
}
