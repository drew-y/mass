import { idIs, isOp } from "../grammar.js";
import { Expr, List, ListValue } from "../../syntax-objects/index.js";

// Note: The current version of this function was modified by GPT o1.
// I wrote the original version an have made modifications to the version
// produced by o1. The intent was to have o1 improve the performance. But
// now I'm not sure the added complexity produced by o1 was worth the cost.
// Might still be worth re-writing again to something similar to the original.

export const functionalNotation = (list: List): List => {
  const array = list.toArray();
  let isTuple = false;

  const { result } = array.reduce(
    (acc, expr, index) => {
      if (acc.skip > 0) {
        acc.skip--;
        return acc;
      }

      if (expr.isList()) {
        acc.result.push(functionalNotation(expr));
        return acc;
      }

      if (expr.isWhitespace()) {
        acc.result.push(expr);
        return acc;
      }

      const nextExpr = array[index + 1];

      if (nextExpr && nextExpr.isList() && !(isOp(expr) || idIs(expr, ","))) {
        return handleNextExpression(acc, expr, nextExpr, array, index);
      }

      if (list.getAttribute("tuple?") && idIs(expr, ",")) {
        isTuple = true;
      }

      acc.result.push(expr);
      return acc;
    },
    { result: [], skip: 0 } as Accumulator
  );

  return finalizeResult(result, isTuple, list);
};

type Accumulator = { result: ListValue[]; skip: number };

const handleNextExpression = (
  acc: Accumulator,
  expr: Expr,
  nextExpr: List,
  array: Expr[],
  index: number
) => {
  if (nextExpr.calls("generics")) {
    const generics = nextExpr;
    const nextNextExpr = array[index + 2];
    if (nextNextExpr && nextNextExpr.isList()) {
      acc.result.push(processGenerics(expr, generics, nextNextExpr as List));
      acc.skip = 2; // Skip next two expressions
    } else {
      acc.result.push(processGenerics(expr, generics));
      acc.skip = 1; // Skip next expression
    }
  } else {
    acc.result.push(processParamList(expr, nextExpr as List));
    acc.skip = 1; // Skip next expression
  }
  return acc;
};

const finalizeResult = (
  result: ListValue[],
  isTuple: boolean,
  originalList: List
): List => {
  if (isTuple) {
    result.unshift(",");
    result.unshift("tuple");
  }
  return new List({ ...originalList.metadata, value: result });
};

const processGenerics = (expr: Expr, generics: List, params?: List): List => {
  generics.setAttribute("tuple?", false);

  const list = params || new List([]);
  list.insert(expr);
  list.insert(",", 1);
  list.setAttribute("tuple?", false);
  const functional = functionalNotation(list);

  functional.insert(functionalNotation(generics), 2);
  functional.insert(",", 3);
  return functional;
};

const processParamList = (expr: Expr, params: List): List => {
  params.insert(expr);
  params.insert(",", 1);
  params.setAttribute("tuple?", false);
  return functionalNotation(params);
};
