macro pub()
	// Temp hack to get pub def-wasm-operator and the like to work
	define body
		if is-list(&body.extract(0))
			&body.extract(0)
			&body

	define expanded macro-expand(body)

	if expanded.extract(0) == "macro"
		block
			register-macro expanded.slice(1)
			define definitions expanded.extract(1)
			quote splice-quote
				export
					$(extract definitions 0)
					(parameters $(slice definitions 1))
		block
			define index (if expanded.extract(0) == "define-function" 2 3)
			quote quote splice-quote
				$expanded
				export $(extract expanded 1) $(extract expanded index)

export pub (parameters (&body))

pub macro `()
	quote quote $@&body

pub macro ':'()
	define expr0 &body.extract(0)
	define expr1 &body.extract(1)
	` labeled-expr $expr0 $expr1

pub macro let()
	define equals-expr (extract &body 0)
	` define
		$(extract equals-expr 1)
		$(extract equals-expr 2)

pub macro var()
	define equals-expr (extract &body 0)
	` define-mut
		$(extract equals-expr 1)
		$(extract equals-expr 2)

pub macro m-let()
	define equals-expr (extract &body 0)
	` define-macro-var
		$(extract equals-expr 1)
		$(extract equals-expr 2)

pub macro m-var()
	define equals-expr (extract &body 0)
	` define-mut-macro-var
		$(extract equals-expr 1)
		$(extract equals-expr 2)

pub macro global()
	let mutability = extract &body 0
	let equals-expr = extract &body 1
	let function = if mutability == "let"
		` define-global
		` define-mut-global
	`	$@function
		$(extract equals-expr 1)
		$(extract (extract equals-expr 2) 1)

pub macro ';'()
	let func = &body.extract(0)
	let body = &body.extract(1)
	let args = if body.extract(0) == "block"
		body.slice(1)
		body
	if is-list(func)
		func.concat(args)
		concat(`($func) args)

pub macro lambda()
	let parameters = &body.extract(0)
	let body = &body.extract(1)
	` lambda-expr $parameters $body

pub macro '=>'(&body)
	` lambda $@&body

// Extracts typed parameters from a list where index 0 is fn name, and offset-index+ are labeled-expr
m-let extract-parameters = (definitions) =>
	`(parameters).concat definitions.slice(1)

pub macro fn()
	let definitions = extract(&body 0)
	let identifier = extract(definitions 0)
	let params = extract-parameters(definitions)

	let type-arrow-index = if (extract(&body 1) == "->")
		1
		if (extract(&body 2) == "->") 2 -1

	let return-type =
		` return-type
			$@ if (type-arrow-index > -1)
				&body.slice(type-arrow-index + 1 type-arrow-index + 2)
				`()

	let expressions =
		if (type-arrow-index > -1)
			&body.slice(type-arrow-index + 2)
			&body.slice(1)

	` define-function
		$identifier
		$params
		$return-type
		$(concat #["block"] expressions)

pub macro def-wasm-operator(op wasm-fn arg-type return-type)
	` fn $op(left:$arg-type right:$arg-type) -> $return-type
		binaryen-mod ($arg-type $wasm-fn $return-type) (left right)

// extern $fn-id(namespace params*)
// extern max("Math" x:i32 y:i32)
pub macro extern-fn()
	let namespace = &body.extract(0)
	let definitions = &body.extract(1)
	let identifier = definitions.extract(0)
	let parameters = extract-parameters(definitions)

	let type-arrow-index = if (extract(&body 1) == "->")
		1
		if (extract(&body 2) == "->") 2 -1

	let return-type =
		` return-type
			$ if (type-arrow-index > -1)
				extract(&body type-arrow-index + 1)
				`()

	` define-extern-function
		$identifier
		namespace $namespace
		$parameters
		$return-type

pub macro match()
	let value-expr = &body.extract(0)
	let cases = &body.slice(1)
	let expand-cases = (cases index) =>
		let case = cases.extract(index)
		if is-list(case) and not(index + 1 >= cases.length)
			` if $(extract case 0) == match-value
				$(extract case 1)
				$(&lambda cases (index + 1))
			case

	let conditions = expand-cases(cases 0)
	` block
		let match-value = $value-expr
		$conditions

pub macro type()
	let equals-expr = &body.extract(0)
	let expr = equals-expr.extract(2)
	if expr.is-list and (expr.extract(0) == "struct")
		init-struct(equals-expr.extract(1) expr)
		` define-type
			$(extract equals-expr 1)
			$(extract (extract equals-expr 2) 1)

// Takes (struct $labeled-expr*), returns (struct $labeled-expr*) + field accessor functions
m-let init-struct = (name expr) =>
	let fields = expr.slice(1)
	let get-size = (param) => param.extract(2).match
		"i32" 4
		"i64" 8
		"f32" 4
		"f64" 8
		4

	let field-initializers = fields.map (field) =>
		let field-name = field.extract(1)
		let fn-name = Identifier from: "set-" + field-name
		` $fn-name address $field-name

	// cur-size / accessors
	let accessors-info = fields.reduce(#[0 `()]) (info param) =>
		let offset = info.extract(0)
		let accessors = info.extract(1)
		let field-name = param.extract(1)
		let field-type = param.extract(2)
		let read-fn = field-type.match
			"i32" `(read-i32)
			"i64" `(read-i64)
			"f32" `(read-f32)
			"f64" `(read-f64)
			`(read-i32)

		let pointer = Identifier from: field-name + "-pointer"
		let read-accessors =
			`
				fn $pointer(self:$name) -> i32
					read-i32 self $offset
				fn $field-name(self:$name) -> $field-type
					$@read-fn self $offset

		let write-name = Identifier from: "set-" + field-name
		let write-fn = field-type.match
			"i32" `(store-i32)
			"i64" `(store-i64)
			"f32" `(store-f32)
			"f64" `(store-f64)
			`(store-i32)

		let write-accessor =
			` fn $write-name(self:$name value:$field-type) -> void
				$@write-fn self $offset value

		let newAccessors = accessors
			.spread(read-accessors)
			.push(write-accessor)

		#[offset + param.get-size, newAccessors]

	let total-size = accessors-info.extract(0)
	let accessors = accessors-info.extract(1)
	let initializer =
		` fn $name($expr) -> $name
			let address:$name = alloc($total-size)
			$@field-initializers
			address

	` quote splice-quote
		define-type $name $expr
		$initializer
		$@accessors
