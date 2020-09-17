import binaryen from "binaryen";
import { TypeAlias, VariableEntity, FunctionEntity, ParameterEntity } from "../entity-scanner/definitions";
import {
    Instruction, ReturnStatement, IfExpression, Assignment,
    FunctionDeclaration, VariableDeclaration, WhileStatement, MatchExpression, AST, Identifier, CallExpression
} from "../parser";
import uniqid from "uniqid";
import { Scope } from "../scope";

export class Assembler {
    private readonly mod = new binaryen.Module();

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
            if (instruction.kind === "function-declaration") {
                this.compileFn(instruction);
                continue;
            }

            if (instruction.kind === "impl-declaration") {
                const type = scope.closestEntityWithLabel(instruction.target, ["type-alias"]);

                if (!type) {
                    throw new Error(`${instruction.target} is not a type`);
                }

                instruction.functions.forEach(fn => this.compileFn(fn));
            }
        }
    }

    private compileFn(fn: FunctionDeclaration): number {
        if (!fn.expression) return this.mod.nop();

        const fnEntity = fn.scope.get(fn.id!) as FunctionEntity;
        const expression = this.compileExpression(fn.expression, fn.scope);
        const binParams = binaryen.createType(fnEntity.parameters.map(pId => {
            const pEntity = fn.scope.get(pId) as ParameterEntity;
            return this.getBinType(pEntity.typeEntity! as TypeAlias);
        }));
        const binReturnType = this.getBinType(fnEntity.returnTypeEntity as TypeAlias);
        const binLocals = fn.scope.locals.map(id => {
            const entity = fn.scope.get(id) as VariableEntity;
            if (!entity) {
                console.log(id);
                console.log(fn);
                console.log(fn.scope.get(id));
            }
            return this.getBinType(entity.typeEntity as TypeAlias);
        });

        const id = fn.label === "main" ? "main" : fn.id!;
        const modId = this.mod.addFunction(id, binParams, binReturnType, binLocals, expression);

        if (id === "main") {
            this.mod.addFunctionExport("main", "main");
        }

        return modId;
    }

    private compileExpression(expr: Instruction, scope: Scope): number {
        if (expr.kind === "if-expression") {
            return this.compileIfExpression(expr);
        }

        if (expr.kind === "while-statement") {
            return this.compileWhileStatement(expr, scope);
        }

        if (expr.kind === "match-expression") {
            return this.compileMatchExpression(expr, scope);
        }

        if (expr.kind === "return-statement") {
            return this.compileReturn(expr, scope);
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
            const entity = scope.get(expr.id!) as VariableEntity | ParameterEntity;
            return this.mod.local.get(entity.index, this.getBinType(entity.typeEntity as TypeAlias));
        }

        if (expr.kind === "binary-expression") {
            const fnEntity = scope.get(expr.calleeId!) as FunctionEntity;
            return this.mod.call(fnEntity.id, [
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ], this.getBinType(fnEntity.returnTypeEntity as TypeAlias));
        }

        if (expr.kind === "call-expression") {
            const label = (expr.callee as Identifier).label;
            const builtIn = this.getBuiltIn(label, scope);
            if (builtIn) return builtIn(expr);

            const func = scope.get(expr.calleeId!) as FunctionEntity;
            const args = expr.arguments.map(instr => this.compileExpression(instr, scope));
            return this.mod.call(func.id, args, this.getBinType(func.returnTypeEntity! as TypeAlias));
        }

        if (expr.kind === "block-expression") {
            return this.compileBlock(expr);
        }

        throw new Error(`Invalid expression ${expr.kind}`);
    }

    private compileIfExpression(instruction: IfExpression) {
        return this.mod.if(
            this.compileExpression(instruction.condition, instruction.scope),
            this.compileBlock(instruction),
            instruction.else ? this.compileBlock(instruction.else) : undefined
        );
    }

    private compileBlock(block: AST, prepend: number[] = [], append: number[] = []): number {
        return this.mod.block("", [
            ...prepend,
            ...block.body.map(instruction => {
                if (instruction.kind === "variable-declaration") {
                    return this.compileVariableDeclaration(instruction, block.scope);
                }

                if (instruction.kind === "function-declaration") {
                    return this.compileFn(instruction);
                }

                if (instruction.kind === "assignment") {
                    return this.compileAssignment(instruction, block.scope);
                }

                return this.compileExpression(instruction, block.scope);
            }),
            ...append
        ], binaryen.auto);
    }

    compileAssignment(instruction: Assignment, scope: Scope): number {
        const assignee = scope.get((instruction.assignee as Identifier).id!)! as VariableEntity;
        const expr = this.compileExpression(instruction.expression, scope);
        return this.mod.local.set(assignee.index, expr)
    }

    private compileVariableDeclaration(vr: VariableDeclaration, scope: Scope): number {
        if (!vr.initializer) return this.mod.nop();
        return this.compileAssignment({
            kind: "assignment",
            assignee: { kind: "identifier", label: vr.label, id: vr.id!, tokenIndex: vr.tokenIndex },
            expression: vr.initializer
        }, scope);
    }

    private compileMatchExpression(instruction: MatchExpression, scope: Scope): number {
        const indexFunctionName = `match-${uniqid()}`;
        const cases: { name: string, case: number, expression: number }[] = [];
        for (const dCase of instruction.cases) {
            const name = JSON.stringify(dCase.case);
            cases.push({
                name,
                case: this.compileExpression(dCase.case, scope),
                expression: this.compileExpression(dCase.expression, scope)
            });
        }

        // Build the match indexing function
        const matchBlock: number[] = [
            this.mod.local.set(0, this.compileExpression(instruction.value, scope))
        ];

        cases.forEach((cCase, index) => {
            // If the match value is equal to the case, return the block index of the case's expression.
            matchBlock.push(this.mod.if(
                this.mod.i32.eq(cCase.case, this.mod.local.get(0, binaryen.i32)),
                this.mod.return(this.mod.i32.const(index + 1))
            ))
        });

        matchBlock.push(this.mod.i32.const(0));

        this.mod.addFunction(indexFunctionName, binaryen.createType([]), binaryen.i32, [binaryen.i32], this.mod.block("", matchBlock, binaryen.i32));

        // Convert the 1D cases array to a hierarchical set of blocks, last one containing the switch (br_table).
        // TODO: Make this iterative.
        const makeBlockTree = (caseIndex = 0): number => {
            const cCase = cases[caseIndex];

            if (cCase) {
                return this.mod.block(cCase.name, [
                    makeBlockTree(caseIndex + 1),
                    cCase.expression,
                    this.mod.br("match")
                ]);
            }

            return this.mod.block("matcher", [
                this.mod.switch(
                    [...cases.map(c => c.name), "matcher"],
                    cases[0].name,
                    this.mod.call(indexFunctionName, [], binaryen.i32)
                )
            ]);
        }

        return this.mod.block("match", [makeBlockTree()]);
    }

    private compileReturn(instruction: ReturnStatement, scope: Scope) {
        return this.mod.return(this.compileExpression(instruction.expression, scope))
    }

    private compileWhileStatement(instruction: WhileStatement, scope: Scope) {
        return this.mod.block("while", [
            this.mod.loop("loop",
                this.compileBlock(
                    instruction,
                    [
                        this.mod.br("while", this.mod.i32.ne(
                            this.compileExpression(instruction.condition, scope),
                            this.mod.i32.const(1)
                        ))
                    ],
                    [
                        this.mod.br("loop")
                    ]
                )
            )
        ]);
    }

    private getBinType(type: TypeAlias): number {
        if (!type.flags.includes("declare")) {
            throw new Error(`Unsupported type alias ${type.label}`);
        }

        if (type.label === "i32") {
            return binaryen.i32;
        }

        if (type.label === "Void") {
            return binaryen.none;
        }

        throw new Error(`Unsupported type alias ${type.label}`);
    }

    private getBuiltIn(name: string, scope: Scope): ((expr: CallExpression) => number) | void {
        return ({
            "print": expr =>
                this.mod.call("print", [this.compileExpression(expr.arguments[0], scope)], binaryen.none),
            "i32_add": expr => this.mod.i32.add(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_sub": expr => this.mod.i32.sub(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_div_s": expr => this.mod.i32.div_s(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_mul": expr => this.mod.i32.mul(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_eq": expr => this.mod.i32.eq(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_gt_s": expr => this.mod.i32.gt_s(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_lt_s": expr => this.mod.i32.lt_s(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_ge_s": expr => this.mod.i32.add(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_le_s": expr => this.mod.i32.le_s(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_and": expr => this.mod.i32.and(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            ),
            "i32_or": expr => this.mod.i32.or(
                this.compileExpression(expr.arguments[0], scope),
                this.compileExpression(expr.arguments[1], scope)
            )
        } as Record<string, (expr: CallExpression) => number>)[name];
    }
}
