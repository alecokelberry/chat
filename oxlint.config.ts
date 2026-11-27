import { defineConfig, type DummyRuleMap } from "oxlint"

// Design system (DESIGN.md): the @shadcn/lint rules as errors everywhere.
// App code adds layout classes only; components/ui relaxes no-restyle
// and keep a documented allowlist of structural arbitrary values.
const shadcnRules: DummyRuleMap = {
  "shadcn/no-raw-colors": "error",
  "shadcn/no-arbitrary-values": "error",
  "shadcn/no-inline-styles": "error",
  "shadcn/no-unknown-classes": "error",
  "shadcn/require-static-classes": "error",
}

// React and a11y rules.
const reactRules: DummyRuleMap = {
  "react/rules-of-hooks": "error",
  "react/exhaustive-deps": "error",
  "react/set-state-in-effect": "error",
  "react/jsx-key": "error",
  "react/no-children-prop": "error",
  "react/no-danger-with-children": "error",
  "react/no-direct-mutation-state": "error",
  "react/no-unescaped-entities": "error",
  "jsx-a11y/alt-text": "error",
  "jsx-a11y/aria-props": "error",
  "jsx-a11y/aria-proptypes": "error",
  "jsx-a11y/aria-unsupported-elements": "error",
  "jsx-a11y/role-has-required-aria-props": "error",
  "jsx-a11y/role-supports-aria-props": "error",
}

const typedRules: DummyRuleMap = {
  "typescript/no-floating-promises": "error",
  "typescript/no-misused-promises": "error",
  "typescript/await-thenable": "error",
  "typescript/no-unnecessary-type-assertion": "error",
  "typescript/strict-boolean-expressions": "error",
  "typescript/no-unnecessary-condition": "error",
  "typescript/prefer-nullish-coalescing": "error",
}

// From Pulse's lint: small functions, shallow nesting, no cycles, kebab-case
// files, no escape hatches from the types.
const shapeRules: DummyRuleMap = {
  eqeqeq: "error",
  "no-else-return": ["error", { allowElseIf: false }],
  "no-param-reassign": ["error", { props: true }],
  complexity: ["error", 10],
  "max-depth": ["error", 3],
  "max-lines": [
    "error",
    { max: 750, skipBlankLines: true, skipComments: true },
  ],
  "import/no-cycle": "error",
  "unicorn/filename-case": ["error", { case: "kebabCase" }],
  "typescript/no-explicit-any": "error",
  "typescript/no-non-null-assertion": "error",
  "typescript/consistent-type-assertions": [
    "error",
    { assertionStyle: "never" },
  ],
}

export default defineConfig({
  plugins: ["typescript", "react", "jsx-a11y", "import", "oxc", "unicorn"],
  jsPlugins: ["@shadcn/lint", "./lint/ui-plugin.js"],
  categories: { correctness: "error" },
  options: { typeAware: true },
  env: { browser: true, worker: true, es2024: true },
  ignorePatterns: [
    "**/dist/**",
    "**/.wrangler/**",
    "**/routeTree.gen.ts",
    "**/worker-configuration.d.ts",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "docs/**",
    ".agents/**",
    ".claude/**",
    "artifacts/**",
  ],
  settings: {
    shadcn: { ui: ["@/components/ui"] },
  },
  rules: {
    // React Compiler's rules; the app doesn't use the compiler.
    "react/refs": "off",
    "react/immutability": "off",
    "react/purity": "off",
    // role="status" and friends on a span are right; <output> and the rest
    // aren't drop-in replacements.
    "jsx-a11y/prefer-tag-over-role": "off",
    "no-unused-vars": "error",
    "no-debugger": "error",
    "no-undef": "off",
    "no-var": "error",
    "prefer-const": "error",
    ...shadcnRules,
    ...typedRules,
    ...reactRules,
    ...shapeRules,
    // App code composes components/ui; it never reaches for ui-sdk itself.
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@ui-sdk/**"],
            message:
              "Use components/ui, not ui-sdk directly. Add or extend a component there (DESIGN.md).",
          },
        ],
      },
    ],
    "ui/no-raw-button": "error",
    "ui/no-hand-rolled-role": "error",
    "ui/button-icon-data-icon": "error",
    "ui/type-scale": "error",
    "ui/motion-tokens": "error",
    "ui/no-leading-tracking": "error",
    "shadcn/no-restyle": [
      "error",
      {
        allow: ["layout"],
      },
    ],
  },
  overrides: [
    {
      // e2e tests take `test` and `expect` from e2e/session.ts, which
      // fails a test on page errors and shares sign-in; a spec that
      // imports Playwright's own would skip both.
      files: ["e2e/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@ui-sdk/**"],
                message:
                  "Use components/ui, not ui-sdk directly. Add or extend a component there (DESIGN.md).",
              },
            ],
            paths: [
              {
                name: "@playwright/test",
                importNames: ["test", "expect"],
                message:
                  "Import test and expect from ./session: it fails on page errors and shares sign-in.",
              },
            ],
          },
        ],
      },
    },
    {
      // Unit tests (vitest.config.ts): Vitest's own mistakes. Plain tests
      // come from vitest and properties are `it.prop` from
      // @fast-check/vitest, which lint counts as a test block. Lint can't
      // see `it.only.prop`, but Vitest fails a focused test in CI.
      files: ["src/**/*.test.ts"],
      plugins: ["vitest"],
      rules: {
        "vitest/expect-expect": [
          "error",
          {
            assertFunctionNames: ["expect"],
            additionalTestBlockFunctions: ["it.prop"],
          },
        ],
        "vitest/no-focused-tests": "error",
        "vitest/no-disabled-tests": "error",
        "vitest/no-identical-title": "error",
        "vitest/no-conditional-expect": "error",
        "vitest/no-standalone-expect": [
          "error",
          { additionalTestBlockFunctions: ["it.prop"] },
        ],
        "vitest/valid-expect": "error",
        "vitest/valid-title": "error",
        "vitest/no-commented-out-tests": "error",
      },
    },
    {
      files: ["e2e/session.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@ui-sdk/**"],
                message:
                  "Use components/ui, not ui-sdk directly. Add or extend a component there (DESIGN.md).",
              },
            ],
          },
        ],
      },
    },
    {
      // components/ui owns component styling and wraps ui-sdk.
      files: ["src/components/ui/**"],
      rules: {
        "ui/no-raw-button": "off",
        "ui/button-icon-data-icon": "off",
        // Each component from its own entry; never ui-sdk's internals.
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@ui-sdk/react",
                message:
                  "Import each component from its own entry, like @ui-sdk/react/select.",
              },
              {
                name: "@ui-sdk/core",
                // bindViewport has no entry of its own (ui-sdk core docs ›
                // Follow the Viewport import it from the root).
                allowImportNames: ["bindViewport"],
                message: "Import from its own entry, like @ui-sdk/core/agent.",
              },
            ],
            patterns: [
              {
                group: ["@ui-sdk/*/internal/**"],
                message: "ui-sdk's internals aren't API.",
              },
            ],
          },
        ],
        "ui/no-leading-tracking": "off",
        "shadcn/no-restyle": "off",
      },
    },
  ],
})
