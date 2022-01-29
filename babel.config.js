module.exports = {
  plugins: [
    [
      'effector/babel-plugin',
      {
        factories: ['./src/create-history-router.ts', './src/create-route.ts'],
      },
    ],
  ],
};
