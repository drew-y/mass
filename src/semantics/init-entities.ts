import { Declaration } from "../syntax-objects/declaration.js";
import {
  List,
  Fn,
  Parameter,
  Expr,
  Variable,
  Call,
  Block,
  TypeAlias,
  ObjectType,
  ObjectLiteral,
  Identifier,
} from "../syntax-objects/index.js";
import { Match, MatchCase } from "../syntax-objects/match.js";
import { getExprType } from "./resolution/get-expr-type.js";
import { resolveTypes } from "./resolution/resolve-types.js";
import { SemanticProcessor } from "./types.js";

export const initEntities: SemanticProcessor = (expr) => {
  if (expr.isModule()) {
    return expr.applyMap(initEntities);
  }

  if (!expr.isList()) return expr;

  if (expr.calls("define_function")) {
    return initFn(expr);
  }

  if (expr.calls("define") || expr.calls("define_mut")) {
    return initVar(expr);
  }

  if (expr.calls("block")) {
    return initBlock(expr);
  }

  if (expr.calls("declare")) {
    return initDeclaration(expr);
  }

  if (expr.calls("type")) {
    return initTypeAlias(expr);
  }

  // Object literal
  if (expr.calls("object")) {
    return initObjectLiteral(expr);
  }

  // Nominal object definition
  if (expr.calls("obj")) {
    return initNominalObjectType(expr);
  }

  if (expr.calls("match")) {
    return initMatch(expr);
  }

  return initCall(expr);
};

const initBlock = (block: List): Block => {
  return new Block({ ...block.metadata, body: block.slice(1) }).applyMap(
    initEntities
  );
};

const initFn = (expr: List): Fn => {
  const name = expr.identifierAt(1);
  const parameters = expr
    .listAt(2)
    .sliceAsArray(1)
    .flatMap((p) => listToParameter(p as List));
  const returnTypeExpr = getReturnTypeExprForFn(expr, 3);

  const fn = new Fn({
    name,
    returnTypeExpr: returnTypeExpr,
    parameters,
    ...expr.metadata,
  });

  const body = expr.at(4);

  if (body) {
    body.parent = fn;
    fn.body = initEntities(body);
  }

  return fn;
};

const listToParameter = (
  list: List,
  labeled = false
): Parameter | Parameter[] => {
  // TODO check for separate external label [: at [: n i32]]
  if (list.identifierAt(0).is(":")) {
    const name = list.identifierAt(1);
    return new Parameter({
      ...list.metadata,
      name,
      typeExpr: initTypeExprEntities(list.at(2)),
      label: labeled ? name : undefined,
    });
  }

  if (list.identifierAt(0).is("object")) {
    return list.sliceAsArray(1).flatMap((e) => listToParameter(e as List));
  }

  throw new Error("Invalid parameter");
};

const getReturnTypeExprForFn = (fn: List, index: number): Expr | undefined => {
  const returnDec = fn.at(index);
  if (!returnDec?.isList()) return undefined;
  if (!returnDec.calls("return_type")) return undefined;
  return initTypeExprEntities(returnDec.at(1));
};

const initObjectLiteral = (obj: List) => {
  return new ObjectLiteral({
    ...obj.metadata,
    fields: obj.sliceAsArray(1).map((f) => {
      if (!f.isList()) {
        throw new Error("Invalid object field");
      }
      const name = f.identifierAt(1);
      const initializer = f.at(2);

      if (!name || !initializer) {
        throw new Error("Invalid object field");
      }

      return { name: name.value, initializer: initEntities(initializer) };
    }),
  });
};

const initVar = (varDef: List): Variable => {
  const isMutable = varDef.calls("define_mut");
  const identifierExpr = varDef.at(1);
  const [name, typeExpr] =
    identifierExpr?.isList() && identifierExpr.calls(":")
      ? [identifierExpr.identifierAt(1), identifierExpr.at(2)]
      : identifierExpr?.isIdentifier()
      ? [identifierExpr]
      : [];

  if (!name) {
    throw new Error("Invalid variable definition, invalid identifier");
  }

  const initializer = varDef.at(2);

  if (!initializer) {
    throw new Error("Invalid variable definition, missing initializer");
  }

  return new Variable({
    ...varDef.metadata,
    name,
    typeExpr: initTypeExprEntities(typeExpr),
    initializer: initEntities(initializer),
    isMutable,
  });
};

const initDeclaration = (decl: List) => {
  const namespaceString = decl.at(1);

  if (!namespaceString?.isStringLiteral()) {
    throw new Error("Expected namespace string");
  }

  const fns = decl
    .listAt(2)
    .sliceAsArray(1)
    .map(initEntities)
    .filter((e) => e.isFn()) as Fn[];

  return new Declaration({
    ...decl.metadata,
    namespace: namespaceString.value,
    fns,
  });
};

const initTypeAlias = (type: List) => {
  const assignment = type.listAt(1);
  const name = assignment.identifierAt(1);
  const typeExpr = initTypeExprEntities(assignment.at(2));

  if (!name || !typeExpr) {
    throw new Error(`Invalid type alias ${type.location}`);
  }

  if (typeExpr.isType()) {
    typeExpr.setName(name.value);
  }

  return new TypeAlias({ ...type.metadata, name, typeExpr });
};

const initCall = (call: List) => {
  if (!call.length) {
    throw new Error("Invalid fn call");
  }

  const fnName = call.at(0);
  if (!fnName?.isIdentifier()) {
    throw new Error("Invalid fn call");
  }

  const args = call.slice(1).map(initEntities);
  return new Call({ ...call.metadata, fnName, args });
};

const initTypeExprEntities = (type?: Expr): Expr | undefined => {
  if (!type) return undefined;

  if (type.isIdentifier()) {
    return type;
  }

  if (type.isType()) {
    return type;
  }

  if (!type.isList()) {
    console.log(JSON.stringify(type, undefined, 2));
    throw new Error("Invalid type entity");
  }

  if (type.calls("object")) {
    return initObjectType(type);
  }

  throw new Error("Invalid type entity");
};

const initNominalObjectType = (obj: List) => {
  const hasExtension = obj.optionalIdentifierAt(2)?.is("extends");
  return new ObjectType({
    ...obj.metadata,
    name: obj.identifierAt(1),
    parentObjExpr: hasExtension ? obj.at(3) : undefined,
    value: extractObjectFields(hasExtension ? obj.listAt(4) : obj.listAt(2)),
  });
};

const initObjectType = (obj: List) => {
  return new ObjectType({
    ...obj.metadata,
    name: obj.syntaxId.toString(),
    value: extractObjectFields(obj),
  });
};

export const initMatch = (match: List): Match => {
  const operand = initEntities(match.exprAt(1));
  const arg1 = match.at(2);
  const identifierIndex = arg1?.isIdentifier() ? 2 : 1;
  const identifier = match.identifierAt(identifierIndex);
  const caseExprs = initEntities(match.exprAt(identifierIndex + 1));

  if (!caseExprs?.isBlock()) {
    throw new Error(`Match cases must be in a block at ${caseExprs?.location}`);
  }

  const cases = initMatchCases(caseExprs);

  return new Match({
    ...match.metadata,
    operand,
    cases: cases.cases,
    defaultCase: cases.defaultCase,
    bindIdentifier: identifier,
    bindVariable:
      identifierIndex === 1
        ? new Variable({
            name: identifier,
            location: identifier.location,
            initializer: operand,
            isMutable: false,
          })
        : undefined,
  });
};

const initMatchCases = (
  block: Block
): { cases: MatchCase[]; defaultCase?: MatchCase } => {
  return block.body.toArray().reduce(
    ({ cases, defaultCase }, expr) => {
      if (!expr.isList() || !(expr.calls("=>") || expr.calls("else"))) {
        throw new Error(
          `Match cases must be in the form of => at ${expr.location}`
        );
      }

      const index = expr.calls("else") ? 1 : 2;
      const typeExpr = initEntities(expr.exprAt(index));
      const caseExpr = initEntities(expr.exprAt(index));
      const scopedCaseExpr =
        caseExpr?.isCall() || caseExpr?.isBlock()
          ? caseExpr
          : new Block({ ...caseExpr.metadata, body: [caseExpr] });

      const mCase = { matchTypeExpr: typeExpr, expr: scopedCaseExpr };

      if (expr.calls("else")) {
        return { cases, defaultCase: mCase };
      }

      return { cases: [...cases, mCase], defaultCase };
    },
    {
      cases: [] as MatchCase[],
      defaultCase: undefined as MatchCase | undefined,
    }
  );
};

const extractObjectFields = (obj: List) => {
  return obj.sliceAsArray(1).map((v) => {
    if (!v.isList()) {
      throw new Error("Invalid object field");
    }
    const name = v.identifierAt(1);
    const typeExpr = initTypeExprEntities(v.at(2));

    if (!name || !typeExpr) {
      throw new Error("Invalid object field");
    }

    return { name: name.value, typeExpr };
  });
};
