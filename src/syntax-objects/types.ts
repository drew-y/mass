import { Expr } from "./expr.js";
import { Parameter } from "./parameter.js";
import { NamedEntity, NamedEntityOpts } from "./named-entity.js";
import { Id, Identifier } from "./identifier.js";
import { getIdStr } from "./lib/get-id-str.js";
import { LexicalContext } from "./lib/lexical-context.js";
import { Implementation } from "./implementation.js";
import { ScopedEntity } from "./scoped-entity.js";

export type Type =
  | PrimitiveType
  | UnionType
  | IntersectionType
  | ObjectType
  | TupleType
  | DsArrayType
  | FnType
  | TypeAlias;

export type TypeJSON = ["type", [string, ...any[]]];

export abstract class BaseType extends NamedEntity {
  readonly syntaxType = "type";
  abstract readonly kindOfType: string;
  /** Size in bytes */
  abstract readonly size: number;

  abstract toJSON(): TypeJSON;
}

export class TypeAlias extends BaseType {
  readonly kindOfType = "type-alias";
  readonly size = 4;
  typeExpr: Expr;
  type?: Type;

  constructor(opts: NamedEntityOpts & { typeExpr: Expr }) {
    super(opts);
    this.typeExpr = opts.typeExpr;
  }

  toJSON(): TypeJSON {
    return ["type", ["type-alias", this.typeExpr]];
  }

  clone(parent?: Expr | undefined): TypeAlias {
    return new TypeAlias({
      ...super.getCloneOpts(parent),
      typeExpr: this.typeExpr,
    });
  }
}

export class PrimitiveType extends BaseType {
  readonly kindOfType = "primitive";

  constructor(opts: NamedEntityOpts) {
    super(opts);
  }

  get size() {
    if (this.name.value === "bool") return 4;
    if (this.name.value === "i32") return 4;
    if (this.name.value === "f32") return 4;
    if (this.name.value === "i64") return 8;
    if (this.name.value === "f64") return 8;
    return 0;
  }

  static from(name: Primitive) {
    return new PrimitiveType({ name });
  }

  clone(parent?: Expr): PrimitiveType {
    return new PrimitiveType({ ...super.getCloneOpts(parent) });
  }

  toJSON(): TypeJSON {
    return ["type", ["primitive", this.name]];
  }
}

export class UnionType extends BaseType {
  readonly kindOfType = "union";
  value: Type[];

  constructor(opts: NamedEntityOpts & { value: Type[] }) {
    super(opts);
    this.value = opts.value;
  }

  get size() {
    let max = 0;
    for (const type of this.value) {
      if (type.size > max) max = type.size;
    }
    return max;
  }

  clone(parent?: Expr): UnionType {
    return new UnionType({ ...super.getCloneOpts(parent), value: this.value });
  }

  toJSON(): TypeJSON {
    return ["type", ["union", ...this.value]];
  }
}

export class IntersectionType extends BaseType {
  readonly kindOfType = "intersection";
  value: Type[];

  constructor(opts: NamedEntityOpts & { value: Type[] }) {
    super(opts);
    this.value = opts.value;
  }

  get size() {
    let total = 0;
    for (const type of this.value) {
      total += type.size;
    }
    return total;
  }

  clone(parent?: Expr): IntersectionType {
    return new IntersectionType({
      ...super.getCloneOpts(parent),
      value: this.value,
    });
  }

  toJSON(): TypeJSON {
    return ["type", ["intersection", ...this.value]];
  }
}

export class TupleType extends BaseType {
  readonly kindOfType = "tuple";
  value: Type[];

  constructor(opts: NamedEntityOpts & { value: Type[] }) {
    super(opts);
    this.value = opts.value;
  }

  get size() {
    let total = 0;
    for (const type of this.value) {
      total += type.size;
    }
    return total;
  }

  clone(parent?: Expr): TupleType {
    return new TupleType({ ...super.getCloneOpts(parent), value: this.value });
  }

  toJSON(): TypeJSON {
    return ["type", ["tuple", ...this.value]];
  }
}

export type ObjectField = { name: string; typeExpr: Expr; type?: Type };

export class ObjectType extends BaseType implements ScopedEntity {
  readonly kindOfType = "object";
  lexicon: LexicalContext = new LexicalContext();
  typeParameters?: Identifier[];
  appliedTypeArgs?: Type[];
  genericInstances?: ObjectType[];
  fields: ObjectField[];
  parentObjExpr?: Expr;
  parentObjType?: ObjectType;
  /** Type used for locals, globals, function return type */
  binaryenType?: number;
  typesResolved?: boolean; // Don't set if type parameters are present
  implementations: Implementation[];
  #iteration = 0;

  constructor(
    opts: NamedEntityOpts & {
      value: ObjectField[];
      parentObjExpr?: Expr;
      parentObj?: ObjectType;
      typeParameters?: Identifier[];
      implementations?: Implementation[];
    }
  ) {
    super(opts);
    this.fields = opts.value;
    this.fields.forEach((field) => {
      field.typeExpr.parent = this;
    });
    this.parentObjType = opts.parentObj;
    this.parentObjExpr = opts.parentObjExpr;
    this.typeParameters = opts.typeParameters;
    this.implementations = opts.implementations ?? [];
  }

  get size() {
    return 4;
  }

  toJSON(): TypeJSON {
    return [
      "type",
      [
        "object",
        this.id,
        ...this.fields.map(({ name, typeExpr }) => [name, typeExpr]),
      ],
    ];
  }

  clone(parent?: Expr): ObjectType {
    return new ObjectType({
      ...super.getCloneOpts(parent),
      id: `${this.id}#${this.#iteration++}`,
      value: this.fields.map((field) => ({
        ...field,
        typeExpr: field.typeExpr.clone(),
        type: field.type?.clone(),
      })),
      parentObjExpr: this.parentObjExpr?.clone(),
      typeParameters: this.typeParameters,
      implementations: this.implementations.map((impl) => impl.clone()),
    });
  }

  extends(ancestor: ObjectType): boolean {
    if (this === ancestor) {
      return true;
    }

    if (this.parentObjType) {
      return this.parentObjType.extends(ancestor);
    }

    return false;
  }

  // Register a version of this function with resolved generics
  registerGenericInstance(obj: ObjectType) {
    if (!this.genericInstances) {
      this.genericInstances = [];
    }

    this.genericInstances.push(obj);
  }

  getAncestorIds(start: number[] = []): number[] {
    start.push(this.idNum);
    if (this.parentObjType) {
      return this.parentObjType.getAncestorIds(start);
    }
    return start;
  }

  hasField(name: Id) {
    return this.fields.some((field) => field.name === getIdStr(name));
  }

  getField(name: Id) {
    return this.fields.find((field) => field.name === getIdStr(name));
  }

  getFieldIndex(name: Id) {
    return this.fields.findIndex((field) => field.name === getIdStr(name));
  }
}

/** Dynamically Sized Array (The raw gc array type) */
export class DsArrayType extends BaseType {
  readonly kindOfType = "ds-array";
  readonly size = Infinity;
  elemTypeExpr: Expr;
  elemType?: Type;
  /** Type used for locals, globals, function return type */
  binaryenType?: number;

  constructor(opts: NamedEntityOpts & { elemTypeExpr: Expr; elemType?: Type }) {
    super(opts);
    this.elemTypeExpr = opts.elemTypeExpr;
    this.elemTypeExpr.parent = this;
    this.elemType = opts.elemType;
  }

  clone(parent?: Expr): DsArrayType {
    return new DsArrayType({
      ...super.getCloneOpts(parent),
      elemTypeExpr: this.elemTypeExpr.clone(),
    });
  }

  toJSON(): TypeJSON {
    return ["type", ["DsArray", this.elemType]];
  }
}

export class FnType extends BaseType {
  readonly kindOfType = "fn";
  readonly size = 0;
  readonly parameters: Parameter[];
  readonly returnType: Type;

  constructor(
    opts: NamedEntityOpts & {
      parameters: Parameter[];
      returnType: Type;
    }
  ) {
    super(opts);
    this.parameters = opts.parameters;
    this.returnType = opts.returnType;
  }

  clone(parent?: Expr): FnType {
    return new FnType({
      ...super.getCloneOpts(parent),
      returnType: this.returnType,
      parameters: this.parameters,
    });
  }

  toJSON(): TypeJSON {
    return [
      "type",
      [
        "fn",
        this.id,
        ["parameters", this.parameters],
        ["return-type", this.returnType],
      ],
    ];
  }
}

export type StackType = NumericType | ReferenceType;
export type Primitive = NumericType | ReferenceType | "void" | "bool";
export type NumericType = "i32" | "f32" | "i64" | "f64";
export type ReferenceType = "funcref" | "externref";

export const i32 = PrimitiveType.from("i32");
export const f32 = PrimitiveType.from("f32");
export const i64 = PrimitiveType.from("i64");
export const f64 = PrimitiveType.from("f64");
export const bool = PrimitiveType.from("bool");
export const dVoid = PrimitiveType.from("void");
export const voidBaseObject = new ObjectType({
  name: "Object",
  value: [],
});
export const CDT_ADDRESS_TYPE = i32;
