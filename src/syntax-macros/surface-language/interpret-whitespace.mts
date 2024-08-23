import { isContinuationOp, isGreedyOp } from "../../lib/grammar.mjs";
import { Expr, List } from "../../syntax-objects/index.mjs";

export const interpretWhitespace = (list: List, indentLevel?: number): List => {
  const transformed = new List({ ...list.metadata });

  while (list.hasChildren) {
    const child = elideParens(list, indentLevel);
    if (child?.isList() && child.value.length === 0) continue;
    addSibling(child, transformed);
  }

  if (transformed.value.length === 1 && transformed.first()?.isList()) {
    return transformed.first() as List;
  }

  return transformed;
};

const elideParens = (list: Expr, startIndentLevel?: number): Expr => {
  if (!list.isList()) return list;
  const transformed = new List({});
  const indentLevel = startIndentLevel ?? nextExprIndentLevel(list);

  const nextLineHasChildExpr = () => nextExprIndentLevel(list) > indentLevel;

  const pushChildBlock = () => {
    const children = new List({ value: ["block"] });

    while (nextLineHasChildExpr()) {
      const child = elideParens(list, indentLevel + 1);
      addSibling(child, children);
    }

    const firstChild = children.at(1);
    if (firstChild?.isList() && isNamedParameter(firstChild)) {
      transformed.push(...children.rest());
      return;
    }

    transformed.push(children);
  };

  const pushNestedExpr = () => {
    if (isContinuationOp(nextNonWhitespace(list, 1))) {
      const child = elideParens(list, indentLevel + 1);
      addSibling(child, transformed);
      return;
    }

    pushChildBlock();
  };

  consumeLeadingWhitespace(list);
  while (list.hasChildren) {
    const next = list.first();

    if (isNewline(next) && nextLineHasChildExpr()) {
      pushNestedExpr();
      continue;
    }

    if (isNewline(next) && !isContinuationOp(transformed.at(-1))) {
      break;
    }

    if (next?.isWhitespace()) {
      list.consume();
      continue;
    }

    if (next?.isIdentifier() && next.is(",")) {
      break;
    }

    if (next?.isList()) {
      list.consume();
      transformed.push(interpretWhitespace(next, indentLevel));
      continue;
    }

    if (isGreedyOp(next)) {
      transformed.push(list.consume());

      if (!nextLineHasChildExpr()) {
        transformed.push(elideParens(list, indentLevel));
      }

      continue;
    }

    if (next !== undefined && !transformed.location) {
      transformed.location = next.location;
    }

    if (next !== undefined) {
      transformed.push(next);
      list.consume();
      continue;
    }
  }

  if (
    transformed.location &&
    typeof transformed.last()?.location?.endIndex === "number"
  ) {
    transformed.location.endIndex = transformed.last()!.location!.endIndex;
  }

  if (transformed.value.length === 1) {
    return transformed.first()!;
  }

  return transformed;
};

/** Will return 0 if the next expression is a comma (performance hack for whitespace block parsing) */
const nextExprIndentLevel = (list: List, startIndex?: number) => {
  let index = startIndex ?? 0;
  let nextIndentLevel = 0;

  while (list.at(index)) {
    const expr = list.at(index)!;
    if (isNewline(expr)) {
      nextIndentLevel = 0;
      index += 1;
      continue;
    }

    if (isIndent(expr)) {
      nextIndentLevel += 1;
      index += 1;
      continue;
    }

    if (expr?.isIdentifier() && expr.is(",")) {
      return 0;
    }

    break;
  }

  return nextIndentLevel;
};

const nextNonWhitespace = (list: List, startIndex?: number) => {
  let index = startIndex ?? 0;

  while (list.at(index)?.isWhitespace()) {
    index += 1;
  }

  return list.at(index);
};

const consumeLeadingWhitespace = (list: List) => {
  while (list.hasChildren) {
    const next = list.first();
    if (next?.isWhitespace() || (next?.isIdentifier() && next.is(","))) {
      list.consume();
      continue;
    }
    break;
  }
};

const isNewline = (v?: Expr) => v?.isWhitespace() && v.isNewline;
const isIndent = (v: Expr) => v.isWhitespace() && v.isIndent;

const isNamedParameter = (v: List) => {
  const identifier = v.at(0);
  const colon = v.at(1);

  // First value should be an identifier
  if (!identifier?.isIdentifier()) {
    return false;
  }

  // Second value should be an identifier whose value is a colon
  if (!(colon?.isIdentifier() && colon.is(":"))) {
    return false;
  }

  return true;
};

const addSibling = (child: Expr, siblings: List) => {
  const olderSibling = siblings.at(-1);

  if (!child.isList()) {
    siblings.push(child);
    return;
  }

  if (isContinuationOp(child.first()) && olderSibling) {
    siblings.push([siblings.pop()!, ...child.value]);
    return;
  }

  if (!olderSibling?.isList() || olderSibling.calls("generics")) {
    siblings.push(child);
    return;
  }

  if (isNamedParameter(child) && !isNamedParameter(olderSibling)) {
    olderSibling.push(child);
    return;
  }

  siblings.push(child);
};
