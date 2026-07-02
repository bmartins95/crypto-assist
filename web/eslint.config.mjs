import tseslint from "typescript-eslint";
import pluginSecurity from "eslint-plugin-security";

export default tseslint.config(
  tseslint.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    rules: {
      // All flagged sites are internal dict lookups on CoinGecko IDs (never user-controlled
      // keys), so this rule produces only false positives in this codebase.
      "security/detect-object-injection": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", ".next/**", "coverage/**", "routeTree.gen.ts"],
  },
);
