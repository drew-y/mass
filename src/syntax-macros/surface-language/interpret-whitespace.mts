import { isContinuationOp, isGreedyOp } from "../../lib/grammar.mjs";
import { Expr, List } from "../../syntax-objects/index.mjs";

export const interpretWhitespace = (list: List): List => {
  const transformed = new List({ ...list.metadata });

  while (list.hasChildren) {
    const child = elideParens(list);
    addSibling(child, transformed);
    consumeLeadingWhitespace(list);
  }

  return transformed;
};

export type ElideParensOpts = {
  indentLevel?: number;
};

const elideParens = (list: Expr, opts: ElideParensOpts = {}): Expr => {
  if (!list.isList()) return list;
  const transformed = new List({});
  let indentLevel = opts.indentLevel ?? 0;

  const nextLineHasChildExpr = () => nextExprIndentLevel(list) > indentLevel;

  const pushChildBlock = () => {
    const children = new List({ value: ["block"] });

    while (nextExprIndentLevel(list) > indentLevel) {
      const child = elideParens(list, { indentLevel: indentLevel + 1 });
      addSibling(child, children);
    }

    transformed.push(children);
  };

  consumeLeadingWhitespace(list);
  while (list.hasChildren) {
    const next = list.first();

    const isNewline = next?.isWhitespace() && next.isNewline;
    if (isNewline && nextLineHasChildExpr()) {
      if (isContinuationOp(nextNonWhitespace(list, 1))) {
        const child = elideParens(list, { indentLevel: indentLevel + 1 });
        addSibling(child, transformed);
        continue;
      }

      pushChildBlock();
      continue;
    }

    if (isNewline && !isContinuationOp(transformed.at(-1))) {
      break;
    }

    if (next?.isWhitespace()) {
      list.consume();
      continue;
    }

    if (next?.isList()) {
      transformed.push(removeWhitespaceFromList(next, indentLevel));
      list.consume();
      continue;
    }

    if (isGreedyOp(next)) {
      transformed.push(list.consume());
      if (!nextLineHasChildExpr()) transformed.push(elideParens(list, opts));
      continue;
    }

    if (next !== undefined) {
      transformed.push(next);
      list.consume();
      continue;
    }
  }

  if (transformed.value.length === 1) {
    return transformed.first()!;
  }

  return transformed;
};

const removeWhitespaceFromList = (list: List, indentLevel: number): List => {
  consumeLeadingWhitespace(list);
  return list
    .map((expr) => {
      if (expr.isList()) {
        return removeWhitespaceFromList(expr, indentLevel);
      }

      return expr;
    })
    .filter((expr) => {
      if (expr.isWhitespace()) return false;
      return true;
    });
};

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
    if (next?.isWhitespace()) {
      list.consume();
      continue;
    }
    break;
  }
};

const isNewline = (v: Expr) => v.isWhitespace() && v.isNewline;
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

  if (!olderSibling?.isList()) {
    siblings.push(child);
    return;
  }

  if (isNamedParameter(child) && !isNamedParameter(olderSibling)) {
    olderSibling.push(child);
    return;
  }

  siblings.push(child);
};
