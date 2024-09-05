import { Expr } from "../../../syntax-objects/expr.js";
import { SourceLocation } from "../../../syntax-objects/syntax.js";
import { CharStream } from "../../char-stream.js";

interface ASTNode {
  type: string;
  tagName?: string;
  attributes?: Record<string, (string | Expr)[]>;
  children?: (ASTNode | Expr)[];
  selfClosing?: boolean;
  content?: string | (string | Expr)[];
  location?: SourceLocation;
}

interface ParseOptions {
  onUnescapedCurlyBrace: (stream: CharStream) => Expr | undefined;
}

export class HTMLParser {
  private stream: CharStream;
  private options: ParseOptions;

  constructor(stream: CharStream, options: ParseOptions) {
    this.stream = stream;
    this.options = options;
  }

  parse(startElement?: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const node = this.parseNode(startElement);
    if (node) {
      nodes.push(node);
    }
    return nodes;
  }

  private parseNode(startElement?: string): ASTNode | null {
    if (startElement) {
      return this.parseElement(startElement);
    }

    this.consumeWhitespace();
    if (this.stream.next === "<") {
      return this.parseElement();
    } else {
      return this.parseText();
    }
  }

  private parseElement(startElement?: string): ASTNode | null {
    if (!startElement && this.stream.consumeChar() !== "<") return null;

    const tagName = startElement ?? this.parseTagName();
    const attributes = this.parseAttributes();
    const selfClosing = this.stream.next === "/";

    if (selfClosing) {
      this.stream.consumeChar(); // Consume '/'
    }

    if (this.stream.consumeChar() !== ">") {
      throw new Error("Malformed tag");
    }

    const elementNode: ASTNode = {
      type: "element",
      tagName,
      attributes,
      selfClosing,
      location: this.stream.currentSourceLocation(),
    };

    if (!selfClosing) {
      elementNode.children = this.parseChildren(tagName);
    }

    return elementNode;
  }

  private parseTagName(): string {
    let tagName = "";
    while (/[a-zA-Z0-9]/.test(this.stream.next)) {
      tagName += this.stream.consumeChar();
    }
    return tagName;
  }

  private parseAttributes(): Record<string, (string | Expr)[]> {
    const attributes: Record<string, (string | Expr)[]> = {};
    while (this.stream.next !== ">" && this.stream.next !== "/") {
      this.consumeWhitespace();
      const name = this.parseAttributeName();
      if (this.stream.next === "=") {
        this.stream.consumeChar(); // Consume '='
        const value = this.parseAttributeValue();
        attributes[name] = value;
      } else {
        attributes[name] = [""];
      }
      this.consumeWhitespace();
    }
    return attributes;
  }

  private parseAttributeName(): string {
    let name = "";
    while (/[a-zA-Z0-9-]/.test(this.stream.next)) {
      name += this.stream.consumeChar();
    }
    return name;
  }

  private parseAttributeValue(): (string | Expr)[] {
    const quote = this.stream.next;
    if (quote !== '"' && quote !== "'") {
      throw new Error("Attribute value must be quoted");
    }

    this.stream.consumeChar(); // Consume the opening quote

    const value: (string | Expr)[] = [];
    let text = "";
    while (this.stream.next !== quote) {
      if (this.stream.next === "{") {
        if (text) value.push(text);
        text = "";
        const expr = this.options.onUnescapedCurlyBrace(this.stream);
        if (expr) value.push(expr);
      }

      text += this.stream.consumeChar();
    }

    value.push(text);
    this.stream.consumeChar(); // Consume the closing quote
    return value;
  }

  private parseChildren(tagName: string): (ASTNode | Expr)[] {
    this.consumeWhitespace();
    const children: (ASTNode | Expr)[] = [];
    while (
      this.stream.hasCharacters &&
      !(this.stream.at(0) === `<` && this.stream.at(1) === `/`)
    ) {
      if (this.stream.next === "{") {
        const expr = this.options.onUnescapedCurlyBrace(this.stream);
        if (expr) children.push(expr);
        this.consumeWhitespace();
        continue;
      }

      const node = this.parseNode();
      if (node) {
        children.push(node);
      }

      this.consumeWhitespace();
    }

    if (this.stream.hasCharacters && this.stream.next === `<`) {
      this.stream.consumeChar(); // Consume '<'
      if (this.stream.consumeChar() !== "/") {
        throw new Error(`Expected closing tag </${tagName}>`);
      }
      const closingTagName = this.parseTagName();
      if (closingTagName !== tagName) {
        throw new Error(
          `Mismatched closing tag, expected </${tagName}> but got </${closingTagName}>`
        );
      }
      if (this.stream.consumeChar() !== ">") {
        throw new Error("Malformed closing tag");
      }
    }

    return children;
  }

  private parseText(): ASTNode {
    const node = {
      type: "text",
      content: [] as (string | Expr)[],
      location: this.stream.currentSourceLocation(),
    };

    let text = "";
    while (this.stream.hasCharacters && this.stream.next !== "<") {
      if (this.stream.next === "{") {
        if (text) node.content.push(text);
        text = "";
        const expr = this.options.onUnescapedCurlyBrace(this.stream);
        if (expr) node.content.push(expr);
      }

      text += this.stream.consumeChar();
    }

    if (text) node.content.push(text);
    node.location.endColumn = this.stream.column;
    node.location.endIndex = this.stream.position;
    return node;
  }

  private consumeWhitespace(): void {
    while (/\s/.test(this.stream.next)) {
      this.stream.consumeChar();
    }
  }
}
