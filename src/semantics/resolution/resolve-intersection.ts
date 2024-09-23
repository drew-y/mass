import { IntersectionType } from "../../syntax-objects/types.js";
import { getExprType } from "./get-expr-type.js";
import { resolveTypes } from "./resolve-types.js";

export const resolveIntersectionType = (
  inter: IntersectionType
): IntersectionType => {
  inter.nominalTypeExpr.value = resolveTypes(inter.nominalTypeExpr.value);
  inter.structuralTypeExpr.value = resolveTypes(inter.structuralTypeExpr.value);

  const nominalType = getExprType(inter.nominalTypeExpr.value);
  const structuralType = getExprType(inter.structuralTypeExpr.value);

  // TODO Error if not correct type
  inter.nominalType = nominalType?.isObjectType() ? nominalType : undefined;
  inter.structuralType = structuralType?.isObjectType()
    ? structuralType
    : undefined;

  return inter;
};
