import { defineConfig } from 'vitest/config';
import babel from '@rollup/plugin-babel';

const extensions = ['.ts', '.tsx', '.js'];
const babelPlugin = babel({
  babelHelpers: 'bundled',
  sourceMaps: true,
  extensions,
  exclude: /node_modules.*/,
});

export default defineConfig({
  plugins: [babelPlugin],
});
