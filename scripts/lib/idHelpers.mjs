/**
 * Pure string-manipulation helpers for the skin-import CLI.
 * No external dependencies — runs on Node ≥18.
 */

/**
 * Convert a display name into a kebab-case slug suitable for filesystem ids.
 * Strips non-alphanumeric characters, collapses whitespace/hyphens, and
 * lower-cases the result.
 *
 * @param {string} name  The human-readable display name.
 * @returns {string}     A lowercase kebab-case slug (e.g. "my-cool-skin").
 */
export function slugify(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // strip non-alnum (except space/dash)
        .replace(/[\s-]+/g, "-") // collapse whitespace/dashes
        .replace(/^-+|-+$/g, "") // trim leading/trailing dashes
}

/**
 * Convert a kebab-case id to PascalCase.
 *
 * @param {string} id  A kebab-case slug (e.g. "my-cool-skin").
 * @returns {string}   PascalCase (e.g. "MyCoolSkin").
 */
export function toPascal(id) {
    return id
        .split("-")
        .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
        .join("")
}

/**
 * Convert a kebab-case id to camelCase.
 *
 * @param {string} id  A kebab-case slug (e.g. "my-cool-skin").
 * @returns {string}   camelCase (e.g. "myCoolSkin").
 */
export function toCamel(id) {
    const pascal = toPascal(id)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}
