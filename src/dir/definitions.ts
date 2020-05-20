
export interface IREntities {
    /** Where key is the unique id of the identifier, and value is the key of the type */
    [id: string]: IREntity;
}

export interface WASMTypes {
    /** Where key is the unique id of the user defined type, value is the type */
    [id: string]: WASMType;
}

export interface IRFunctions {
    [id: string]: string;
}

export interface IRGlobals {
    [id: string]: string;
}

///////////////////////////////
///////////////////////////////
///// IREntities
///////////////////////////////
///////////////////////////////

/** Any item that can be referenced by an identifier */
export type IREntity =
    IRFunctionEntity |
    IRTypeEntity |
    IRValueEntity;

export interface IRFunctionEntity extends IREntityBase {
    kind: "function";

    /** Entity ID */
    parameters: string[];

    /** Entity ID */
    locals: string[];

    /** Entity ID */
    returnType: string;
}

/** Represents types such as structs, enums, and type aliases */
export interface IRTypeEntity extends IREntityBase {
    kind: "type";
}


export interface IRValueEntity extends IREntityBase {
    kind: "value";
    typeEntity: string;
}

/** A declared definition */
export interface IREntityBase {
    kind: string;
    id: string;
    label: string;
    flags: string[];

    /** Namespace ID */
    namespace: string;

    /** Where type is the ID of the type definition */
    wasmType: string;
}


///////////////////////////////
///////////////////////////////
///// Instructions
///////////////////////////////
///////////////////////////////

export type IRInstruction =
    IRWhileStatement |
    IRIfExpression |
    IRCallExpression |
    IRContinueStatement |
    IRBreakStatement |
    IRReturnStatement |
    IRIntLiteral |
    IRFloatLiteral |
    IRStringLiteral |
    IRBoolLiteral |
    IRIdentifier |
    IRAssignment |
    IRMatchCase |
    IRMatchExpression;

export interface IRWhileStatement extends IRNode {
    kind: "while-statement";
    condition: IRInstruction;
    namespace: string;
    body: IRInstruction[];
}

export interface IRBreakStatement extends IRNode {
    kind: "break-statement";
}

export interface IRContinueStatement extends IRNode {
    kind: "continue-statement";
}

export interface IRIfExpression extends IRNode {
    kind: "if-expression";
    returnType: string;
    condition: IRInstruction;
    body: IRInstruction[];
    namespace: string;
    elseBody?: IRInstruction[];
    elseIfBodies?: { expression: IRNode, body: IRInstruction[] }[];
}

export interface IRMatchExpression extends IRNode {
    kind: "match-expression";
    value: IRInstruction;
    valueType: string;
    returnType: string;
    cases: IRMatchCase[];
    flags: string[];
}

export interface IRMatchCase extends IRNode {
    kind: "match-case",
    case: IRInstruction;
    expression: IRInstruction;
}

export interface IRCallExpression extends IRNode {
    kind: "call-expression";
    calleeID: string;
    calleeLabel: string;
    arguments: IRInstruction[];
    /** unique id of the type */
    returnType: string;
}

export interface IRReturnStatement extends IRNode {
    kind: "return-statement";
    expression: IRInstruction;
}

export interface IRIntLiteral extends IRNode {
    kind: "int-literal";
    value: string;
}

export interface IRFloatLiteral extends IRNode {
    kind: "float-literal";
    value: string;
}

export interface IRStringLiteral extends IRNode {
    kind: "string-literal";
    value: string;
}

export interface IRBoolLiteral extends IRNode {
    kind: "bool-literal";
    value: boolean;
}

/** This instruction should return the value of the identifier. */
export interface IRIdentifier extends IRNode {
    kind: "identifier";
    id: string;
    label: string;
}

export interface IRAssignment extends IRNode {
    kind: "assignment";
    /** identifier id */
    id: string;
    /** identifier label */
    label: string;
    expression: IRInstruction;
}

export interface IRNode {
    kind: string;
}

///////////////////////////////
///////////////////////////////
///// Types
///////////////////////////////
///////////////////////////////

/**
 * A WASM Type header
 */
export type WASMType =
    IRValueWASMType |
    IRMultiValueWASMType |
    IRFunctionWASMType;

export interface IRValueWASMType extends WASMTypeBase {
    kind: "value";
    binaryenType: number;
    mutable: boolean;
}

export interface IRMultiValueWASMType extends WASMTypeBase {
    kind: "multi-value";
    binaryenType: number[];
    mutable: boolean;
}

export interface IRFunctionWASMType extends WASMTypeBase {
    kind: "function";
    parameters: number[];
    locals: number[];
    returnType: number;
}

export interface WASMTypeBase {
    id: string;
    kind: string;
}
