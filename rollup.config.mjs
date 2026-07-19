
import pkg from "./package.json" assert { type: "json" };
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import replace from '@rollup/plugin-replace';

const isProd = process.env.NODE_ENV === "production";
const outputPath = process.env.OUTPUT_PATH || 'docs';

const name = `${outputPath}/jtml-min${!isProd ? "-dev" : ""}${"-v" + pkg.version}.js`;

export default {
  input: "src/main.js",
  output: {
    file: name,
    format: "iife", // or "iife" for browser
    sourcemap: !isProd,
    name: "JTML",
  },
  watch: {
    include: "src/**",
    exclude: "node_modules/**",
    clearScreen: false,
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': isProd ? JSON.stringify('production') : JSON.stringify('development')
    }),
    resolve(),
    commonjs(),
    isProd && terser({
      compress: {
        passes: 2,
        pure_getters: true,
        unsafe: true,
        pure_funcs: ['console.log', 'debugger'],
        computed_props: true,
        evaluate: true,
      },
      module: false,
      mangle: {
        properties: {
          regex: /^\$/,
        },
      },
      format: { comments: false },
    }),
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
  },
};
