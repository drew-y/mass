import { AST, FunctionDeclaration, Instruction, IfExpression, ImplDeclaration, VariableDeclaration, PropertyAccessExpression, Assignment, StructLiteral, Identifier, UseStatement, UseTree } from "./parser";
import { Scope } from "./scope";
import { FunctionEntity, ParameterEntity, StructFieldEntity, TypeAliasEntity, TypeEntity, VariableEntity } from "./entity-scanner";
import { Module } from "./module";

/** Enforces scoping rules, resolves identifiers and infers types. */
export function analyseSemantics(module: Module) {
    for (const subModule in module.subModules) {
        analyseSemantics(module.subModules[subModule]);
    }

    // We are doing this here because it is a pain to pass module all over the place.
    // This will be moved to scanInstruction after an AST rework.
    scanForImports(module);
    scanBlock({ body: module.ast, scope: module.scope });
}

// Currently assumes use statements are at the top of the module
function scanForImports(module: Module) {
    for (const instruction of module.ast) {
        if (instruction.kind !== "use") break;
        scanUseTree(instruction.tree, module);
    }
}

function scanUseTree(tree: UseTree, module: Module) {
    const resolveUseModule = (module: Module, path: Identifier[]): Module => {
        if (path.length === 0) return module;
        const moduleIdentifier = path.shift()!;
        return resolveUseModule(getSiblingModule(module, moduleIdentifier.label), path);
    }
    const useModule = resolveUseModule(module, JSON.parse(JSON.stringify(tree.path)));

    if (tree.node.kind === "self") {
        // TODO
    }

    if (tree.node.kind === "alias") {
        // TODO
    }

    if (tree.node.kind === "wildcard") {
        module.scope.import(useModule.exports);
    }

    if (tree.node.kind === "branched") {
        for (const branch of tree.node.branches) {
            scanUseTree(branch, useModule);
        }
    }
}

function getSiblingModule(module: Module, label: string): Module {
    const sibling = module.parent!.subModules[label];
    if (!sibling) {
        throw new Error(`Sibling module ${label} does not exist`);
    }
    return sibling;
}

function scanBlock({ body, scope }: { body: Instruction[]; scope: Scope; }) {
    for (const instruction of body) {
        scanInstruction({ instruction, scope });
    }
}

function scanInstruction({ scope, instruction }: { scope: Scope, instruction: Instruction }) {
    if (instruction.kind === "block-expression") {
        scanBlock({ body: instruction.body, scope: instruction.scope });
        return;
    }

    if (instruction.kind === "impl-declaration") {
        scanImpl({ scope, instruction });
        return;
    }

    if (instruction.kind === "variable-declaration") {
        scanVariableDeclaration(instruction, scope);
        return;
    }

    if (instruction.kind === "function-declaration") {
        scanFn(instruction, scope);
        return;
    }

    if (instruction.kind === "if-expression") {
        scanIf({ dif: instruction, scope });
        return;
    }

    if (instruction.kind === "while-statement") {
        scanBlock({ body: instruction.body, scope });
        scanInstruction({ instruction: instruction.condition, scope });
        return;
    }

    if (instruction.kind === "identifier") {
        const entity = scope.resolveLabel(instruction.label);
        if (!entity) throw new Error(`No entity with label ${instruction.label} in current scope.`);
        if (entity.kind === "variable" && instruction.tokenIndex < entity.tokenIndex) {
            throw new Error(`Identifier ${instruction.label} used before defined`);
        }
        instruction.id = entity.id;
    }

    if (instruction.kind === "binary-expression") {
        instruction.arguments.forEach(instruction => scanInstruction({ scope, instruction }));
        const typeEntity = typeEntityOfExpression(instruction.arguments[0], scope);
        if (!typeEntity) throw new Error("Missing type for left hand of binary expression");
        const func = typeEntity.instanceScope.resolveLabel(instruction.calleeLabel);
        if (!func) throw new Error(`${instruction.calleeLabel} is not a function`);
        instruction.calleeId = func.id;
        return;
    }

    if (instruction.kind === "call-expression") {
        instruction.arguments.forEach(instruction => scanInstruction({ scope, instruction }));
        const func = scope.resolveLabel(instruction.calleeLabel);
        if (!func) throw new Error(`${instruction.calleeLabel} is not a function`);
        instruction.calleeId = func.id;
        return;
    }

    if (instruction.kind === "property-access-expression") {
        scanPropertyAccessExpression(instruction, scope);
        return;
    }

    if (instruction.kind === "match-expression") {
        instruction.cases.forEach(mCase => scanInstruction({ scope, instruction: mCase.expression }));
        return;
    }

    if (instruction.kind === "assignment") {
        scanAssignment(instruction, scope);
        return;
    }

    if (instruction.kind === "struct-literal") {
        scanStructLiteral(instruction, scope);
        return;
    }
}

function scanStructLiteral(struct: StructLiteral, scope: Scope) {
    for (const label in struct.fields) {
        const fieldNode = struct.fields[label];
        scanInstruction({ scope, instruction: fieldNode.initializer });
        const entity = scope.get(fieldNode.id!) as StructFieldEntity;
        entity.typeEntity = typeEntityOfExpression(fieldNode.initializer, scope);
    }
}

function scanAssignment(expr: Assignment, scope: Scope) {
    scanInstruction({ scope, instruction: expr.assignee });
    scanInstruction({ scope, instruction: expr.expression });

    if (expr.assignee.kind === "identifier") {
        const entity = scope.get(expr.assignee.id!) as VariableEntity;
        if (!entity.flags.includes("let")) return;
        throw new Error(`Error: Cannot reassign immutable variable: ${expr.assignee.label}.`);
    }
}

function scanPropertyAccessExpression(expr: PropertyAccessExpression, scope: Scope) {
    const left = expr.arguments[0];
    const right = expr.arguments[1];
    scanInstruction({ instruction: left, scope });
    const typeEntity = typeEntityOfExpression(left, scope);

    if (right.kind === "call-expression") {
        const typeEntityFunc = typeEntity.instanceScope.resolveLabel(right.calleeLabel);

        if (typeEntityFunc) {
            right.calleeId = typeEntityFunc.id;
            return;
        }

        // UFCS Search
        const scopeEntityFunc = scope.resolveLabel(right.calleeLabel);
        if (!scopeEntityFunc) throw new Error(`${right.calleeLabel} is not a function`);
        right.calleeId = scopeEntityFunc.id;
        return;
    }

    if (right.kind === "identifier") {
        scanInstruction({ instruction: right, scope: typeEntity.instanceScope });
        return;
    }

    throw new Error(`Invalid right of property access expression ${right.kind}`);
}


function scanVariableDeclaration(expr: VariableDeclaration, scope: Scope) {
    const varEntity = scope.get(expr.id!) as VariableEntity;
    if (expr.initializer) scanInstruction({ scope, instruction: expr.initializer });
    if (expr.type) {
        const typeEntity = scope.resolveType(expr.type.label);
        if (!typeEntity) throw new Error(`Could not resolve type for ${expr.label}`);
        varEntity.typeEntity = typeEntity as TypeEntity;
    } else if (expr.initializer) {
        const typeEntity = typeEntityOfExpression(expr.initializer, scope);
        varEntity.typeEntity = typeEntity;
    } else {
        throw new Error(`Could not resolve type for ${expr.label}`);
    }
}

function scanImpl({ scope, instruction }: { scope: Scope; instruction: ImplDeclaration; }) {
    instruction.id = scope.add({ kind: "impl", flags: instruction.flags, label: instruction.target });
    const target = scope.resolveType(instruction.target) as TypeAliasEntity;
    instruction.functions.forEach(fn => scanFn(fn, target.instanceScope));
}

function scanFn(fn: FunctionDeclaration, scope: Scope) {
    const fnEntity = scope.get(fn.id!) as FunctionEntity;

    // Add the function to the target instanceScope
    scope.import([fn.id!]);

    if (fn.returnType) {
        const typeEntity = scope.resolveType(fn.returnType.label);
        fnEntity.returnTypeEntity = typeEntity as TypeEntity;
    }

    fn.parameters.forEach(p => {
        const pEntity = scope.get(p.id!) as ParameterEntity;
        if (p.type) {
            const typeEntity = scope.resolveType(p.type.label);
            if (!typeEntity) throw new Error(`Cannot resolve type for ${p.label} of ${fn.label}.`);
            pEntity.typeEntity = typeEntity as TypeEntity;
            return;
        }

        if (p.initializer) {
            const typeEntity = typeEntityOfExpression(p.initializer, scope);
            pEntity.typeEntity = typeEntity;
            return;
        }

        throw new Error(`Missing type for parameter ${p.label} of ${fn.label}`);
    });

    if (fn.expression) scanInstruction({ scope: fn.scope, instruction: fn.expression });

    if (!fn.returnType && fn.expression) {
        const typeEntity = typeEntityOfExpression(fn.expression, fn.scope);
        fnEntity.returnTypeEntity = typeEntity;
    } else if (!fn.returnType && !fn.expression) {
        throw new Error(`Missing return type for ${fnEntity.label}`);
    }
}

function scanIf({ dif, scope }: { dif: IfExpression; scope: Scope; }) {
    scanInstruction({ instruction: dif.condition, scope });
    scanBlock({ body: dif.body, scope: dif.scope });
    dif.elifs.forEach(({ condition, body, scope: elifScope }) => {
        scanInstruction({ instruction: condition, scope });
        scanBlock({ body, scope: elifScope });
    });
    if (dif.else) {
        scanBlock({ body: dif.else.body, scope: dif.else.scope });
    }
}

function typeEntityOfExpression(expr: Instruction, scope: Scope): TypeEntity {
    if (expr.kind === "identifier") {
        const entity = scope.get(expr.id!);
        if (!entity) throw new Error(`Unknown identifier ${expr.label}`);
        if (entity.kind === "type-alias") return entity;
        return ((entity as (ParameterEntity | VariableEntity)).typeEntity!);
    }

    if (expr.kind === "struct-literal") {
        return scope.get(expr.id!) as TypeEntity;
    }

    if (expr.kind === "block-expression") {
        return typeEntityOfExpression(expr.body[expr.body.length - 1], expr.scope);
    }

    if (expr.kind === "call-expression") {
        if (!expr.calleeId) throw new Error(`Function not yet resolved for ${expr.calleeLabel}`);
        const fnEntity = scope.get(expr.calleeId) as FunctionEntity;
        if (!fnEntity.returnTypeEntity) throw new Error(`Return type not yet resolved for ${fnEntity.label}`);
        return fnEntity.returnTypeEntity;
    }

    if (expr.kind === "binary-expression") {
        if (!expr.calleeId) throw new Error(`Function not yet resolved for ${expr.calleeLabel}`);
        const fnEntity = scope.get(expr.calleeId) as FunctionEntity;
        if (!fnEntity.returnTypeEntity) throw new Error(`Return type not yet resolved for ${fnEntity.label}`);
        return fnEntity.returnTypeEntity;
    }

    if (expr.kind === "if-expression") {
        return typeEntityOfExpression(expr.body[expr.body.length], scope);
    }

    if (expr.kind === "int-literal") {
        const i32Entity = scope.resolveType("i32");
        if (!i32Entity) throw new Error("Uh oh. i32 entity not found. Bad compiler! BAD!");
        return i32Entity as TypeEntity;
    }

    if (expr.kind === "property-access-expression") {
        return typeEntityOfExpression(expr.arguments[1], scope);
    }

    throw new Error(`Cannot determine type entity for ${expr.kind}`);
}
