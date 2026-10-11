import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the app from /<repo>/. The deploy workflow sets BASE_PATH;
// local dev and preview use the root.
const base = process.env.BASE_PATH ?? '/';

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * Emits sw.js with the list of built files to precache. Paths are relative
 * (e.g. "./assets/index-abc.js") so they resolve against the SW scope.
 */
function swPlugin(): Plugin {
  return {
    name: 'reaction-trainer-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const template = readFileSync('src/sw/sw.js', 'utf8');
      const publicFiles = listFiles('public').map((f) => relative('public', f).replaceAll('\\', '/'));
      const files = ['./', ...Object.keys(bundle), ...publicFiles]
        .filter((f) => !f.endsWith('.map'))
        .map((f) => (f === './' ? f : `./${f}`));
      const precache = [...new Set(files)].sort();

      // Version from contents, so any change (including unhashed public files
      // like the manifest) gives a new cache.
      const hash = createHash('sha256').update(template);
      for (const item of Object.values(bundle)) hash.update(item.type === 'chunk' ? item.code : item.source);
      for (const f of publicFiles) hash.update(readFileSync(join('public', f)));
      const version = hash.digest('hex').slice(0, 12);

      const source = template
        .replace('__SW_VERSION__', version)
        .replace('__SW_PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base,
  plugins: [swPlugin()],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
