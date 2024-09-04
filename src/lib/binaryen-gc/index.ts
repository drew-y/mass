import binaryen from "binaryen";
import {
  AugmentedBinaryen,
  ExpressionRef,
  HeapTypeRef,
  Struct,
  Type,
  TypeRef,
} from "./types.js";

const bin = binaryen as unknown as AugmentedBinaryen;

export const defineStructType = (
  mod: binaryen.Module,
  struct: Struct
): TypeRef => {
  const fields = struct.fields;
  const structIndex = 0;
  const typeBuilder = bin._TypeBuilderCreate(1);

  const fieldTypesPtr = allocU32Array(fields.map(({ type }) => type));
  const fieldPackedTypesPtr = allocU32Array(
    fields.map(
      ({ packedType }) => packedType ?? bin._BinaryenPackedTypeNotPacked()
    )
  );
  const fieldMutablesPtr = allocU32Array(
    fields.map(({ mutable }) => (mutable ? 1 : 0))
  );

  bin._TypeBuilderSetStructType(
    typeBuilder,
    structIndex,
    fieldTypesPtr,
    fieldPackedTypesPtr,
    fieldMutablesPtr,
    fields.length
  );

  if (struct.supertype) {
    bin._TypeBuilderSetSubType(typeBuilder, structIndex, struct.supertype);
  }

  if (!struct.final) bin._TypeBuilderSetOpen(typeBuilder, structIndex);

  bin._free(fieldTypesPtr);
  bin._free(fieldPackedTypesPtr);
  bin._free(fieldMutablesPtr);

  const result = typeBuilderBuildAndDispose(typeBuilder);

  annotateStructNames(mod, result, struct);

  return bin._BinaryenTypeFromHeapType(result, false);
};

export const defineArrayType = (
  mod: binaryen.Module,
  elementType: TypeRef,
  mutable = false,
  name?: string
): TypeRef => {
  const typeBuilder = bin._TypeBuilderCreate(1);
  bin._TypeBuilderSetArrayType(
    typeBuilder,
    0,
    elementType,
    bin._BinaryenPackedTypeNotPacked(),
    mutable
  );

  const result = typeBuilderBuildAndDispose(typeBuilder);

  if (name) {
    bin._BinaryenModuleSetTypeName(
      mod.ptr,
      result,
      bin.stringToUTF8OnStack(name)
    );
  }

  return bin._BinaryenTypeFromHeapType(result, false);
};

const typeBuilderBuildAndDispose = (typeBuilder: number): HeapTypeRef => {
  const size = bin._TypeBuilderGetSize(typeBuilder);
  const out = bin._malloc(Math.max(4 * size, 8));

  if (!bin._TypeBuilderBuildAndDispose(typeBuilder, out, out, out + 4)) {
    bin._free(out);
    throw new Error("_TypeBuilderBuildAndDispose failed");
  }

  const result = bin.__i32_load(out);
  bin._free(out);

  return result;
};

export const binaryenTypeToHeapType = (type: Type): HeapTypeRef => {
  return bin._BinaryenTypeGetHeapType(type);
};

export const refCast = (
  mod: binaryen.Module,
  ref: ExpressionRef,
  type: TypeRef
): ExpressionRef => bin._BinaryenRefCast(mod.ptr, ref, type);

export const refTest = (
  mod: binaryen.Module,
  ref: ExpressionRef,
  type: TypeRef
): ExpressionRef => bin._BinaryenRefTest(mod.ptr, ref, type);

export const initStruct = (
  mod: binaryen.Module,
  structType: HeapTypeRef,
  values: ExpressionRef[]
): ExpressionRef => {
  const structNewArgs = allocU32Array(values);
  const structNew = bin._BinaryenStructNew(
    mod.ptr,
    structNewArgs,
    values.length,
    structType
  );
  bin._free(structNewArgs);
  return structNew;
};

export const structGetFieldValue = ({
  mod,
  fieldType,
  fieldIndex,
  exprRef,
  signed,
}: {
  mod: binaryen.Module;
  fieldType: number;
  fieldIndex: number;
  exprRef: ExpressionRef;
  signed?: boolean;
}): ExpressionRef => {
  return bin._BinaryenStructGet(
    mod.ptr,
    fieldIndex,
    exprRef,
    fieldType,
    !!signed
  );
};

export const arrayGet = (
  mod: binaryen.Module,
  arrayRef: ExpressionRef,
  index: ExpressionRef,
  elementType: TypeRef,
  signed: boolean
): ExpressionRef => {
  return bin._BinaryenArrayGet(mod.ptr, arrayRef, index, elementType, signed);
};

export const arraySet = (
  mod: binaryen.Module,
  arrayRef: ExpressionRef,
  index: ExpressionRef,
  value: ExpressionRef
): ExpressionRef => {
  return bin._BinaryenArraySet(mod.ptr, arrayRef, index, value);
};

export const arrayLen = (
  mod: binaryen.Module,
  arrayRef: ExpressionRef
): ExpressionRef => {
  return bin._BinaryenArrayLen(mod.ptr, arrayRef);
};

export const arrayNew = (
  mod: binaryen.Module,
  type: HeapTypeRef,
  initialLength: ExpressionRef,
  init: ExpressionRef
): ExpressionRef => {
  return bin._BinaryenArrayNew(mod.ptr, type, initialLength, init);
};

export const arrayCopy = (
  mod: binaryen.Module,
  destRef: ExpressionRef,
  destIndex: ExpressionRef,
  srcRef: ExpressionRef,
  srcIndex: ExpressionRef,
  length: ExpressionRef
): ExpressionRef => {
  return bin._BinaryenArrayCopy(
    mod.ptr,
    destRef,
    destIndex,
    srcRef,
    srcIndex,
    length
  );
};

/** Returns a pointer to the allocated array */
const allocU32Array = (u32s: number[]): number => {
  const ptr = bin._malloc(u32s.length << 2);
  bin.HEAPU32.set(u32s, ptr >>> 2);
  return ptr;
};

const annotateStructNames = (
  mod: binaryen.Module,
  typeRef: HeapTypeRef,
  struct: Struct
) => {
  struct.fields.forEach(({ name }, index) => {
    if (!name) return;
    bin._BinaryenModuleSetFieldName(
      mod.ptr,
      typeRef,
      index,
      bin.stringToUTF8OnStack(name)
    );
  });

  if (struct.name) {
    bin._BinaryenModuleSetTypeName(
      mod.ptr,
      typeRef,
      bin.stringToUTF8OnStack(struct.name)
    );
  }
};
