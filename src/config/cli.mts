import { ParseArgsConfig, parseArgs } from "node:util";
import { VoidConfig } from "./types.mjs";

const options: ParseArgsConfig["options"] = {
  "emit-parser-ast": {
    type: "boolean",
  },
  "emit-de-sugared-ast": {
    type: "boolean",
  },
  "emit-syntax-ast": {
    type: "boolean",
  },
  "emit-wasm": {
    type: "boolean",
  },
  "emit-wasm-text": {
    type: "boolean",
  },
  /** Tells binaryen to run its standard optimization pass */
  "bin-opt": {
    type: "boolean",
  },
  run: {
    type: "boolean",
    short: "r",
  },
  help: {
    type: "boolean",
    short: "h",
  },
  version: {
    type: "boolean",
    short: "v",
  },
};

export const getConfigFromCli = (): VoidConfig => {
  const { values, positionals } = parseArgs({
    options,
    allowPositionals: true,
  });
  const index = positionals[0];
  if (typeof index !== "string") {
    throw new Error("Expected void entry file path");
  }

  return {
    index,
    emitParserAst: values["emit-parser-ast"] as boolean,
    emitDeSugaredAst: values["emit-de-sugared-ast"] as boolean,
    emitSyntaxAst: values["emit-syntax-ast"] as boolean,
    emitWasm: values["emit-wasm"] as boolean,
    emitWasmText: values["emit-wasm-text"] as boolean,
    runBinaryenOptimizationPass: values["bin-opt"] as boolean,
    showHelp: values["help"] as boolean,
    showVersion: values["version"] as boolean,
    run: values["run"] as boolean,
  };
};
