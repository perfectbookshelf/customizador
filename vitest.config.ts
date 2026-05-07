import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Exclude bun-runner-only tests (use `bun test` for those)
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.legacy.test.ts"],
  },
})
