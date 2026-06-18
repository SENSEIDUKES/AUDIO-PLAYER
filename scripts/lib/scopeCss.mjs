/**
 * CSS scoping transform for imported Workshop-Light skins.
 *
 * Prefixes every top-level rule selector with a scope class so styles from one
 * skin can't leak into the player or another skin. Also namespaces @keyframes
 * and rewrites matching animation references.
 *
 * This is a *pragmatic* transform — not a full CSS parser. It handles the
 * machine-generated CSS that Sea-Workshop-Light emits reliably. Anything it
 * can't confidently scope is listed in a header comment for manual review.
 *
 * No external dependencies — runs on Node ≥18.
 */

/**
 * Scope every selector in `css` under `.sap-visual-<id>`.
 *
 * @param {string} css         Raw CSS text.
 * @param {string} scopeClass  The class name to scope under (e.g. "sap-visual-my-skin").
 * @param {string} id          The skin id (e.g. "my-skin"), used for @keyframes namespacing.
 * @returns {string}           Scoped CSS with a header comment for un-scopeable constructs.
 */
export function scopeCss(css, scopeClass, id) {
    /** @type {string[]} */
    const warnings = []
    /** @type {Map<string, string>} */
    const keyframeRenames = new Map()

    // Strip comments to prevent braces inside comments from breaking depth tracking
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "")

    // First pass: collect @keyframes names so we can rename them
    const keyframeRe = /@keyframes\s+([\w-]+)/g
    let kfMatch
    while ((kfMatch = keyframeRe.exec(cleanCss)) !== null) {
        const original = kfMatch[1]
        const namespaced = `sap-${id}-${original}`
        keyframeRenames.set(original, namespaced)
    }

    const lines = cleanCss.split("\n")
    /** @type {string[]} */
    const output = []
    let depth = 0
    /** @type {"top" | "media" | "keyframes" | "other-at"} */
    let blockType = "top"
    /** @type {string[]} */
    const blockStack = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Track brace depth
        const noStringsLine = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "")
        const opens = (noStringsLine.match(/{/g) || []).length
        const closes = (noStringsLine.match(/}/g) || []).length

        if (depth === 0 && trimmed === "") {
            output.push(line)
            continue
        }

        // At top level — detect @-rules and selectors
        if (depth === 0) {
            if (trimmed.startsWith("@keyframes ")) {
                blockStack.push(blockType)
                blockType = "keyframes"
                // Rename the keyframes declaration
                const renamed = trimmed.replace(
                    /@keyframes\s+([\w-]+)/,
                    (_, name) => `@keyframes ${keyframeRenames.get(name) || name}`
                )
                output.push(renamed)
                depth += opens - closes
                continue
            }

            if (trimmed.startsWith("@media ")) {
                blockStack.push(blockType)
                blockType = "media"
                output.push(line) // keep @media query intact
                depth += opens - closes
                continue
            }

            if (trimmed.startsWith("@font-face")) {
                warnings.push("@font-face (kept as-is)")
                blockStack.push(blockType)
                blockType = "other-at"
                output.push(line)
                depth += opens - closes
                continue
            }

            if (trimmed.startsWith("@import")) {
                warnings.push(`@import: ${trimmed}`)
                output.push(line)
                depth += opens - closes
                continue
            }

            if (trimmed.startsWith("@")) {
                // Unknown @-rule — pass through with warning
                warnings.push(`Unknown @-rule: ${trimmed.split("{")[0].trim()}`)
                blockStack.push(blockType)
                blockType = "other-at"
                output.push(line)
                depth += opens - closes
                continue
            }

            // Regular selector at top level — scope it
            if (opens > 0 || trimmed.endsWith(",")) {
                const scoped = scopeSelectors(trimmed, scopeClass, warnings)
                output.push(scoped)
                depth += opens - closes
                continue
            }

            // Bare selector line without brace (multi-line selector)
            if (trimmed && !trimmed.startsWith("}")) {
                const scoped = scopeSelectors(trimmed, scopeClass, warnings)
                output.push(scoped)
                depth += opens - closes
                continue
            }
        }

        // Inside a block
        if (depth > 0) {
            const newDepth = depth + opens - closes

            if (blockType === "media" && depth === 1) {
                // Inside @media at depth 1 — scope inner selectors
                if (trimmed.startsWith("}")) {
                    // closing @media
                    output.push(line)
                } else if (opens > 0 || trimmed.endsWith(",")) {
                    const scoped = scopeSelectors(trimmed, scopeClass, warnings)
                    output.push(scoped)
                } else if (trimmed && !trimmed.startsWith("}")) {
                    // Multi-line selector continuation inside @media
                    const scoped = scopeSelectors(trimmed, scopeClass, warnings)
                    output.push(scoped)
                } else {
                    output.push(line)
                }
            } else if (blockType === "keyframes") {
                // Inside @keyframes — pass through as-is
                output.push(line)
            } else {
                // Inside a regular rule or other-at block
                output.push(line)
            }

            depth = newDepth

            // Pop block type when we return to top level
            if (depth === 0) {
                blockType = blockStack.pop() || "top"
            }
            continue
        }

        // Closing brace at depth 0 (shouldn't happen, but be safe)
        output.push(line)
        depth += opens - closes
        if (depth === 0 && blockStack.length > 0) {
            blockType = blockStack.pop() || "top"
        }
    }

    // Build header comment
    const unique = [...new Set(warnings)]
    let header = `/* Scoped under .${scopeClass} by import-skin CLI. */\n`
    if (unique.length > 0) {
        header += `/* ⚠️  Could not confidently scope the following — review manually:\n`
        for (const w of unique) {
            header += ` *   - ${w}\n`
        }
        header += ` */\n`
    }

    const finalCss = output.join("\n")
    return header + rewriteAnimationReferences(finalCss, keyframeRenames)
}

/**
 * Scope a selector line. Handles comma-separated selectors.
 *
 * @param {string} selectorLine
 * @param {string} scopeClass
 * @param {string[]} warnings
 * @returns {string}
 */
function scopeSelectors(selectorLine, scopeClass, warnings) {
    // Split on the opening brace — the part before `{` is selectors, after is the rest
    const braceIdx = selectorLine.indexOf("{")
    const selectorPart = braceIdx >= 0 ? selectorLine.slice(0, braceIdx) : selectorLine
    const rest = braceIdx >= 0 ? selectorLine.slice(braceIdx) : ""

    const selectors = selectorPart.split(",").map((s) => s.trim()).filter(Boolean)
    const scoped = selectors.map((sel) => scopeSingleSelector(sel, scopeClass, warnings))

    return scoped.join(",\n") + (rest ? " " + rest.trim() : "")
}

/**
 * Scope a single CSS selector.
 *
 * @param {string} selector
 * @param {string} scopeClass
 * @param {string[]} warnings
 * @returns {string}
 */
function scopeSingleSelector(selector, scopeClass, warnings) {
    const s = selector.trim()

    // :root, html, body (and combined selectors like body.dark or body[data-theme]) → scope root
    if (/^(:root|html|body)(?![a-zA-Z0-9_-])/i.test(s)) {
        return s.replace(/^(:root|html|body)/i, `.${scopeClass}`)
    }

    // Universal selector alone
    if (s === "*") {
        return `.${scopeClass}`
    }

    // * followed by more selectors (e.g. "* > .foo")
    if (/^\*\s+/.test(s)) {
        return `.${scopeClass} ${s}`
    }

    // Already starts with the scope class (idempotency guard)
    if (s.startsWith(`.${scopeClass}`)) {
        return s
    }

    // Normal selector — prepend scope
    return `.${scopeClass} ${s}`
}

/**
 * Rewrite animation / animation-name references to use namespaced keyframe names.
 *
 * @param {string} line
 * @param {Map<string, string>} renames
 * @returns {string}
 */
function rewriteAnimationReferences(line, renames) {
    if (renames.size === 0) return line
    let result = line
    for (const [original, namespaced] of renames) {
        // Match animation-name or animation shorthand references
        // Use word-boundary matching to avoid false positives
        const re = new RegExp(`(animation(?:-name)?\\s*:[^;{}]*?)\\b${escapeRegex(original)}\\b`, "g")
        result = result.replace(re, `$1${namespaced}`)
    }
    return result
}

/**
 * Escape a string for use in a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
