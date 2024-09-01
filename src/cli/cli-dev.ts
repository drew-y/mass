#!/usr/bin/env tsx
import { exec } from "./exec.js";

/**
 * NOTE:
 * This file is the same as cli.js, but is run with ts-node.
 * I've found tsc -w to be buggy when changing git branches,
 * so this lets me bypass the compiler.
 */

exec();
