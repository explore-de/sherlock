import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import react from "eslint-plugin-react";

export default [
  // shadcn components
  { ignores: ["src/components/"] },
  js.configs.recommended,
  react.configs.flat.recommended,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      // React Compiler rules from eslint-plugin-react-hooks v7; warn until the existing violations are fixed.
      "react-hooks/globals": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-extra-semi": "off",
    },
  },
];
