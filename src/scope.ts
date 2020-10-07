import { Entity, EntityKind, NewEntity } from "./entity-scanner/definitions";
import uniqid from "uniqid";

export class Scope {
    /** Entities within this scope */
    private readonly entities: Map<string, Entity>;

    private readonly ownEntities: Set<string> = new Set();

    readonly parent?: Scope;

    readonly type: ScopeType;

    /** Defined locals in this scope. Only allowed if this.type === "function". */
    locals: string[] = [];

    constructor(type: ScopeType, parent?: Scope) {
        this.type = type;
        this.parent = parent;
        this.entities = this.parent ? this.parent.entities : new Map();
    }

    get exports(): string[] {
        return Array.from(this.ownEntities);
    }

    import(entities: string[]) {
        entities.forEach(id => this.ownEntities.add(id));
    }

    resolveLabel(label: string): Entity | undefined {
        for (const id of this.ownEntities) {
            const entity = this.get(id)!;
            if (entity.label === label) return entity;
        }

        if (this.parent) return this.parent.resolveLabel(label);

        return undefined;
    }

    resolveType(label: string): Entity | undefined {
        for (const id of this.ownEntities) {
            const entity = this.get(id)!;
            if (entity.label === label && (entity.kind === "struct" || entity.kind === "type-alias")) return entity;
        }

        if (this.parent) return this.parent.resolveType(label);

        return undefined;
    }

    get(id: string): Entity | undefined {
        const entity = this.entities.get(id);
        if (entity) return entity;
        if (!this.parent) return undefined;
        return this.parent.get(id);
    }

    /** Add the entity as accessible from this scope */
    add(entity: NewEntity) {
        const id = uniqid();
        this.entities.set(id, { id, ...entity });
        this.ownEntities.add(id);
        return id;
    }

    /**
     * Adds the entity to the current scope, and as a local to the main function scope.
     * If we are not inside a function, throw an error.

     */
    addLocal(entity: NewEntity): string {
        const id = this.add(entity);
        this.addLocalToFn(id);
        return id;
    }

    private addLocalToFn(id: string) {
        if (this.type === "function") this.locals.push(id);
        else if (this.parent) this.parent.addLocalToFn(id);
        else throw new Error("Variable defined in invalid scope");
    }

    localsCount(): number {
        if (this.type === "function") return this.locals.length;
        if (this.parent) return this.parent.localsCount();
        throw new Error("Not in a function");
    }

    canAccessEntity(id: string): boolean {
        if (this.ownEntities.has(id)) return true;

        if (this.parent) return this.parent.canAccessEntity(id);

        return false;
    }

    sub(type: ScopeType): Scope {
        return new Scope(type, this);
    }

    toJSON() {
        return {

        };
    }
}

export type ScopeType = "block" | "function" | "type" | "module";
