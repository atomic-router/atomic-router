module.exports = function () {
  return {
    plugins: [
      [
        'effector/babel-plugin',
        {
          noDefaults: true,
          factories: ['atomic-router'],
        },
        'atomic-router',
      ],
    ],
  };
};
