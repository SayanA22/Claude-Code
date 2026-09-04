/**
 * Bundle the page.
 *
 * The modules in src/ only ever import from each other by name, so a
 * dependency-ordered concatenation with the import and export keywords removed
 * is a complete bundle. That keeps the whole project dependency-free: no
 * toolchain to install, nothing to keep up to date, and the file you publish is
 * the file you can read.
 *
 * Produces:
 *   web/index.html    a full document, for opening locally
 *   dist/artifact.html  the same page as a fragment, for publishing
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Dependency order. units has no imports; app depends on the rest. */
const MODULES = ['src/units.js', 'src/parse.js', 'src/compare.js', 'web/app.js'];

const IMPORT_LINE = /^import\s[\s\S]*?from\s+'[^']+';\s*$/gm;
const EXPORT_KEYWORD = /^export\s+(?=(?:default\s+)?(?:function|const|let|var|class)\b)/gm;

function bundle() {
  const parts = MODULES.map((path) => {
    const src = read(path);
    if (/^import\s/m.test(src.replace(IMPORT_LINE, ''))) {
      throw new Error(`${path}: an import survived stripping — keep imports on one line`);
    }
    const body = src.replace(IMPORT_LINE, '').replace(EXPORT_KEYWORD, '').trim();
    return `/* ===== ${path} ===== */\n${body}`;
  });

  return `<script type="module">\n(() => {\n${parts.join('\n\n')}\n})();\n</script>`;
}

const template = read('web/template.html');
if (!template.includes('<!--APP_SCRIPT-->')) {
  throw new Error('web/template.html has no <!--APP_SCRIPT--> placeholder');
}

// A function replacer, not a string: the bundle contains a literal "$&" in a
// regex-escaping helper, and as a replacement string that would expand to the
// match itself and quietly corrupt the code.
const fragment = template.replace('<!--APP_SCRIPT-->', () => bundle());

// The artifact host supplies the document shell and a small reset, so the
// published file is the fragment exactly as it stands.
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), fragment);

// Opening the file locally needs the shell spelled out, including the same
// reset the host applies, or the page looks different in the two places.
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 14px system-ui, sans-serif; background: #fafaf9; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>
${fragment}
</body>
</html>
`;
writeFileSync(join(root, 'web/index.html'), standalone);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
process.stdout.write(
  `dist/artifact.html  ${kb(fragment)}\nweb/index.html      ${kb(standalone)}\n`,
);
