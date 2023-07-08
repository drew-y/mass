import { List, ObjectType, Identifier } from "../../../lib/index.mjs";

export const typedStructListToStructType = (list: List): ObjectType => {
  return new ObjectType({
    ...list.context,
    value: list.value.slice(1).map((v) => {
      // v is always a labeled expression
      const labeledExpr = v as List;
      const name = labeledExpr.at(1) as Identifier;
      const typeId = labeledExpr.at(2) as Identifier;
      const type = list.getType(typeId);
      if (!type) {
        throw new Error(`Unrecognized type ${typeId.value}`);
      }
      return { name: name.value, type };
    }),
  });
};
