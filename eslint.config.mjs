import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/data/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
      "vite.config.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
