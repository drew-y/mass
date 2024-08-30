import { describe, it } from "node:test";
import { e2eVoidText } from "./fixtures/e2e-file.js";
import { compile } from "../compiler.js";
import { strict as assert } from "node:assert";

describe("Compiler: E2E", () => {
  it("Can compile and run a basic void file", async () => {
    const mod = await compile(e2eVoidText);
    const bin = mod.emitBinary();
    const compiled = new WebAssembly.Module(bin);
    const instance = new WebAssembly.Instance(compiled);

    const fn =
      typeof instance.exports.main === "function"
        ? instance.exports.main
        : undefined;

    assert(fn, "Function exists");
    assert.equal(fn(), 55, "Main function returns correct value");
  });
});