import { registerModules } from "./modules.js";
import { expandRegularMacros } from "./regular-macros.js";
import { typeCheck } from "./semantics/index.js";
import binaryen from "binaryen";
import { genWasmCode } from "./wasm-code-gen.js";
import {
  ParsedModule,
  parseModuleFromSrc,
  parseModule,
} from "./parser/index.js";

export const compileText = async (text: string) => {
  const parsedModule = await parseModule(text);
  return compileParsedModule(parsedModule);
};

export const compilePath = async (path: string) => {
  const parsedModule = await parseModuleFromSrc(path);
  return compileParsedModule(parsedModule);
};

export const compileParsedModule = (module: ParsedModule): binaryen.Module => {
  const moduleResolvedModule = registerModules(module);
  const regularMacroExpandedModule = expandRegularMacros(moduleResolvedModule);
  const typeCheckedModule = typeCheck(regularMacroExpandedModule);
  return genWasmCode(typeCheckedModule);
};
