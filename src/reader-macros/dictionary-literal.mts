import { Identifier, isList, List } from "../lib/index.mjs";
import { ReaderMacro } from "./types.mjs";

export const dictionaryLiteralMacro: ReaderMacro = {
  tag: "#{",
  macro: (file, { reader }) => {
    const dict = new Identifier({ value: "dict" });
    const items = reader(file, "}");
    if (isList(items)) return items.insert(dict);
    return new List({ value: [dict, items] });
  },
};
