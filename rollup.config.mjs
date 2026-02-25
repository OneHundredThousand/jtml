import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import replace from '@rollup/plugin-replace';

const isProd = process.env.NODE_ENV === "production";
const outputPath = process.env.OUTPUT_PATH || 'docs';

export default {
  input: "src/main.js",
  output: {
    file: `${outputPath}/jtml-min.js`,
    format: "iife", // or "iife" for browser
    sourcemap: !isProd,
    name: "JTML"
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
