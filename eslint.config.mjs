import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Separate Lambda project with its own runtime (CJS, Node 20).
    "alexa-skill/**",
    // Agent worktrees: full checkouts of this repo, each with its own
    // node_modules. Without this, linting from the repo root walks into them
    // and reports thousands of errors that belong to dependencies, drowning
    // the real ones. Gitignored, but flat config does not read .gitignore.
    ".claude/**",
  ]),
]);

export default eslintConfig;
