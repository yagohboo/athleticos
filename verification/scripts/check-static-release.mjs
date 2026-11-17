/* global fetch */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { TextDecoder } from 'node:util';

const base = new URL(process.argv[2] ?? 'https://yagohboo.github.io/athleticos/');
assert.equal(base.protocol, 'https:');
assert(!base.username && !base.password);
if (!base.pathname.endsWith('/')) base.pathname += '/';
const root = path.resolve('dist');
async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(file)));
    else if (entry.isFile()) found.push(file);
  }
  return found;
}
const paths = await files(root);
let checked = 0;
for (let offset = 0; offset < paths.length; offset += 5) {
  await Promise.all(
    paths.slice(offset, offset + 5).map(async (file) => {
      const relative = path.relative(root, file).split(path.sep).join('/');
      const response = await fetch(new URL(relative, base), { headers: { 'Cache-Control': 'no-cache' } });
      assert.equal(response.status, 200, `${relative}: HTTP ${response.status}`);
      const expected = await readFile(file);
      const actual = new Uint8Array(await response.arrayBuffer());
      if (/\.(html|js|css|json|webmanifest|svg|txt)$/.test(relative)) {
        assert.equal(
          new TextDecoder().decode(actual).replaceAll('\r\n', '\n'),
          expected.toString('utf8').replaceAll('\r\n', '\n'),
          `${relative}: published contents differ`,
        );
      } else assert.deepEqual(actual, new Uint8Array(expected), `${relative}: published bytes differ`);
      checked++;
    }),
  );
}
console.log(`PASS: all ${checked} production files return HTTP 200 and match dist at ${base.href}`);
