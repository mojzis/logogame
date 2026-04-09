import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      // --- React hooks discipline ---
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // --- Temporal dead-zone / ordering bugs ---
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],

      // --- Catch common JS mistakes ---
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
      "no-implicit-coercion": ["error", { allow: ["!!"] }],
      "no-shadow": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-constant-condition": "error",
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-fallthrough": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-unreachable": "error",
      "no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
    },
  },
  { ignores: ["dist/", "node_modules/", "ricky-r.jsx"] },
];
