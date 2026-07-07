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
    // Honor the `_`-prefix convention for intentionally-unused args/vars.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "storybook-static/**",
      "**/*.config.{js,cjs,mjs,ts,mts}",
    ],
  },
];

export default eslintConfig;
