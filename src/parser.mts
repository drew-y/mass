import { getReaderMacroForToken } from "./reader-macros/index.mjs";

export type AST = Expr[];
export type Expr = string | number | AST;

export interface ParseOpts {
  nested?: boolean;
  terminator?: string;
}

export function parse(dream: string[], opts: ParseOpts = {}): AST {
  const ast: AST = [];

  while (dream.length) {
    const token = lexer(dream);

    const readerMacro = getReaderMacroForToken(token);

    if (readerMacro) {
      ast.push(
        readerMacro(dream, token, (dream, terminator) =>
          parse(dream, { nested: true, terminator })
        )
      );
      continue;
    }

    if (token === "(") {
      ast.push(parse(dream, { nested: true }));
      continue;
    }

    if (token === ")" || token === opts.terminator) {
      if (opts.nested) break;
      continue;
    }

    ast.push(token);
  }

  return ast;
}

const lexer = (dream: string[]): string => {
  let token = "";

  while (dream.length) {
    const char = dream[0];

    const isTerminator = /[\{\[\(\}\]\)\s\.\'\"]/.test(char);

    if (isTerminator && (token[0] === "#" || !token.length)) {
      token += dream.shift()!;
      break;
    }

    if (isTerminator) {
      break;
    }

    token += dream.shift()!;
  }

  return token;
};
