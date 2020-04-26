import { Token, tokenize } from "../lexer";
import { Instruction, VariableDeclaration, TypeArgument, MethodDeclaration, ParameterDeclaration, ReturnStatement, Assignment } from "./definitions";
import { isInTuple } from "../helpers";

export function parse(code: string): Instruction[] {
    const tokens = tokenize(code);
    return parseTokens(tokens);
}

function parseTokens(tokens: Token[]): Instruction[] {
    const ast: Instruction[] = [];

    while (tokens.length > 0) {
        const next = tokens[0];
        if (next.type === "}") {
            tokens.shift();
            break;
        }

        ast.push(parseStatement(tokens));
    }

    return ast;
}

function parseStatement(tokens: Token[]): Instruction {
    while (tokens.length > 0) {
        let token = tokens[0];
        const next = tokens[1];

        // Ignore newlines and semicolons
        if (isInTuple(token.type, ["\n", ";"] as const)) {
            tokens.shift();
            continue;
        }

        if (token.type === "keyword" && isInTuple(token.value, ["let", "var"])) {
            return parseVariableDeclaration(tokens);
        }

        if (token.type === "keyword" && isInTuple(token.value, ["async", "mut", "def"])) {
            return parseMethodDeclaration(tokens);
        }

        if (token.type === "keyword" && token.value === "return") {
            return parseReturnStatement(tokens);
        }

        if (token.type === "identifier" && next && next.type === "=") {
            return parseAssignment(tokens);
        }

        return parseExpression(tokens);
    }

    throw new Error("Invalid statement");
}

function parseAssignment(tokens: Token[]): Assignment {
    const identifier = tokens.shift();
    if (!identifier || identifier.type !== "identifier") {
        throw new Error(`Unexpected identifier token in assignment`);
    }

    const equals = tokens.shift();
    if (!equals || equals.type !== "=") {
        throw new Error("Expected = token in assignment statement");
    }

    return {
        kind: "assignment",
        identifier: identifier.value,
        expression: parseExpression(tokens)
    }
}

function parseReturnStatement(tokens: Token[]): ReturnStatement {
    const returnToken = tokens.shift();
    if (!returnToken || returnToken.value !== "return") {
        throw new Error("Expected return token");
    }

    return {
        kind: "return-statement",
        expression: parseExpression(tokens)
    }
}

function parseMethodDeclaration(tokens: Token[]): MethodDeclaration {
    const flags: string[] = [];

    while (tokens[0].type === "keyword" && isInTuple(tokens[0].value, ["async", "mut", "def"])) {
        flags.push(tokens.shift()!.value);
    }

    const identifierToken = tokens.shift();
    if (!identifierToken || identifierToken.type !== "identifier") {
        throw new Error("Expected identifier after method declaration");
    }

    const identifier = identifierToken.value;
    const parameters = parseMethodParameters(tokens);

    let returnType: TypeArgument | undefined;
    if (tokens[0].type === "->") {
        tokens.shift();
        returnType = parseTypeArgument(tokens);
    }

    if (tokens[0].type !== "{") {
        throw new Error(`Unexpected token in method declaration: ${tokens[0].type}`);
    }
    tokens.shift();

    const body = parseTokens(tokens);

    return {
        kind: "method-declaration",
        identifier,
        parameters,
        returnType,
        body,
        typeParameters: [], // TODO
        flags
    }
}

function parseMethodParameters(tokens: Token[]): ParameterDeclaration[] {
    const params: ParameterDeclaration[] = [];

    const openingBracket = tokens.shift();
    if (!openingBracket || !isInTuple(openingBracket.type, <const>["("])) {
        throw new Error("Method definition missing parameters");
    }

    // In the future, we will support "]" as well
    const closeBracket = <const>")";

    let token = tokens[0];
    while (token && token.type !== closeBracket) {
        if (token.type === "identifier") {
            params.push(parseParameter(tokens));
            token = tokens[0];
            continue;
        }

        if (token.type === ",") {
            tokens.shift();
            token = tokens[0];
            continue;
        }

        throw new Error(`Invalid token in parameters: ${token.type}`);
    }

    // Remove the closeBracket
    tokens.shift();

    return params;
}

function parseParameter(tokens: Token[]): ParameterDeclaration {
    const flags: string[] = [];

    const identifierToken = tokens.shift();
    if (!identifierToken || identifierToken.type !== "identifier") {
        throw new Error("Invalid parameter definition");
    }

    const identifier = identifierToken.value;

    const separator = tokens.shift();
    if (!separator || !isInTuple(separator.value, <const>[":", "="])) {
        throw new Error("Unexpected token in parameter definition");
    }

    if (separator.value === "=") {
        const initializer = parseExpression(tokens);
        return {
            kind: "parameter-declaration",
            identifier,
            initializer,
            flags
        }
    }

    let token = tokens[0];
    while (token && isInTuple(token.value, <const>["mut", "ref"])) {
        flags.push(token.value);
        tokens.shift();
        token = tokens[0];
    }

    const type = parseTypeArgument(tokens);

    return {
        kind: "parameter-declaration",
        identifier,
        type,
        flags
    }
}

function parseVariableDeclaration(tokens: Token[]): VariableDeclaration {
    const flags: string[] = [];
    const identifiers: string[] = [];
    let type: TypeArgument | undefined = undefined;
    let initializer: Instruction | undefined;

    while (tokens[0] && isInTuple(tokens[0].value, ["let", "var"])) {
        flags.push(tokens.shift()!.value);
    }

    while (tokens[0] && isInTuple(tokens[0].type, <const>["identifier", ","])) {
        const token = tokens.shift()!;

        if (token.type === ",") {
            tokens.shift();
            continue;
        }

        identifiers.push(token.value);
    }

    if (tokens[0].type === ":") {
        tokens.shift();
        type = parseTypeArgument(tokens);
    }

    if (tokens[0].value === "=") {
        tokens.shift();
        initializer = parseExpression(tokens);
    }

    return {
        kind: "variable-declaration",
        identifiers, flags, type, initializer
    };
}

function parseTypeArgument(tokens: Token[]): TypeArgument {
    const token = tokens.shift()!;
    // For now we assume a simple type as an identifier.
    return {
        kind: "type-argument",
        identifier: token.value,
        flags: []
    };
}

function parseExpression(tokens: Token[], terminator?: Token): Instruction {
    const output: Instruction[] = [];
    const operator: Token[] = [];

    // Since we don't use ; to terminate an expression, we can tell the expression
    // Is done if we get two non-operator tokens in a row (-newlines).
    // This is my ugly temp solution. Looking for a way to make it cleaner.
    let expectOperatorToContinue = false;
    while (tokens.length > 0) {
        const token = tokens[0];

        // Ignore new lines for now
        if (token.type === "\n") {
            tokens.shift();
            continue;
        }

        // Consumed terminator
        if (terminator && token.type === terminator.type) {
            tokens.shift();
            break;
        }

        if (token.type !== "operator") {
            if (expectOperatorToContinue) break;
            expectOperatorToContinue = true;
        } else {
            if (!expectOperatorToContinue) {
                throw new Error(`Unexpected operator: ${token.value}`);
            }

            expectOperatorToContinue = false;
        }

        if (token.type === "int") {
            output.push({ kind: "i32-literal", value: token.value });
            tokens.shift();
            continue;
        }

        if (token.type === "float") {
            output.push({ kind: "f32-literal", value: token.value });
            tokens.shift();
            continue;
        }

        if (token.type === "string") {
            output.push({ kind: "string-literal", value: token.value });
            tokens.shift();
            continue;
        }

        if (token.type === "boolean") {
            output.push({ kind: "bool-literal", value: token.value === "true" });
            tokens.shift();
            continue;
        }

        if (token.type === "keyword") {
            if (token.value === "if") {
                tokens.shift();
                const condition = parseExpression(tokens, { type: "{", value: "{" });
                const body = parseTokens(tokens);
                output.push({ kind: "if-expression", condition, body });
                continue;
            }

            throw new Error(`Invalid keyword in expression: ${token.value}`);
        }

        if (token.type === "identifier") {
            // Handle possible function / method call
            const next = tokens[1];
            if (next && isInTuple(next.type, ["(", "["])) {
                // Remove identifier token
                tokens.shift();

                output.push({
                    kind: "method-or-function-call",
                    identifier: token.value,
                    arguments: parseArguments(tokens), // T
                });
                continue;
            }

            output.push({ kind: "identifier", value: token.value });
            tokens.shift();
            continue;
        }

        if (token.type === "operator") {
            while (operator.length > 0) {
                const op = operator[operator.length - 1];
                if (getOperatorPrecedence(op.value) >= getOperatorPrecedence(token.value)) {
                    output.push({
                        kind: "method-or-function-call",
                        identifier: operator.pop()!.value,
                        arguments: [output.pop()!, output.pop()!]
                    });
                    continue;
                }
                break;
            }

            operator.push(tokens.shift()!);
            continue;
        }

        if (token.type === "(") {
            tokens.shift();
            output.push(parseExpression(tokens));
            tokens.shift();
            continue;
        }

        // Non-consumed terminators
        if (isInTuple(token.type, ["}", ")", ","])) break;

        throw new Error(`Unexpected token: ${token.type} ${token.value}`);
    }

    // Infix parsing
    while (operator.length > 0) {
        output.push({
            kind: "method-or-function-call",
            identifier: operator.pop()!.value,
            arguments: [output.pop()!, output.pop()!]
        });
    }

    return output[0] as Instruction;
}

function getOperatorPrecedence(operator: string): number {
    const precedences: Record<string, number> = {
        "and": 1,
        "or": 1,
        "xor": 1,
        "==": 2,
        "<": 2,
        ">": 2,
        ">=": 2,
        "<=": 2,
        "<>": 2,
        "?": 2,
        "+": 2,
        "-": 2,
        "*": 3,
        "/": 3,
        "^": 4,
        ".": 5,
        "=": 0,
        "=>": 0
    }
    return precedences[operator];
}

function parseArguments(tokens: Token[]): Instruction[] {
    const args: Instruction[] = [];

    // For now we just get rid of the opening brace. We also only handle (
    const openingBracket = tokens.shift();
    if (!openingBracket || openingBracket.type !== "(") {
        throw new Error("Expected opening bracket in argument expression");
    }

    while (tokens.length > 0) {
        let token = tokens[0];
        if (token.type === ",") {
            tokens.shift();
        }

        if (token.type === ")") {
            tokens.shift();
            break;
        }

        args.push(parseExpression(tokens))
        token = tokens[0];
    }

    return args;
}
