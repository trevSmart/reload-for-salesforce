const { defineConfig } = require("eslint/config");
const eslintJs = require("@eslint/js");
const lwcPlugin = require("@lwc/eslint-plugin-lwc");
const globals = require("globals");

module.exports = defineConfig([
  // LWC configuration
  {
    files: ["**/lwc/**/*.js"],
    plugins: {
      "@lwc/lwc": lwcPlugin
    },
    rules: {
      "@lwc/lwc/no-api-reassignments": "error",
      "@lwc/lwc/no-async-await": "error",
      "@lwc/lwc/no-async-operation": "error",
      "@lwc/lwc/no-attributes-during-construction": "error",
      "@lwc/lwc/no-document-query": "error",
      "@lwc/lwc/no-dupe-class-members": "error",
      "@lwc/lwc/no-for-of": "error",
      "@lwc/lwc/no-inner-html": "error",
      "@lwc/lwc/no-leaky-event-listeners": "error",
      "@lwc/lwc/no-template-children": "error",
      "@lwc/lwc/prefer-custom-event": "error",
      "@lwc/lwc/valid-api": "error",
      "@lwc/lwc/valid-track": "error",
      "@lwc/lwc/valid-wire": "error"
    },
    languageOptions: {
      parser: require("@babel/eslint-parser"),
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-env"],
          plugins: [
            [
              "@babel/plugin-proposal-decorators",
              { decoratorsBeforeExport: true }
            ]
          ]
        }
      },
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    }
  }
]);
