import { ModuleInfo } from "../lib/module-info.mjs";
import {
  Bool,
  Expr,
  Float,
  FnType,
  Identifier,
  Int,
  isFloat,
  isIdentifier,
  isList,
  isStringLiteral,
  List,
  StringLiteral,
} from "../lib/syntax/index.mjs";
import { Var } from "../lib/syntax/lexical-context.mjs";

/** Transforms macro's into their final form and then runs them */
export const macro = (list: List, info: ModuleInfo): List => {
  if (!info.isRoot) return list;
  return evalExpr(list) as List;
};

const evalExpr = (expr: Expr) => {
  if (isFloat(expr)) return expr;
  if (isStringLiteral(expr)) return expr;
  if (isIdentifier(expr)) return expr.assertedResult();
  if (!isList(expr)) return expr;
  return evalFnCall(expr);
};

const evalFnCall = (list: List): Expr => {
  const identifier = list.first();
  if (!isIdentifier(identifier)) {
    return list;
  }

  const macro = getMacro(identifier);
  if (macro) {
    const expanded = expandMacro({ macro, call: list });
    // Expanded has its old definition as it's parent for whatever reason
    // Here we set it back to the correct parent (its original parent)
    // Hopefully not just a band-aid for a larger problem.
    expanded.setParent(list.getParent());
    return evalExpr(expanded);
  }

  const variable = identifier.getResult();
  if (!functions[identifier.value] && !isLambda(variable)) {
    return list;
  }

  const shouldSkipArgEval = fnsToSkipArgEval.has(identifier.value);

  const argsArr = !shouldSkipArgEval ? list.rest().map(evalExpr) : list.rest();
  const args = new List({ value: argsArr, parent: list.getParent() });

  if (isLambda(variable)) return callLambda({ lambda: variable, args });

  const func = functions[identifier.value];
  return func({ identifier, parent: list.getParent() ?? list }, args);
};

const expandMacros = (list: Expr): Expr => {
  if (!isList(list)) return list;

  const identifier = list.first();
  if (isIdentifier(identifier)) {
    const macro = getMacro(identifier);
    if (macro) return expandMacro({ macro, call: list });
  }

  return list.reduce(expandMacros);
};

/** Expands a macro call */
const expandMacro = ({ macro, call }: { macro: List; call: List }): Expr => {
  const params = (macro.at(0) as List).rest();
  params.forEach((p, index) => {
    const identifier = p as Identifier;
    if (identifier.value === "&body") {
      macro.setVar("&body", {
        kind: "param",
        value: new List({ value: call.rest() }),
      });
      return;
    }

    macro.setVar(identifier, { value: call.at(index + 1)!, kind: "param" });
  });
  const result = macro.rest().map((exp) => evalExpr(exp));
  return expandMacros(result.pop()!) ?? new List({});
};

type CallLambdaOpts = {
  lambda: List;
  args: List;
};

const callLambda = (opts: CallLambdaOpts): Expr => {
  const lambda = opts.lambda.rest();
  const params = lambda.at(0);
  const body = lambda.at(1);

  if (!body || !isList(params)) {
    throw new Error("Invalid lambda definition");
  }

  params.value.forEach((p, index) => {
    const identifier = p as Identifier;
    body.setVar(identifier, { value: opts.args.at(index)!, kind: "param" });
  });

  return evalExpr(body);
};

type FnOpts = {
  parent: Expr;
  identifier: Identifier;
};

// Ugly hack for forcing registerMacro to use the right scope. TODO something better I guess.
let currentModuleScope = new List({});
const functions: Record<string, (opts: FnOpts, args: List) => Expr> = {
  macro: (_, macro) => {
    const result = expandMacros(macro) as List;
    registerMacro(result, currentModuleScope);
    return nop();
  },
  root: ({ identifier }, root) => {
    root.insert(identifier);
    return root.map((module) => {
      if (!isList(module)) return module;
      currentModuleScope = module;
      module.value[4] = (module.value[4] as List).reduce(evalExpr);
      return module;
    });
  },
  block: (_, args) => args.at(-1)!,
  length: (_, array) => array.length,
  "define-mut": ({ parent }, args) =>
    defineVar({ args, parent, kind: "var", mut: true }),
  define: ({ parent }, args) => defineVar({ args, parent, kind: "var" }),
  "define-global": ({ identifier }, args) => args.insert(identifier),
  "define-mut-global": ({ identifier }, args) => args.insert(identifier),
  "define-macro-var": ({ parent }, args) =>
    defineVar({ args, parent, kind: "global" }),
  "define-mut-macro-var": ({ parent }, args) =>
    defineVar({ args, parent, kind: "global", mut: true }),
  // TODO: Support functions in macro expansion phase
  "define-function": ({ identifier }, args) => {
    return args.insert(identifier);
  },
  export: (_, args) => {
    const id = args.first() as Identifier;
    const fn = currentModuleScope.getFns(id)?.[0];
    const parent = currentModuleScope.getParent();
    if (fn && parent) {
      parent.setFn(id, fn);
    }
    return args.insert("export");
  },
  "=": ({ parent }, args) => {
    const identifier = args.first();
    if (!isIdentifier(identifier)) {
      throw new Error(`Expected identifier, got ${identifier}`);
    }

    const info = parent.getVar(identifier);
    if (!info) {
      throw new Error(`Identifier ${identifier.value} is not defined`);
    }

    if (!info.mut) {
      throw new Error(`Variable ${identifier} is not mutable`);
    }

    info.value = evalExpr(args.at(1)!);
    return new List({ parent });
  },
  "==": (_, args) => bl(args, (l, r) => l === r),
  ">": (_, args) => bl(args, (l, r) => l > r),
  ">=": (_, args) => bl(args, (l, r) => l >= r),
  "<": (_, args) => bl(args, (l, r) => l < r),
  "<=": (_, args) => bl(args, (l, r) => l <= r),
  and: (_, args) => bl(args, (l, r) => l && r),
  or: (_, args) => bl(args, (l, r) => l || r),
  not: (_, args) => bool(!args.first()?.value),
  "+": (_, args) => ba(args, (l, r) => l + r),
  "-": (_, args) => ba(args, (l, r) => l - r),
  "*": (_, args) => ba(args, (l, r) => l * r),
  "/": (_, args) => ba(args, (l, r) => l / r),
  "lambda-expr": (_, args) => {
    const params = args.first();
    const body = args.at(1);
    const lambda = args.insert("lambda-expr");

    if (!isList(params) || !body) {
      console.error(JSON.stringify(lambda, undefined, 2));
      throw new Error("invalid lambda expression");
    }

    lambda.setAsFn();

    // For now, assumes params are untyped
    params.map((p) => {
      if (!isIdentifier(p)) {
        console.error(JSON.stringify(p, undefined, 2));
        throw new Error("Invalid lambda parameter");
      }

      lambda.setVar(p, { kind: "var" });
      return p;
    });

    return lambda;
  },
  quote: (_, quote: List) => {
    const expand = (body: List): List =>
      body.reduce((exp) => {
        if (isList(exp) && exp.first()?.is("$")) {
          return evalExpr(new List({ value: exp.rest(), parent: body }));
        }

        if (isList(exp) && exp.first()?.is("$@")) {
          const rest = new List({ value: exp.rest(), parent: body });
          return (evalExpr(rest) as List).insert("splice-block");
        }

        if (isList(exp)) return expand(exp);

        if (isIdentifier(exp) && exp.value.startsWith("$@")) {
          const id = exp.value.replace("$@", "");
          const info = exp.getVar(id)!;
          const list = info.value as List;
          list.insert("splice-block");
          return list;
        }

        if (isIdentifier(exp) && exp.value.startsWith("$")) {
          const id = exp.value.replace("$", "");
          return exp.getVar(id)!.value!;
        }

        if (isIdentifier(exp) || isStringLiteral(exp)) {
          exp.value = exp.value.replace("\\", "");
          return exp;
        }

        return exp;
      });
    return expand(quote);
  },
  if: (_, args) => {
    const [condition, ifTrue, ifFalse] = args.value;

    if (!condition || !ifTrue) {
      console.log(JSON.stringify(args, undefined, 2));
      throw new Error("Invalid if expr");
    }

    const condResult = evalExpr(handleOptionalConditionParenthesis(condition));

    if (condResult.value) {
      return evalExpr(ifTrue);
    }

    if (ifFalse) {
      return evalExpr(ifFalse);
    }

    return nop();
  },
  array: (_, args) => args,
  slice: (_, args) => {
    const list = args.first()! as List;
    const start = args.at(1)?.value as number | undefined;
    const end = args.at(2)?.value as number | undefined;
    return list.slice(start, end);
  },
  extract: (_, args) => {
    const list = args.first()! as List;
    const index = args.at(1)!.value as number;
    return list.at(index)!; // TODO: Make this safer
  },
  map: ({ parent }, args) => {
    const list = args.first()! as List;
    const lambda = args.at(1)! as List;
    return list.map((val, index, array) =>
      callLambda({
        lambda,
        args: new List({
          value: [
            val,
            new Int({ value: index }),
            new List({ value: array, parent }),
          ],
          parent,
        }),
      })
    );
  },
  reduce: (_, args) => {
    const list = args.at(0)! as List;
    const start = args.at(1)!;
    const lambda = args.at(2)! as List;
    return list.value.reduce(
      (prev, cur, index, array) =>
        callLambda({
          lambda,
          args: new List({
            value: [
              prev,
              cur,
              new Float({ value: index }),
              new List({ value: array }),
            ],
          }),
        }),
      evalExpr(start)
    );
  },
  push: (_, args) => {
    const list = args.at(0) as List;
    const val = args.at(1)!;
    return list.push(val);
  },
  concat: (_, args) => {
    const list = args.first() as List;
    return list.push(...args.rest().flatMap((expr) => (expr as List).value));
  },
  "is-list": (_, args) => bool(isList(args.at(0))),
  log: (_, arg) => {
    console.error(JSON.stringify(arg.first(), undefined, 2));
    return arg;
  },
  split: ({ parent }, arg) => {
    const str = arg.at(0) as StringLiteral;
    const splitter = arg.at(0) as StringLiteral;
    return new List({ value: str.value.split(splitter.value), parent });
  },
  "macro-expand": (_, args) => expandMacros(args.at(0)!),
  "char-to-code": (_, args) =>
    new Int({
      value: String((args.at(0) as StringLiteral).value).charCodeAt(0),
    }),
  eval: (_, body) => evalFnCall(body),
  "register-macro": (_, args) => {
    registerMacro(args.at(0) as List, currentModuleScope);
    return nop();
  },
};

const fnsToSkipArgEval = new Set([
  "if",
  "quote",
  "lambda-expr",
  "root",
  "module",
  "macro",
  "splice-block",
  "define",
  "define-mut",
  "define-global",
  "define-mut-global",
  "define-function",
  "define-macro-var",
  "define-mut-macro-var",
  "=",
  "export",
]);

const handleOptionalConditionParenthesis = (expr: Expr): Expr => {
  if (isList(expr) && isList(expr.first())) {
    return expr.first()!;
  }

  return expr;
};

const isLambda = (expr?: Expr): expr is List => {
  if (!isList(expr)) return false;
  return expr.first()?.is("lambda-expr") ?? false;
};

/** Slice out the beginning macro before calling */
const registerMacro = (list: List, parent: Expr) => {
  const id = (list.first() as List).first() as Identifier;
  const fn = new FnType({ value: { params: [] } });
  list.setAsFn();
  fn.flags.add("isMacro");
  fn.props.set("body", list);
  parent.setFn(id.value, fn);
};

const nop = () => new List({}).push(Identifier.from("splice-block"));
/** Binary logical comparison */
const bl = (args: List, fn: (l: any, r: any) => boolean) =>
  bool(fn(args.at(0)?.value, args.at(1)?.value));
/** Binary arithmetic operation */
const ba = (args: List, fn: (l: any, r: any) => number) =>
  new Float({ value: fn(args.at(0)?.value, args.at(1)?.value) });
const bool = (b: boolean) => new Bool({ value: b });

const getMacro = (id: Identifier): List | undefined => {
  const fn = id.getFns(id)?.[0];
  if (!fn?.flags.has("isMacro")) return;
  return fn.props.get("body") as List;
};

const defineVar = (opts: {
  args: List;
  parent: Expr;
  kind: Var["kind"];
  mut?: boolean;
}) => {
  const { args, parent, kind, mut } = opts;
  // Warning: Cannot be typed like would be at compile time (for now);
  const identifier = args.at(0);
  const init = args.at(1);
  if (!isIdentifier(identifier) || !init) {
    throw new Error("Invalid variable");
  }
  identifier.binding = init;
  const value = evalExpr(init);
  parent.setVar(identifier, { kind, mut, value });
  return nop();
};
