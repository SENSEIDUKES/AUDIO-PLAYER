// Shared property model: a single declarative registry of every editable
// property, its group/control/default, and which faces expose it. Faces and the
// Properties panel both read this, so new properties become available globally
// with minimal per-face work.
export {
    PROPERTY_REGISTRY,
    PROPERTY_GROUPS,
    PROPERTY_GROUP_LABELS,
    MAJOR_FACES,
    getPropertiesForFace,
    getPropertiesForGroup,
    getPropertyDefaults,
    getByPropPath,
    setByPropPath,
} from "./propertyRegistry"
export type {
    PropertyGroup,
    PropertyControl,
    PropertyDescriptor,
    MediaKind,
    MediaSource,
    SelectOption,
} from "./propertyTypes"
