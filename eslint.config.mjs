import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs (no FlatCompat needed).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Enforce explicit return types for exported functions
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // No unused variables (allow prefixed with _)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Require consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // React Compiler rules new in eslint-plugin-react-hooks 7 (via
      // eslint-config-next 16). The app does not use the React Compiler, and
      // existing code trips them on purpose in places (useHydrated's
      // setState-in-effect is the hydration gate; the stage canvas mutates
      // three.js objects held in refs). Warn so they stay visible; fix per
      // component in follow-up work, then restore "error".
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
