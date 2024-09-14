import { Implementation } from "../../syntax-objects/implementation.js";
import { ObjectType } from "../../syntax-objects/types.js";
import { resolveObjectTypeTypes } from "./resolve-object-type.js";
import { resolveTypes } from "./resolve-types.js";

export const resolveImpl = (
  impl: Implementation,
  targetType?: ObjectType
): Implementation => {
  if (impl.typesResolved) return impl;
  targetType = targetType ?? resolveTargetType(impl);
  impl.targetType = targetType;

  if (!targetType) return impl;

  if (!impl.traitExpr && targetType?.isObjectType()) {
    targetType.implementations?.push(impl);
  }

  if (targetType?.isObjectType() && targetType.typeParameters?.length) {
    return impl;
  }

  impl.body.value = resolveTypes(impl.body.value);
  impl.body.value.getAllEntities().forEach((e) => {
    if (e.isFn()) impl.methods.push(e);
  });

  impl.typesResolved = true;
  return impl;
};

const resolveTargetType = (impl: Implementation): ObjectType | undefined => {
  const expr = impl.targetTypeExpr.value;
  const type = expr.isIdentifier()
    ? expr.resolve()
    : expr.isCall()
    ? expr.fnName.resolve()
    : undefined;

  if (!type || !type.isObjectType()) return;

  if (type.typeParameters?.length && expr.isCall()) {
    const obj = resolveObjectTypeTypes(type, expr);
    // Object fully resolved to non-generic version i.e. `Vec<i32>`
    if (!obj.typeParameters?.length) return obj;
  }

  // Generic impl with generic target type i.e. `impl<T> for Vec<T>`
  if (!implIsCompatible(impl, type)) return undefined;

  return type;
};

export const implIsCompatible = (
  impl: Implementation,
  obj: ObjectType
): boolean => {
  if (!impl.typeParams.length && !obj.typeParameters?.length) return true;

  // For now, only handles generic impls with no constraints that match the type arg length of the target type.
  if (impl.typeParams.length === obj.typeParameters?.length) return true; // impl<T> for Vec<T>
  if (impl.typeParams.length === obj.appliedTypeArgs?.length) return true; // impl<T> for Vec<i32>

  return false;
};
