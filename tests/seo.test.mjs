import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('production build publishes only real public pages with readable metadata and attribution', async () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs']);
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, ['/', '/diagnose/', '/guide/', '/privacy/'].map(p => 'https://math-exam.simonliu.cn' + p));
  for (const path of ['', 'diagnose/', 'guide/', 'privacy/']) {
    const html = await readFile('dist/' + path + 'index.html', 'utf8');
    assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
    assert(html.includes(`rel="canonical" href="https://math-exam.simonliu.cn/${path}"`));
    assert.match(html, /name="description" content="[^"]+"/);
    assert.match(html, /<h1[\s>]/);
    assert.match(html, /AI 生成|AI生成/);
    assert.match(html, /未经教师审核/);
    assert.match(html, /href="\/guide\/"/);
    assert.match(html, /href="\/privacy\/"/);
    assert.match(html, /og:site_name/);
    assert.match(html, /application\/ld\+json/);
    assert(!html.includes('hreflang="en"'));
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    assert([...title].length <= 70);
  }
  const guide = await readFile('dist/guide/index.html', 'utf8');
  assert.match(guide, /xiaoyang111222\/cn-math-taxonomy/);
  assert.match(guide, /CC BY-NC 4.0/);
  assert.match(await readFile('dist/_headers', 'utf8'), /\/data\/\*[\s\S]*X-Robots-Tag: noindex/);
  assert.match(await readFile('dist/404.html', 'utf8'), /name="robots" content="noindex,\s*follow"/);
  assert.match(await readFile('dist/robots.txt', 'utf8'), /Sitemap: https:\/\/math-exam.simonliu.cn\/sitemap.xml/);
  for (const filename of ['topics.json', 'dependencies.json', 'questions.json', 'cn-curriculum-standards.json', 'id-aliases.json']) await access('dist/data/' + filename);
  for (const path of ['dist/.git', 'dist/scripts', 'dist/data/_second_pass', 'dist/diagnose/README.md']) await assert.rejects(access(path));
  assert.equal(await readFile('dist/diagnose/app.js', 'utf8'), await readFile('diagnose/app.js', 'utf8'));
  assert.equal(await readFile('dist/diagnose/engine.js', 'utf8'), await readFile('diagnose/engine.js', 'utf8'));
});
