import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const isProd = process.env.BUILD === 'production';

export default {
  input: 'src/main.ts',
  output: {
    dir: '.',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default',
    name: 'LeanPlugin'
  },
  external: ['obsidian', 'electron', 'react', 'react-dom'],
  plugins: [
    typescript({ tsconfig: './tsconfig.json' }),
    nodeResolve({ browser: true }),
    commonjs({ include: ['node_modules/**'] }),
  ]
};