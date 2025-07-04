// build.js
const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/main.js'], // Your main file
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: 'dist/bundle.js',
    target: ['es6'],
    format: 'iife', // Good for directly including in HTML
}).catch(() => process.exit(1));