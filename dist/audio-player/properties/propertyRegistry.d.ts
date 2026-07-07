import { PlayerFace } from '../surfaces/faceCapabilities';
import { PropertyDescriptor, PropertyGroup } from './propertyTypes';
/** Major full-size faces sharing the core typography + media property set. */
export declare const MAJOR_FACES: readonly PlayerFace[];
export declare const PROPERTY_GROUPS: readonly PropertyGroup[];
/** Human labels for the four sections, used by the panel headers. */
export declare const PROPERTY_GROUP_LABELS: Record<PropertyGroup, string>;
export declare const PROPERTY_REGISTRY: readonly PropertyDescriptor[];
/** All properties a face exposes, in registry order. */
export declare function getPropertiesForFace(face: PlayerFace): PropertyDescriptor[];
/** A face's properties within a single section. */
export declare function getPropertiesForGroup(face: PlayerFace, group: PropertyGroup): PropertyDescriptor[];
/** Set a value at a dotted `propPath`, returning a new object (immutable). */
export declare function setByPropPath<T extends Record<string, unknown>>(target: T, propPath: string, value: unknown): T;
/** Read a value at a dotted `propPath`. */
export declare function getByPropPath(target: Record<string, unknown>, propPath: string): unknown;
/**
 * A nested defaults object built from every descriptor's `default`, keyed by
 * `propPath`. Consumers (e.g. the workshop) spread this to seed their settings
 * so editor defaults always track the registry.
 */
export declare function getPropertyDefaults(): Record<string, unknown>;
//# sourceMappingURL=propertyRegistry.d.ts.map