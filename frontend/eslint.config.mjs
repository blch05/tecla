import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // los avatares vienen de URLs externas arbitrarias (Google, DiceBear): next/image no suma nada acá
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // componentes adaptados de React Bits: se mantienen cerca del original para poder actualizarlos
    files: ['src/components/bits/**'],
    rules: { 'react-hooks/exhaustive-deps': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];

export default config;
