
# Comments

```
// Single line
/* Multi-Line */
```

# Types
```
true // Boolean
false // Boolean
1 // Int
1.0 // Double
"Hello!" // String, can be multiline, supports interpolation via ${}
(1, 2, 3) // Tuple
[x: 2, y: 4] // Anonymous struct
$(1, 2, 3) // Array
$[x: 3] // Dictionary
```

# Variables

```
// An immutable variable is defined using the let keyword
let x = 5

// A mutable variable is defined using the var keyword
var y = 3
```

# Blocks

Blocks are a group of expressions enclosed in `{}`. Blocks return the result of the
last expression they hold.

```
let twenty = {
    let a = 5
    let b = 4
    a * b
}
```

# Control flow

```
if 3 > val {

} else if 3 < val {

} else {

}

for item in iterable {

}

while condition {

}

let x = 3
match x {
    1 => print("One"),
    2 => print("two"),
    3 => print("three"),
    _ => {
        // Match statements must cover every possible case.
        // _ means default. I.E. if no other patterns match, use this one.
        print("A number")
    }
}
```

# Functions

```
// A basic function
fn add(a: i32, b: i32) -> i32 = {
    a + b
}

// In most cases, the return type can be inferred.
fn add(a: i32, b: i32) = {
    a + b
}

// Functions are called using the standard () syntax
add(1, 2)

// Single expression functions can omit the {}
fn add(a: i32, b: i32) = a + b
```

# Expression Oriented

Dream is an expression oriented language. Blocks, Ifs, and Matches all return a value, that is
the result of the last expression in their group. Functions will also implicitly return the
value of the last expression in their body (Unless it's return type is explicitly set to Void).

Examples:
```
let four = {
    let a = 2
    let b = 2
    a * b
}

let three = if true { 3 } else { 4 }

let fred = match "Smith" {
    "Jobs" => "Steve",
    "Smith" => "Fred",
    "Gates" => "Bill"
}

fn work(a: Int) = {
    let b = a * 2
    b + 3
}

let five = work(1)
```

# Structs

```
struct Target {
    let x, y, z: Int
}

let target = Target [x: 4, y: 5, z: 3]

// Anonymous struct.
let point = [x: 5, y: 3]

// Destructuring
let [x, y] = point;
log(x) // 5
log(y) // 3

// If an identifier has the same name as a struct field, the field label can be omitted.
let x = 5
let dot = [x] // Equivalent to [x: x]
```

## Struct Methods

```
// Methods can be added directly to a struct
struct Target {
    pub var x, y, z: Int

    pub fn offs [x: Int] -> Target =
        // Self can be omitted if the identifier does not conflict with a parameter.
        // Here y and z have self omitted. In addition we are using struct shorthand for
        // y and z
        Target [x: self.x + x, y, z] // Equivalent to [x: self.x + x, y: self.y, z: self.z]
}

// Methods can also be added to structs through impl blocks.
impl Target {
    // If a method modifies it's struct, it must be marked as mut
    mut fn shift [x: Int] -> Void = {
        self.x += x
    }
}

const target = Target [x: 5, y: 3, z: 7]
target.shift [x: 5]
```

## Computed Properties

```
struct Planet {
    var radius = 5000

    /** Computed property with getter and setter */
    prop diameter {
        get => radius * 2
        set(v: Int) => radius = v / 2
    }

    /** Readonly computed property */
    prop surfaceArea {
        get => 4 * PI * radius.sq
    }

    /** Shorthand readonly computed property */
    prop circumference = 2 * PI * radius

    /**
     * Prop with a default getter and private default setter. This is essentially
     * making a var field that can only be set privately
     */
    prop mass: Int { get, private set }
}
```

## Static Methods

Static methods can be added to a struct, or any other type, by augmenting their namespace.
```
namespace Target {
    fn from(tuple: (Int, Int, Int)) = Target [
        x: tuple.0,
        y: tuple.1,
        z: tuple.2,
    ]
}
```

Static constants can be added this way too.

# Enums

```
enum Friend {
    case eric,
    case angie,
    case carter
}

var friend = Friend.eric

match friend {
    .eric => (),
    .angie => ()
    .carter => ()
}

// Enum identifier can be omitted if it can be reasonable inferred.
let bestFriend: Friend = .angie

// Enums can have associated types
enum ValidID {
    // Struct associated type
    case driversLicense [name: String, no: String, issued: Date, exp: Date]
    case studentID(Int)
}
```

# Traits

```
trait Vehicle {
    // Readonly property
    prop vin: String { get }

    // Property can be read and set.
    prop color: String { get, set }

    // Implementors must define this method
    fn start() -> Void

    // Traits can define default implementations of their method requirements
    fn getInfo() = "Vin: ${vin}, Color: ${color}"
}

struct Car {
    var started = false
    pub let vin: String
    pub var color: String
}

impl Vehicle for Car {
    fn start() =
        started = true
}

let car = Car [vin: "12fda32213", color: "red"]
car.start()
car.getInfo()
```

# Closures

Closures are functions that can capture values of the scope they were defined in.

Closures are defined using the syntax `{ (...params) -> ReturnType => body }`

```
// Basic closure
let add = { (a: Int, b: Int) -> Int => a + b }

// Return types can almost always be inferred. So it's better to leave their annotation out.
let add = { (a: Int, b: Int) => a + b }

// If the closure has only one expression, the {} can be omitted
let add = (a: Int, b: Int) => a + b

// In cases where the closure is passed to an already annotated value (such as a parameter
// or annotated variable)
let add: Fn(a: Int, b: Int) -> Int = (a, b) => a + b

// If a closure has no parameters the () can be omitted.
let doIt = => doWork()

// Additionally, () can be left out when a closure is wrapped in a block
let add = { a: Int, b: Int => a + b }
```

## Higher Order Functions

```
// You can pass functions as parameters to methods or other functions
fn caller(cb: Fn(a: i32, b: i32) -> i32) -> i32 {
    cb(1, 2)
}

let add = { a: Int, b: Int => a + b }
caller(add)

// Or
caller({ a, b => a + b })

// Or
caller((a, b) => a + b)
```

## Trailing Closure Syntax

Dream supports swift-like trailing closure syntax. Trailing closures must always
be wrapped in {}.

```
caller() { a, b => a + b }

// Since the closure is the last parameter of caller, () can be omitted.
caller { a, b => a + b }

// If a trailing closure has no parameters, => can be omitted. Note: this is only
// true for TRAILING closures
fn callThis(func: Fn() -> Void) = func()

callThis {
    doWork()
}
```

# Generics

Generics work much like they do in TypeScript or Swift with essentially the same syntax.
```
fn add<T>(a: T, b: T) -> T {
    a + b
}

struct Target<T> {
    let x, y, z: T
}
```

The one exception (for now) is when a generic type parameter needs to be explicitly defined in an
expression. In such a case, the type parameters must be prefixed with a `:`. For example:
```
fn add<T>(a: T, b: T) = a + b

add::<i32>()
```

# Macros

Dream supports macros that adhere to "Macro By Example". They work in a similar manner to
[rust macros](https://doc.rust-lang.org/1.7.0/book/macros.html).

# Compiler directives

Compiler directives are each prefixed with a `#` and can have additional arguments supplied
in the form of an anonymous struct

```
#inline
#deprecated[since: "3.0"]
fn add(a: i32, b: i32) -> i32 {

}
```

# Defining Types

Types can be aliased / defined using using the syntax: `type Identifier = Type`.

Examples:
```
type Int = i32
type MyTuple = (i32, String, f32)
type MyStruct = [a: i32, b: i32]

type MyNativeMultiValType = wasm_multi_val_type!(i32, i32, i32)
type MyOtherCustomType = wasm_val_type!(i32)

// Types can have namespaces, impls, and conform to traits
impl MyOtherCustomType {
    fn +(l: i32, r: i32) = unsafe {
        wasm_i32_add()
    }
}
```

# Uniform Function Call Syntax.

Dream supports UFCS. https://en.wikipedia.org/wiki/Uniform_Function_Call_Syntax

Examples
```
fn add(a: i32, b: i32) -> i32 = a + b

1.add(2)

fn double(a: i32) -> i32 = a * 2

add(2, 4).double()

add(2, 4).double
```

This applies to some primitive control flow operations as well.

Examples
```
let x = false
x.if {
    do_work()
}

let test = "test"
test.match {
    "hello" => print("world"),
    "test" => print("complete"),
    _ => print("unknown")
}

var a = true
a.while {
    do_work()
}
```

# Memory Management

1. Dream uses the standard WASM garbage collector for Struct, Enum, and Tuple types.
2. Primitive WASM types such as i32, f32, i64, etc are allocated on the stack and are
   not garbage collected.
3. All types are value types
4. For a type to be passed by reference to a function or a closure, it must be a garbage collected
   type.

## Value Types

Dream types are value types. This means when some variable `a` is assigned to some variable
`b`, `a` is copied into `b`. As a result, changes made to `b` do not happen to `a` and vise versa.

This is in contrast to reference types used in other languages. For example, in javascript,
an object is a reference type:
```javascript
let a = { x: 3 };
let b = a;
b.x = 7;
print(a.x) // 7
```

The in Dream, a would not have been affected
```dream
let a = [x: 3]
let b = a
b.x = 7
print(a.x) // 3
```

## References

It is still possible to create a mutable reference to a value in dream. Currently this can
be done using closures (anonymous functions) or inout parameters. Note, this only applies to
garbage collected type.

**Inout Parameters**

Inout parameters create a mutable reference to a given variable. Changes made to an inout parameter
within a function are reflected in their original variable.

Example:
```dream
var count: Int = 0;

fn bump(val: inout Int) = {
    val += 1
}

print(count) // 0

// The & is required and makes it clear count is being referenced
bump(&count)

// Note: Inout parameters must refer to a mutable variable.
let count2 = 0
bump(&count2) // This will throw an error.
```

**Closures**

Closures can refer to and modify values within their scope.

Example:
```dream
fn createCounter() = {
    var count = 0
    { =>
        count += 1
        count
    }
}

let counter = createCounter()
print(counter()) // 1
print(counter()) // 2
print(counter()) // 3
```

# Functions In Depth

Functions have some additional features and conveniences that are laid out in this section.

## Struct Sugar Syntax

```
// Structs can be destructed in the method signature.
fn add([x, y]: [x: Int, y: Int]) -> Int {
    x + y
}

// This can be shortened further, unlabeled structs are automatically destructed.
fn add([x: Int, y: Int]) -> Int {
    x + y
}

// If a struct is the only argument of a method, parenthesis can be omitted.
fn add[x: Int, y: Int] -> Int {
    x + y
}

add([x: 5, y: 3])

// If a struct is the only argument or the second argument is a function (more on that later),
// the parenthesis can be omitted on call as well.
add[x: 5, y: 3]
```

## Pure Functions

```
// Pure functions are marked with a "pure" attribute and can only call other pure functions.
// They also cannot have side effects.
pure fn mul(a: i32, b: i32) = a * b

pure fn div(a: i32, b: i32) {
    // This will throw an error, as print has side effects and isn't marked pure.
    print(a)
    a / b
}
```

## Parameter-less Functions

It is possible to define a function that takes no parameters and is called without ().

```
fn anyNum = random()

print(anyNum) // 7
print(anyNum) // 2341
print(anyNum) // 562
```

It is best practice to define these functions as pure and add a comment if they are computationally
intensive
```
// This function is O(n!)
pure fn test = /** COMPUTATIONALLY EXPENSIVE OPERATION HERE */
```

## Unsafe Functions

```
// Some functions are marked "unsafe". In dream this means they can call low level wasm functions
// And have access to  linear memory. Unsafe functions can only be called inside other unsafe
// functions, or from unsafe blocks.
unsafe fn readI32FromMem(ptr: i32) -> i32 =
    wasm_i32_load(0, 2, ptr)

// This function is not considered unsafe as the call to an unsafe function happens in an unsafe
// block
fn mul(a: i32, b: i32) -> i32 = unsafe {
    wasm_i32_mul(a, b)
}
```
