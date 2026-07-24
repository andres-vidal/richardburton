import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    // React Compiler rules are new in eslint-config-next 16 and flag idiomatic
    // floating-ui / framer-motion ref patterns. We're not adopting the React
    // Compiler yet — turn them off and revisit as its own effort.
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Playwright fixture callbacks take a `use` argument, which the React hooks
    // rule mistakes for the `use` hook — E2E files aren't React components.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      ".next-e2e-*/**",
      "node_modules/**",
      "storybook-static/**",
      "**/*.config.{js,cjs,mjs,ts,mts}",
    ],
  },
];

export default eslintConfig;
