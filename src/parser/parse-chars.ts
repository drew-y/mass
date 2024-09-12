import { Expr } from "../syntax-objects/expr.js";
import { Identifier } from "../syntax-objects/identifier.js";
import { List } from "../syntax-objects/list.js";
import { Whitespace } from "../syntax-objects/whitespace.js";
import { CharStream } from "./char-stream.js";
import { lexer } from "./lexer.js";
import { getReaderMacroForToken } from "./reader-macros/index.js";
import { Token } from "./token.js";

export type ParseCharsOpts = {
  nested?: boolean;
  terminator?: string;
  parent?: Expr;
};

export const parseChars = (
  file: CharStream,
  opts: ParseCharsOpts = {}
): List => {
  const list = new List({
    location: file.currentSourceLocation(),
    parent: opts.parent,
  });

  while (file.hasCharacters) {
    const token = lexer(file);

    if (processWithReaderMacro(token, list.last(), file, list)) {
      continue;
    }

    if (token.is("(")) {
      const subList = parseChars(file, { nested: true });
      subList.mayBeTuple = true;
      list.push(subList);
      continue;
    }

    if (token.is(")") || token.is(opts.terminator)) {
      if (opts.nested) break;
      continue;
    }

    if (token.isWhitespace) {
      list.push(
        new Whitespace({
          value: token.value,
          location: token.location,
        })
      );
      continue;
    }

    list.push(
      new Identifier({
        value: token.value,
        location: token.location,
      })
    );
  }

  list.location!.endIndex = file.position;
  return opts.nested ? list : new List(["ast", list]);
};

/** Returns true if token was matched with and processed by a macro  */
const processWithReaderMacro = (
  token: Token,
  prev: Expr | undefined,
  file: CharStream,
  list: List
) => {
  const readerMacro = getReaderMacroForToken(token, prev, file.next);
  if (!readerMacro) return undefined;

  const result = readerMacro(file, {
    token,
    reader: (file, terminator) =>
      parseChars(file, {
        nested: true,
        terminator,
      }),
  });

  if (!result) return undefined;

  list.push(result);
  return true;
};
