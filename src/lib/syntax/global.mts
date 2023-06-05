import { Expr } from "./expr.mjs";
import { Identifier } from "./identifier.mjs";
import { Syntax, SyntaxOpts } from "./syntax.mjs";
import { Type } from "./types.mjs";

export class Global extends Syntax {
  /** Absolute unique id */
  readonly id: string;
  readonly identifier: Identifier;
  readonly isMutable: boolean;
  protected type?: Type;
  readonly syntaxType = "global";
  readonly initializer?: Expr;

  constructor(
    opts: SyntaxOpts & {
      identifier: Identifier;
      isMutable: boolean;
      initializer?: Expr;
      type?: Type;
      id?: string;
    }
  ) {
    super(opts);
    this.identifier = opts.identifier;
    this.isMutable = opts.isMutable;
    this.type = opts.type;
    this.initializer = opts.initializer;
    this.id = opts.id ?? this.generateId();
  }

  private generateId() {
    return `${this.location?.filePath ?? "unknown"}/${this.identifier.value}#${
      this.syntaxId
    }`;
  }

  getType(): Type {
    if (this.type) return this.type;
    throw new Error(`Type not yet resolved for global ${this.identifier}`);
  }

  setType(type: Type) {
    this.type = type;
  }

  toString() {
    return this.identifier.toString();
  }

  toJSON() {
    return [
      "define-global",
      this.identifier,
      this.type,
      ["is-mutable", this.isMutable],
      this.initializer,
    ];
  }

  clone(parent?: Expr | undefined): Global {
    return new Global({
      inherit: this,
      parent: parent ?? this.parent,
      identifier: this.identifier,
      isMutable: this.isMutable,
      initializer: this.initializer,
      type: this.type,
      id: this.id,
    });
  }
}
