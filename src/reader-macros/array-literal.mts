import { ReaderMacro } from "./types.mjs";

export const arrayLiteralMacro: ReaderMacro = {
  tag: "[",
  macro: (file, { reader }) => {
    const items = reader(file, "]");
    return items.insert("array").insert(",", 1);
  },
};
