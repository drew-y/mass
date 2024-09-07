import { Block } from "../../syntax-objects/block.js";
import { Expr } from "../../syntax-objects/expr.js";
import { noop } from "../../syntax-objects/helpers.js";
import { List } from "../../syntax-objects/list.js";
import { VoidModule } from "../../syntax-objects/module.js";
import { ObjectLiteral } from "../../syntax-objects/object-literal.js";
import {
  DSArrayType,
  ObjectType,
  TypeAlias,
  voidBaseObject,
} from "../../syntax-objects/types.js";
import { Variable } from "../../syntax-objects/variable.js";
import { getExprType } from "./get-expr-type.js";
import { resolveCallTypes } from "./resolve-call-types.js";
import { resolveFnTypes } from "./resolve-fn-type.js";
import { resolveMatch } from "./resolve-match.js";
import { resolveUse } from "./resolve-use.js";

/**
 * NOTE: Some mapping is preformed on the AST at this stage.
 * Returned tree not guaranteed to be same as supplied tree
 */
export const resolveTypes = (expr: Expr | undefined): Expr => {
  if (!expr) return noop();
  if (expr.isBlock()) return resolveBlockTypes(expr);
  if (expr.isCall()) return resolveCallTypes(expr);
  if (expr.isFn()) return resolveFnTypes(expr);
  if (expr.isVariable()) return resolveVarTypes(expr);
  if (expr.isModule()) return resolveModuleTypes(expr);
  if (expr.isList()) return resolveListTypes(expr);
  if (expr.isUse()) return resolveUse(expr);
  if (expr.isObjectType()) return resolveObjectTypeTypes(expr);
  if (expr.isDSArrayType()) return resolveDSArrayTypeTypes(expr);
  if (expr.isTypeAlias()) return resolveTypeAliasTypes(expr);
  if (expr.isObjectLiteral()) return resolveObjectLiteralTypes(expr);
  if (expr.isMatch()) return resolveMatch(expr);
  return expr;
};

const resolveBlockTypes = (block: Block): Block => {
  block.applyMap(resolveTypes);
  block.type = getExprType(block.body.at(-1));
  return block;
};

const resolveVarTypes = (variable: Variable): Variable => {
  const initializer = resolveTypes(variable.initializer);
  variable.initializer = initializer;
  variable.inferredType = getExprType(initializer);

  if (variable.typeExpr) {
    variable.annotatedType = getExprType(variable.typeExpr);
  }

  variable.type = variable.annotatedType ?? variable.inferredType;
  return variable;
};

export const resolveModuleTypes = (mod: VoidModule): VoidModule => {
  mod.phase = 3;
  mod.each(resolveTypes);
  mod.phase = 4;
  return mod;
};

const resolveListTypes = (list: List) => {
  console.log("Unexpected list");
  console.log(JSON.stringify(list, undefined, 2));
  return list.map(resolveTypes);
};

const resolveDSArrayTypeTypes = (arr: DSArrayType): DSArrayType => {
  arr.elemTypeExpr = resolveTypes(arr.elemTypeExpr);
  arr.elemType = getExprType(arr.elemTypeExpr);
  arr.id = `${arr.id}#${arr.elemType?.id}`;
  return arr;
};

const resolveObjectTypeTypes = (obj: ObjectType): ObjectType => {
  obj.fields.forEach((field) => {
    field.typeExpr = resolveTypes(field.typeExpr);
    field.type = getExprType(field.typeExpr);
  });

  if (obj.parentObjExpr) {
    const parentType = getExprType(obj.parentObjExpr);
    obj.parentObj = parentType?.isObjectType() ? parentType : undefined;
  } else {
    obj.parentObj = voidBaseObject;
  }

  return obj;
};

const resolveTypeAliasTypes = (alias: TypeAlias): TypeAlias => {
  alias.typeExpr = resolveTypes(alias.typeExpr);
  alias.type = getExprType(alias.typeExpr);
  return alias;
};

const resolveObjectLiteralTypes = (obj: ObjectLiteral) => {
  obj.fields.forEach((field) => {
    field.initializer = resolveTypes(field.initializer);
    field.type = getExprType(field.initializer);
  });

  if (!obj.type) {
    obj.type = new ObjectType({
      ...obj.metadata,
      name: `ObjectLiteral-${obj.syntaxId}`,
      value: obj.fields.map((f) => ({
        name: f.name,
        typeExpr: f.initializer,
        type: f.type,
      })),
    });
  }

  return obj;
};
