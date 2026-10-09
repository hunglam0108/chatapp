// eslint.config.js
import js from '@eslint/js';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default [
  js.configs.recommended,
  eslintPluginPrettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        node: true,
        process: true,
        console: true,
      },
    },
    rules: {
      // Bắt buộc viết code sạch
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Cảnh báo biến không dùng (bỏ qua biến có dấu _)
      'no-console': 'warn', // Cảnh báo khi dùng console.log (nên xoá bớt trước khi push)
      'no-var': 'error', // Bắt buộc dùng const/let, cấm dùng var
      'prefer-const': 'error', // Tự động nhắc dùng const cho biến không đổi
      'eqeqeq': ['error', 'always'], // Bắt buộc dùng === thay vì ==
      'curly': ['error', 'all'], // Bắt buộc dùng {} cho khối if/else
    },
  },
];