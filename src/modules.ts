import { ParsedModule, stdPath } from "./parser/index.js";
import { List } from "./syntax-objects/list.js";
import { VoidModule } from "./syntax-objects/module.js";

/** Registers submodules of a parsed module for future import resolution */
export const registerModules = (opts: ParsedModule): VoidModule => {
  const { srcPath, files } = opts;

  const rootModule = new VoidModule({ name: "root" });

  for (const [filePath, file] of Object.entries(files)) {
    const resolvedPath = filePathToModulePath(
      filePath,
      srcPath ?? opts.indexPath
    );

    const parsedPath = resolvedPath.split("/").filter(Boolean);

    registerModule({
      path: parsedPath,
      parentModule: rootModule,
      ast: file.slice(1), // Skip the first element (ast)
      isIndex: filePath === opts.indexPath,
    });
  }

  return rootModule;
};

const registerModule = ({
  path,
  parentModule,
  ast,
  isIndex,
}: {
  path: string[];
  parentModule: VoidModule;
  ast: List;
  isIndex?: boolean;
}): VoidModule | undefined => {
  const [name, ...rest] = path;

  if (!name) return;

  const existingModule = parentModule.resolveChildEntity(name);

  if (existingModule && !existingModule.isModule()) {
    throw new Error(
      `Cannot register module ${name} because it is already registered as ${existingModule.syntaxType}`
    );
  }

  if (!existingModule && name === "index") {
    parentModule.push(...ast.toArray());
    return;
  }

  const module =
    existingModule ??
    new VoidModule({
      ...(!rest.length ? { ...ast.metadata, value: ast.toArray() } : {}),
      name,
      isIndex,
    });
  module.isExported = true;

  if (!existingModule) parentModule.push(module);

  if (!rest.length) return;

  return registerModule({ path: rest, parentModule: module, ast });
};

const filePathToModulePath = (filePath: string, srcPath: string) => {
  let finalPath = filePath.startsWith(stdPath)
    ? filePath.replace(stdPath, "std")
    : filePath;

  finalPath = finalPath.startsWith(srcPath)
    ? finalPath.replace(srcPath, "src")
    : finalPath;

  finalPath = finalPath.replace(".void", "");

  return finalPath;
};
