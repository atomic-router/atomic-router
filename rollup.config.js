import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";
import resolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";

import pkg from "./package.json";
import { minifyConfig } from "./build/minifications";

const extensions = [".ts", ".tsx", ".js"];

const resolverPlugin = resolve({ extensions });

const babelPlugin = babel({
  babelHelpers: "bundled",
  sourceMaps: true,
  extensions,
  exclude: /node_modules.*/,
});

const createTerser = ({ inline }) =>
  terser(
    minifyConfig({
      beautify: Boolean(process.env.BUILD_PRETTY),
      inline,
    })
  );

const input = "src/index.ts";
const external = [
  ...Object.keys(pkg.devDependencies),
  ...Object.keys(pkg.peerDependencies),
  ...Object.keys(pkg.dependencies),
];

// eslint-disable-next-line import/no-anonymous-default-export
export default [
  {
    input,
    external: ["effector", "history"],
    output: {
      name: "atomicRouter",
      file: pkg.unpkg,
      format: "umd",
      sourcemap: true,
      globals: {
        effector: "effector",
        history: "HistoryLibrary",
      },
    },
    plugins: [babelPlugin, resolverPlugin, commonjs(), createTerser({ inline: false })],
  },
  {
    input,
    external,
    output: [
      {
        file: pkg.main,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: pkg.module,
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [babelPlugin, resolverPlugin, commonjs(), createTerser({ inline: true })],
  },
  {
    input,
    external,
    output: [
      {
        file: pkg.types,
        format: "es",
      },
      {
        file: pkg.types.replace(".d.ts", ".d.mts"),
        format: "es",
      },
    ],
    plugins: [resolverPlugin, dts()],
  },
];
