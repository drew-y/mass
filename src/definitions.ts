import { DistributiveOmit } from "./helpers";

export type NewEntity = DistributiveOmit<Entity, "id">;

/** Any item that can be referenced by an identifier */
export type Entity =
    FunctionEntity |
    TypeAlias |
    VariableEntity |
    ParameterEntity |
    ImplEntity;

export interface FunctionEntity extends EntityBase {
    kind: "function";

    /** Entity ID */
    parameters: string[];

    returnTypeLabel?: string;

    returnTypeEntity?: string;
}

/** Represents some form of type alias */
export interface TypeAlias extends EntityBase {
    kind: "type-alias";
}

/** A value can be t */
export interface VariableEntity extends EntityBase {
    kind: "variable";
    mutable: boolean;
    index: number;
    typeLabel?: string;
    typeEntity?: string;
}

/** A value can be t */
export interface ParameterEntity extends EntityBase {
    kind: "parameter";
    mutable: boolean;
    index: number;
    typeLabel?: string;
    typeEntity?: string;
}

export interface ImplEntity extends EntityBase {
    kind: "impl";
    traitLabel?: string;
    traitEntity?: string;
}

/** A declared definition */
export interface EntityBase {
    id: string
    kind: EntityKind;
    label: string;
    flags: string[];
}

export type EntityKind = "function" | "variable" | "parameter" | "impl" | "type-alias";
