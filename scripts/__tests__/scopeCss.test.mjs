import { describe, it, expect } from "vitest"
import { scopeCss } from "../lib/scopeCss.mjs"

const SCOPE = "sap-visual-demo"
const ID = "demo"

describe("scopeCss", () => {
    describe("top-level selectors", () => {
        it("prefixes a simple class selector", () => {
            const input = `.container {\n  color: red;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} .container {`)
        })

        it("prefixes an element selector", () => {
            const input = `div {\n  margin: 0;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} div {`)
        })

        it("prefixes an id selector", () => {
            const input = `#main {\n  padding: 10px;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} #main {`)
        })

        it("handles comma-separated selectors", () => {
            const input = `.a, .b {\n  color: blue;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} .a`)
            expect(result).toContain(`.${SCOPE} .b`)
        })
    })

    describe(":root / html / body / * rewriting", () => {
        it("rewrites :root to scope class", () => {
            const input = `:root {\n  --fg: white;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} {`)
            expect(result).not.toContain(":root")
        })

        it("rewrites html to scope class", () => {
            const input = `html {\n  font-size: 16px;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} {`)
        })

        it("rewrites body to scope class", () => {
            const input = `body {\n  margin: 0;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} {`)
        })

        it("rewrites * to scope class", () => {
            const input = `* {\n  box-sizing: border-box;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} {`)
        })

        it("rewrites body .foo to scope .foo", () => {
            const input = `body .foo {\n  color: red;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} .foo {`)
        })

        it("rewrites body.dark-theme to scope class with class combined", () => {
            const input = `body.dark-theme {\n  background: black;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE}.dark-theme {`)
        })

        it("rewrites body[data-theme='dark'] to scope class with attribute combined", () => {
            const input = `body[data-theme='dark'] {\n  background: black;\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE}[data-theme='dark'] {`)
        })
    })

    describe("@keyframes namespacing", () => {
        it("renames @keyframes and animation references", () => {
            const input = [
                `@keyframes spin {`,
                `  from { transform: rotate(0deg); }`,
                `  to { transform: rotate(360deg); }`,
                `}`,
                `.icon {`,
                `  animation: spin 1s linear infinite;`,
                `}`,
            ].join("\n")

            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`@keyframes sap-${ID}-spin`)
            expect(result).toContain(`animation: sap-${ID}-spin 1s linear infinite`)
            expect(result).not.toMatch(/animation:\s*spin\b/)
        })

        it("renames animation-name references", () => {
            const input = [
                `@keyframes fadeIn {`,
                `  from { opacity: 0; }`,
                `  to { opacity: 1; }`,
                `}`,
                `.panel {`,
                `  animation-name: fadeIn;`,
                `}`,
            ].join("\n")

            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`@keyframes sap-${ID}-fadeIn`)
            expect(result).toContain(`animation-name: sap-${ID}-fadeIn`)
        })

        it("renames animation references when declaration spans multiple lines", () => {
            const input = [
                `@keyframes slide {`,
                `  from { left: 0; }`,
                `  to { left: 100px; }`,
                `}`,
                `.box {`,
                `  animation:`,
                `    slide`,
                `    2s`,
                `    ease;`,
                `}`,
            ].join("\n")

            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`@keyframes sap-${ID}-slide`)
            expect(result).toContain(`sap-${ID}-slide`)
        })
    })

    describe("@media blocks", () => {
        it("preserves the media query and scopes inner selectors", () => {
            const input = [
                `@media (max-width: 600px) {`,
                `  .sidebar {`,
                `    display: none;`,
                `  }`,
                `}`,
            ].join("\n")

            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain("@media (max-width: 600px)")
            expect(result).toContain(`.${SCOPE} .sidebar`)
        })
    })

    describe("header comments", () => {
        it("emits a scoping header", () => {
            const result = scopeCss(".x { color: red; }", SCOPE, ID)
            expect(result).toMatch(/^\/\* Scoped under \.sap-visual-demo/)
        })

        it("warns about @font-face", () => {
            const input = `@font-face {\n  font-family: "Custom";\n  src: url(f.woff2);\n}`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain("@font-face (kept as-is)")
        })

        it("warns about @import", () => {
            const input = `@import url("reset.css");\n.a { color: red; }`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain("@import")
        })
    })

    describe("comment stripping", () => {
        it("ignores braces inside comments and scopes correctly", () => {
            const input = `/* } */\n.foo {\n  color: red;\n}\n/* { */`
            const result = scopeCss(input, SCOPE, ID)
            expect(result).toContain(`.${SCOPE} .foo {`)
        })
    })
})
