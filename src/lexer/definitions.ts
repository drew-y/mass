export type Token = {
    type: TokenType;
    value: string;
    index: number;
}

export type TokenType = "operator" | "keyword" | "identifier" | "boolean" | "string" | "int" | "float" |
    "{" | "}" | "[" | "]" | "(" | ")" | "|" | "'" |
    ":" | ";" | "," | "?" | "->" | "=>" | "$" | "=" | "&" | "!";

export const operators = [
    "+", "-", "*", "/", "==", "!=", "and", "or", "xor", "<", ">", ">=", "<=", "<>",
    "??", ".", "|>", "|<", "<|", "|>", "<<", ">>"
] as const;

export const keywords = [
    "let", "var", "for", "in", "return", "break", "continue", "if", "else", "elif", "while", "fn",
    "struct", "class", "pub", "mut", "guard", "async", "await", "ref", "final", "static",
    "import", "from", "unsafe", "macro", "impl", "match", "case", "guard", "enum",
    "lazy", "pure", "declare", "type"
] as const;

export const brackets = ["{", "}", "[", "]", "(", ")", "|", "'"] as const;

export const symbols = ["?", ":", ";", ",", "->", "$", "=>", "=", "&", "!"] as const;

export const symbolAndOperatorChars = [
    "+", "-", "*", "/", "=", "!", "<", ">", "?", ":", ".", ";", ",", "$",
    "&", "|"
] as const;
