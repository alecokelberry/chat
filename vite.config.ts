import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defaultClientConditions, defineConfig } from "vite"

// The e2e build (`--mode test`) resolves the browser's packages with the
// "development" condition, so the ones that ship a development build
// (ui-sdk, TanStack Router, micromark) keep their checks: ui-sdk logs a
// "[ui-sdk]" warning on misuse, which e2e/session.ts fails the test on.
// React reads NODE_ENV instead and stays a production build. Only the
// browser bundle changes: the Worker, and what deploys, are untouched.
export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  environments:
    mode === "test"
      ? {
          client: {
            resolve: {
              conditions: [
                ...defaultClientConditions.filter(
                  (condition) => condition !== "development|production"
                ),
                "development",
              ],
            },
          },
        }
      : undefined,
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))
