module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 6,
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },
  extends: 'eslint:recommended',
  rules: {
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
  },
}