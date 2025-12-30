import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

const isProd = process.env.NODE_ENV === "production";

export default {
  input: "src/main.js",
  output: {
    file: "docs/jtml-min.js",
    format: "iife", // or "iife" for browser
    sourcemap: !isProd,
    name: "JTML"
  },
  plugins: [
    resolve(),
    commonjs(),
    isProd && terser({
      compress: {
        passes: 2,
        pure_getters: true,
        unsafe: true,
        pure_funcs: ['console.log', 'debugger'],
      },
      mangle: true,
      format: { comments: false },
    }),
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
  },
};
