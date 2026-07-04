import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import prettier from "eslint-config-prettier"
import globals from "globals"

export default tseslint.config(
    {
        // Build output, deps, coverage and type declarations are never linted.
        ignores: ["dist/**", "node_modules/**", "coverage/**", "**/*.d.ts"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
        plugins: {
            "react-hooks": reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // TypeScript already reports undefined identifiers; the ESLint rule
            // only produces false positives on type-only and global references.
            "no-undef": "off",
            // Surface, but don't block on, existing tech debt so CI stays green
            // while it is paid down. Rules-of-hooks stays an error on purpose.
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/ban-ts-comment": "warn",
            "@typescript-eslint/no-unsafe-function-type": "warn",
            "no-empty": "warn",
            "no-case-declarations": "warn",
            "prefer-const": "warn",
        },
    },
    // Node scripts (.mjs) run outside the TS program; give them Node globals.
    {
        files: ["**/*.mjs"],
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
    // Disable rules that conflict with Prettier's formatting.
    prettier
)
