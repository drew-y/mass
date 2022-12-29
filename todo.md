- Unsafe macros (As add unsafe macro and check safety macros that do a form of "unsafe" checking
  i.e. rust)
- Fix bug in modules where I can't run syntax macros directly on files within std
- Write up a layout spec defining exactly how parenthetical elision works
- Hygienic macros
- Consider making $() a block, rather than assuming a function call
- Develop and apply strict naming conventions for all APIs
- Develop best practices
- `def` macro like https://docs.racket-lang.org/guide/syntax-overview.html#%28part._.Definitions%29
- Adopt some conventions from https://docs.racket-lang.org/style/Textual_Matters.html like `!` and
  `?` conventions
- Flags for outputting AST and WAT
- Use tabstops (the thing that handles tab based comment alignment etc)
- Support struct field assignment via `=` operator
- Check mutability of struct before allowing modification (&mut semantics?)
- replace `quote splice-block` with `quote-splice` or something similar.
- Improve macro expansion algorithm so macros like `var` and `let` don't need to call
  `macro-expand`. Outside of `pub`, I don't believe any macro should need to call that function
  unless they need to extract info post expansion like `pub` does.
  https://stackoverflow.com/questions/72865649/how-does-macroexpansion-actually-work-in-lisp
- Rewrite reference manual.
- Consider using the struct syntax to define named arguments. See
  `archived-reference/functions.md#NamedArguments` for inspiration.
- Scoping. For macro expansion and compile time. Probably need a semantic analysis phase in general.
  Without this type-ids for structs are broken
- De-allocate allocated memory inside of blocks.
- Cleanup pass
  - Make typing of variables, functions and parameters much more clear and consistent, both
    at the `define-function` header level and body level.
  - Make spread of define-function, fn and lambda more consistent. They use a mix of either the last
    is a single expr, or a bunch of expressions
- Reference Types (Boxes? / Mutable Borrows? / GC? / Ownership?)
- Test sub tuple init and assignment
- Copy CDTs on assignment
- Anonymous struct literals
- Erlang like atoms for to facilitate optionals and other union data types that may not need associated data.
- Optional parameters and default parameter values.
- Simplify function selection for code gen phase
  - Make type system remove labels from parameters on call and definition sites. (In type system)
  - Create new ID's for functions with multiple overloads (In type system)
  - Transform struct / match parameters on call and definition to normal parameters. (In type system)
  - Remove label matching from code gen.
- Pre type system phase IR spec.
- Fix parameter outputs for exports and extern-functions
- Fix issue marked with the comment `// TODO: This doesn't work when expr is a labeled-expr`
- Create an actual list type that extends Array and allows us to attach metadata. Use in place of AST.
-
