import binaryen from "binaryen";
import { ValueCollection } from "./values";
import { WASMType, Entity, FunctionEntity } from "../definitions";
import {
    parse, Instruction, ReturnStatement, IfExpression, Assignment,
    FunctionDeclaration, VariableDeclaration, WhileStatement, MatchExpression, AST, TypeDeclaration, PropertyAccessExpression, Identifier
} from "../parser";
import uniqid from "uniqid";
import { Scope } from "../scope";
import { readFileSync } from "fs";

export class Assembler {
    private readonly mod = new binaryen.Module();
    private readonly stdScope = new Scope();

    constructor() {
        this.mod.autoDrop();
        this.mod.addFunctionImport("print", "imports", "print", binaryen.i32, binaryen.none);
    }

    compile(ast: AST) {
        this.walkInstructions(ast.body, ast.scope);
        return this.mod;
    }

    private walkInstructions(instructions: Instruction[], scope: Scope) {
        for (const instruction of instructions) {
            if (instruction.kind === "type-declaration") {
                // TODO.
                continue;
            }

            if (instruction.kind === "function-declaration") {
                this.compileFn(instruction);
                continue;
            }

            if (instruction.kind === "impl-declaration") {
                const type = scope.functionsWithLabel(instruction.target, this.entities)[0];

                if (!type || type.kind !== "type") {
                    throw new Error(`${instruction.target} is not a type`);
                }

                instruction.functions.forEach(fn => this.compileFn(fn, type.id));
            }
        }
    }


    private compileFn(fn: FunctionDeclaration, self?: string): number {
        const expression = this.compileExpression(fn.expression!, locals, fnScope);
        const binParams = binaryen.createType(parameters.map(p => {
            const type = this.entities.get(p) as WASMType;
            return type.binType;
        }))

        return this.mod.addFunction(id, binParams, returnType.binType, locals.values, expression);
    }

    private compileExpression(expr: Instruction, locals: LocalsTracker, scope: Scope): number {
        if (expr.kind === "if-expression") {
            return this.compileIfExpression(expr, locals, scope);
        }

        if (expr.kind === "while-statement") {
            return this.compileWhileStatement(block, mod, expr, vals);
        }

        if (expr.kind === "match-expression") {
            return this.compileMatchExpression(block, mod, expr, vals);
        }

        if (expr.kind === "return-statement") {
            return this.compileReturn(block, mod, expr, vals);
        }

        if (expr.kind === "int-literal") {
            return this.mod.i32.const(Number(expr.value));
        }

        if (expr.kind === "float-literal") {
            return this.mod.f32.const(Number(expr.value));
        }

        if (expr.kind === "bool-literal") {
            return this.mod.i32.const(expr.value ? 1 : 0);
        }

        if (expr.kind === "identifier") {
            const identifier = vals.retrieve(expr.label);

            if (identifier.kind === "local") {
                return mod.local.get(identifier.index, identifier.type);
            }

            if (identifier.kind === "global") {
                return mod.global.get(identifier.id, identifier.type);
            }

            throw new Error(`Unsupported identifier type in expression: ${identifier.kind}`);
        }

        if (expr.kind === "binary-expression") {
            return compileBinaryExpression(expr, mod, vals);
        }

        if (expr.kind === "call-expression") {
            // TODO: Add to vals as stdlib
            if (expr.calleeLabel === "print") {
                return (mod.call as any)("print", [compileExpression(expr.arguments[0], mod, vals)], binaryen.none);
            }

            const val = vals.retrieve(expr.calleeLabel);
            if (val.kind !== "method") throw new Error(`${expr.calleeLabel} is not a method`);
            const args = expr.arguments.map(instr => compileExpression(instr, mod, vals));
            return (mod.call as any)(val.id, args, val.returnType);
        }

        throw new Error(`Invalid expression ${expr.kind}`);
    }

    private compileIfExpression(instruction: IfExpression, locals: LocalsTracker, scope: Scope) {
        return this.mod.if(
            this.compileExpression(instruction.condition, locals, scope),
            this.compileBlock(instruction.body, locals, scope)
        )
    }

    private compileBlock(body: AST, locals: LocalsTracker, scope: Scope): number {
        return this.mod.block("", body.map(instruction => {
            if (instruction.kind === "variable-declaration") {
                return this.compileVariableDeclaration(instruction, locals, scope);
            }

            if (instruction.kind === "function-declaration") {
                return this
            }

            if (instruction.kind === "assignment") {
                compileAssignment(instruction, mod, vals, block);
                return;
            }

            return compileExpression(instruction, mod, vals);
        }));
    }

    private compileVariableDeclaration(vr: VariableDeclaration, locals: LocalsTracker, scope: Scope): number {
        const type = vr.type ?
            this.resolveTypeEntityFromLabel(vr.type.label, scope) :
            this.inferType(vr.initializer!, scope) as WASMType;

        locals.values.push(type.binType);

        const index = locals.values.length + locals.offset;

        this.entities.add({
            kind: "local",
            label: vr.label,
            typeEntity: type.id,
            flags: vr.flags,
            mutable: vr.flags.includes("var"),
            index,
            scope
        });

        if (!vr.initializer) return this.mod.nop();

        return this.mod.local.set(index, this.compileExpression(vr.initializer, locals, scope));
    }

    /** Returns the expression's result type entity, TODO: ADD ERROR CHECKING IN PLACE OF AS IRTypeEntity */
    private inferType(expr: Instruction, scope: Scope): WASMType {
        if (expr.kind === "call-expression") {
            const entity = this.resolveEntity(expr.callee, scope)[0];
            if (!entity || entity.kind !== "function") throw new Error(`${findLabelForCall(expr)} is not a function.`);
            const returnType = (entity as FunctionEntity).returnType;
            if (returnType) return this.entities.get(returnType) as WASMType;
        }

        if (expr.kind === "binary-expression") {
            const operand = this.inferType(expr.arguments[0], scope);
            const entity = operand.scope.functionsWithLabel(expr.calleeLabel, this.entities)[0];
            if (!entity || entity.kind !== "function") throw new Error(`${findLabelForCall(expr)} is not a function.`);
            const returnType = (entity as FunctionEntity).returnType;
            if (returnType) return this.entities.get(returnType) as WASMType;
        }

        if (expr.kind === "identifier") {
            const entity = this.resolveEntity(expr, scope)[0];

            if (!entity) {
                throw new Error(`${expr.label} is not defined`);
            }

            if (entity.kind === "local") return this.entities.get(entity.typeEntity) as WASMType;
            return entity as WASMType;
        }

        if (expr.kind === "block-expression") {
            return this.inferType(expr.body[expr.body.length - 1], scope);
        }

        if (expr.kind === "parameter-declaration") {
            if (expr.type) {
                return scope.functionsWithLabel(expr.type.label, this.entities)[0] as WASMType;
            }

            if (expr.initializer) {
                return this.inferType(expr.initializer, scope);
            }
        }

        const byLabel = (label: string) => scope.functionsWithLabel(label, this.entities)[0];
        if (expr.kind === "bool-literal") return byLabel("bool") as WASMType;
        if (expr.kind === "float-literal") return byLabel("f32") as WASMType;
        if (expr.kind === "int-literal") return byLabel("i32") as WASMType;
        if (expr.kind === "return-statement") return this.inferType(expr.expression, scope);
        if (expr.kind === "if-expression") {
            return this.inferType(expr.body[expr.body.length - 1], scope);
        }

        throw new Error(`Unable to infer type`);
    }

    private resolveEntity(expr: PropertyAccessExpression | Identifier, scope: Scope): Entity[] {
        if (expr.kind === "identifier") {
            return scope.functionsWithLabel(expr.label, this.entities);
        }

        const parent = this.resolveEntity(expr.arguments[0], scope)[0];
        return this.resolveEntity(expr.arguments[1], parent.scope);
    }

    private resolveTypeEntityFromLabel(label: string, scope: Scope) {
        const typeEntity = scope.functionsWithLabel(label, this.entities)[0];

        if (!typeEntity || typeEntity.kind !== "type") {
            throw new Error(`${typeEntity.label} is not a type`);
        }

        return typeEntity;
    }

    private getBinType(type: TypeDeclaration): number {
        if (!type.flags.includes("declare")) {
            throw new Error(`Unsupported type alias ${type.label}`);
        }

        if (type.label === "i32") {
            return binaryen.i32;
        }

        throw new Error(`Unsupported type alias ${type.label}`);
    }
}

// TODO: Support non integer cases.
// TODO: Support patterns (ranges, strings, enum destructuring, etc.)
// TODO: Support default
// TODO: Document how this works. ASAP
function compileMatchExpression(block: number[], mod: binaryen.Module, instruction: MatchExpression, vals: ValueCollection) {
    const indexFunctionName = `match-${uniqid()}`;
    const cases: { name: string, case: number, expression: number }[] = [];
    for (const dCase of instruction.cases) {
        const name = JSON.stringify(dCase.case);
        cases.push({
            name,
            case: compileExpression(dCase.case, mod, vals),
            expression: compileExpression(dCase.expression, mod, vals)
        });
    }

    // Build the match indexing function

    const matchBlock: number[] = [
        mod.local.set(0, compileExpression(instruction.value, mod, vals))
    ];

    cases.forEach((cCase, index) => {
        // If the match value is equal to the case, return the block index of the case's expression.
        matchBlock.push(mod.if(
            mod.i32.eq(cCase.case, mod.local.get(0, binaryen.i32)),
            mod.return(mod.i32.const(index + 1))
        ))
    });

    matchBlock.push(mod.i32.const(0));

    mod.addFunction(indexFunctionName, binaryen.createType([]), binaryen.i32, [binaryen.i32], mod.block("", matchBlock, binaryen.i32));

    // Convert the 1D cases array to a hierarchical set of blocks, last one containing the switch (br_table).
    // TODO: Make this iterative.
    function makeBlockTree(caseIndex = 0): number {
        const cCase = cases[caseIndex];

        if (cCase) {
            return mod.block(cCase.name, [
                makeBlockTree(caseIndex + 1),
                cCase.expression,
                mod.br("match")
            ]);
        }

        return mod.block("matcher", [
            mod.switch(
                [...cases.map(c => c.name), "matcher"],
                cases[0].name,
                mod.call(indexFunctionName, [], binaryen.i32)
            )
        ]);
    }

    block.push(mod.block("match", [makeBlockTree()]));
}

function compileReturn(block: number[], mod: binaryen.Module, instruction: ReturnStatement, vals: ValueCollection) {
    block.push(mod.return(compileExpression(instruction.expression, mod, vals)));
}

function compileWhileStatement(block: number[], mod: binaryen.Module, instruction: WhileStatement, vals: ValueCollection) {
    block.push(
        mod.block("while", [
            mod.loop("loop",
                compileBlock({
                    body: instruction.body, mod, vals: vals,
                    existingInstructions: [
                        mod.br("while", mod.i32.ne(
                            compileExpression(instruction.condition, mod, vals),
                            mod.i32.const(1)
                        ))
                    ],
                    additionalInstructions: [
                        mod.br("loop")
                    ]
                })
            )
        ])
    );
}

function compileAssignment(instruction: Assignment, mod: binaryen.Module, vals: ValueCollection, block: number[]) {
    const id = instruction.assigneeLabel;
    const expr = compileExpression(instruction.expression, mod, vals);
    const val = vals.retrieve(id);

    if (val.kind === "method" || !val.mutable) {
        throw new Error(`${id} cannot be reassigned`);
    }

    if (val.kind === "local") {
        block.push(mod.local.set(val.index, expr));
        return;
    }

    block.push(mod.global.set(id, expr));
}
