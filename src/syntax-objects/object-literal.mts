import { Expr } from "./expr.mjs";
import { Syntax, SyntaxMetadata } from "./syntax.mjs";

export class ObjectLiteral extends Syntax {
  readonly syntaxType = "object-literal";
  fields: ObjectLiteralField[];

  constructor(opts: SyntaxMetadata & { fields: ObjectLiteralField[] }) {
    super(opts);
    this.fields = opts.fields;
  }

  clone(parent?: Expr): ObjectLiteral {
    return new ObjectLiteral({
      ...super.getCloneOpts(parent),
      fields: this.fields,
    });
  }

  toJSON(): object {
    return [
      "object",
      `ObjectLiteral-${this.syntaxId}`,
      this.fields.map((f) => [f.name, f.initializer.toJSON()]),
    ];
  }
}

export type ObjectLiteralField = { name: string; initializer: Expr };
