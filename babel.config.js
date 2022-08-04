module.exports = {
  plugins: [
    ['effector/babel-plugin', { factories: ['./src/create-route'] }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
  ],
  presets: [
    ['@babel/preset-env', { loose: true }],
    ['@babel/preset-typescript'],
  ],
};
