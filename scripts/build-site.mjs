import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSiteFiles, renderPageHead } from '../vendor/site-kit/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const site = JSON.parse(await readFile(join(root, 'site.json'), 'utf8'));
const topics = JSON.parse(await readFile(join(root, 'data/topics.json'), 'utf8'));
const questions = JSON.parse(await readFile(join(root, 'data/questions.json'), 'utf8'));
const upstream = 'https://github.com/xiaoyang111222/cn-math-taxonomy';
const repository = 'https://github.com/simon-liu-xin/cn-math-taxonomy';
const warning = 'AI 生成的草稿，未经教师审核；先修关系、题库和诊断结果仅供学习交流。';
const nav = '<nav aria-label="站点导航"><a href="/">知识图谱</a> · <a href="/diagnose/">前置诊断</a> · <a href="/guide/">使用说明与来源</a> · <a href="/privacy/">数据与隐私</a> · <a href="https://www.simonliu.cn/">Simon 个人主页</a></nav>';
const pages = [
  { path: '/', title: '中小学数学知识图谱（一至九年级）· 草稿', description: '按年级、册次和知识点浏览小学至初中数学先修关系与诊断题，探索学习前置知识。AI 生成的草稿，未经教师审核。', type: 'WebApplication' },
  { path: '/diagnose/', title: '数学前置诊断 · 中小学数学知识图谱', description: '从目标知识点出发，通过作答回溯可能需要补充的先修知识，并查看学习路径。题库未经教师审核，结果不作为正式测评。', type: 'WebApplication' },
  { path: '/guide/', title: '使用说明、数据来源与局限 · 中小学数学知识图谱', description: '了解知识图谱筛选、前置诊断、掌握推断与学习路径的使用方式，以及 AI 草稿、原项目署名和非商业使用边界。', type: 'WebPage' },
  { path: '/privacy/', title: '数据与隐私说明 · 中小学数学知识图谱', description: '说明诊断进度、题量偏好与已做题记录在浏览器本地的保存方式、清除方法，以及网站托管和外部链接的数据处理。', type: 'WebPage' },
];
const css = 'body{margin:0;background:#f6f7f9;color:#1f2933;font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:70ch;margin:auto;padding:32px 20px 56px}h1{font-size:28px;line-height:1.4}h2{font-size:21px;margin-top:28px}nav{font-size:14px;line-height:2}a{color:#1d4ed8}a:focus-visible{outline:2px solid currentColor;outline-offset:3px}.notice{border-left:3px solid #c2410c;padding-left:16px}';
function head(page, noindex = false) {
  const url = site.origin + page.path;
  return renderPageHead({ origin: site.origin, path: page.path, title: page.title, description: page.description, locale: 'zh-CN', siteName: site.name, author: '原项目：xiaoyang111222/cn-math-taxonomy；本站部署维护：Simon Liu', noindex, structuredData: { '@context': 'https://schema.org', '@graph': [
    { '@type': page.type, '@id': url + '#page', url, name: page.title, description: page.description, inLanguage: 'zh-CN', isPartOf: { '@id': site.origin + '/#website' }, ...(page.type === 'WebApplication' ? { applicationCategory: 'EducationalApplication', operatingSystem: 'Web browser', isBasedOn: upstream } : {}) },
    { '@type': 'WebSite', '@id': site.origin + '/#website', url: site.origin + '/', name: site.name, inLanguage: 'zh-CN', publisher: { '@id': 'https://www.simonliu.cn/#person' } },
    { '@type': 'Person', '@id': 'https://www.simonliu.cn/#person', name: 'Simon Liu', url: 'https://www.simonliu.cn/about/' },
  ] } });
}
function document(page, body, noindex = false) {
  return `<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head(page, noindex)}<link rel="icon" href="data:,"><style>${css}</style></head><body><main>${nav}<h1>${page.title}</h1>${body}</main></body></html>\n`;
}
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'data'), { recursive: true });
for (const name of ['topics.json', 'dependencies.json', 'cn-curriculum-standards.json', 'questions.json', 'id-aliases.json']) await cp(join(root, 'data', name), join(output, 'data', name));
await mkdir(join(output, 'diagnose'), { recursive: true });
for (const name of ['app.js', 'engine.js', 'style.css']) await cp(join(root, 'diagnose', name), join(output, 'diagnose', name));
for (const page of pages.slice(0, 2)) {
  const file = page.path === '/' ? 'index.html' : 'diagnose/index.html';
  let html = await readFile(join(root, file), 'utf8');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, head(page));
  html = html.replace('</header>', `</header><div style="padding:4px 16px;background:#fff;border-bottom:1px solid #e1e4e8">${nav}</div>`);
  const introduction = page.path === '/'
    ? `<section class="card"><h2>从一个知识点看清前置关系</h2><p>浏览一至九年级数学知识点，按年级、册次、学科或名称筛选。选择左侧知识点可查看掌握标准、诊断题、先修链和后续知识；也可进入前置诊断尝试回溯。</p><p>${warning}</p><p>本部署基于开源项目，来源、许可证与局限见<a href="/guide/">使用说明</a>。未启用 JavaScript 时仍可阅读说明页。</p></section>`
    : `<section><h2>如何开始一次探索</h2><p>等待题库加载后选择知识点或章节，按实际理解作答，再查看可能薄弱的先修知识与建议学习路径。答题进度保存在本机浏览器。</p><p>${warning}答对少量题目不能证明已经掌握整个知识体系，答错也不能替代教师判断。</p><p>完整方法与限制见<a href="/guide/">使用说明</a>。</p></section>`;
  html = html.replace(page.path === '/' ? '<div class="empty">加载中…</div>' : '<p class="loading">加载数据中……</p>', introduction);
  await writeFile(join(output, file), html);
}
const guide = `<p class="notice">${warning}本工具不是教育部门或教材出版社的官方产品，不提供成绩预测、医学判断或教学质量认证。</p>
<h2>知识图谱怎样使用</h2><p>首页支持按年级、册次、学科与类型筛选，或搜索知识点名称、描述和章节。选择一个知识点后，可查看其描述、掌握标准、诊断题、递归先修链，以及依赖它的后续知识点。硬先修与软先修是项目中的建模判断，不能视作已验证的因果结论。</p>
<h2>前置诊断怎样推断</h2><p>先选择目标知识点或章节。诊断通常先问目标，再依据答题情况回溯先修知识。每个知识点最多尝试两题；答对一题可能将祖先标为“掌握（推断）”，这不代表逐项测过。一次错、一次对会标为“不稳”，两次错误可能触发继续回溯。题量用尽时仍可能有未测知识点，建议结合结果说明自行检查。</p><p>这些是代码中的启发式规则，未经真实学生数据校准。建议学习路径按先修关系与年级整理，不等于完整教学计划。开放题或无法可靠自动判定的答案需要自行对照参考答案；题库和参考答案本身也可能有误。</p>
<h2>数据范围与待核部分</h2><p>当前仓库包含 ${topics.length} 个知识点、${questions.length} 道题。此数量从实际数据读取，不等于已经逐题验证。项目参考《义务教育数学课程标准（2022 年版）》和人教版教材顺序；部分册次目录来自非官方来源，课标条文、章节与先修关系仍有待核项目，不能宣传为全面通过官方审核。</p><p>详细来源和核对情况保留在<a href="${repository}#数据来源与对齐依据">仓库来源说明</a>与<a href="${repository}/blob/main/docs/standards-mapping.md">课标映射文档</a>。</p>
<h2>原项目、本站与许可</h2><p>本部署基于 <a href="${upstream}">xiaoyang111222/cn-math-taxonomy 原项目</a>，保留其数据、诊断算法与原作者声明。原项目 README 将商业授权联系指向 X 账号 @hassanyehiaa；本站不更改或替代原作者授权。本站部署与 SEO 维护由 Simon Liu 负责，相关变更见<a href="${repository}">本站仓库</a>。</p><p>原项目采用 <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans">CC BY-NC 4.0</a>：使用和再分发需保留署名、注明来源与修改，不得擅自用于商业用途。本站增加使用说明、隐私说明、网页元信息与自动构建配置，没有新增教师审核、认证或题库准确性保证。</p>
<h2>适用与反馈</h2><p>适合个人学习、家长陪伴和教师研究时作为探索材料。正式教学、能力评价和学习安排应由了解学生情况的教师结合教材核实。发现错误可在<a href="${repository}/issues">本站仓库反馈</a>，请提供题目编号和可复现步骤，不上传学生姓名、学校、成绩单或其他个人信息。请一并阅读<a href="/privacy/">数据与隐私说明</a>。</p>`;
const privacy = `<p>适用于 <a href="${site.origin}/">math-exam.simonliu.cn</a> 上的数学图谱与诊断工具。${warning}</p>
<h2>本机保存什么</h2><p>当前代码将诊断会话、题量偏好和做过的题目编号保存在当前浏览器 localStorage，供继续答题和减少重复出题使用。答题与路径计算在浏览器内完成，当前代码没有账号系统或向本站服务器提交作答记录的接口，也未接入独立广告或访问统计脚本。</p><h2>怎样清除</h2><p>工作台可以放弃当前存档；要清除全部会话、设置与题目历史，请在浏览器的网站数据设置中清除本站存储。共用设备上，其他使用同一浏览器的人可能看到本机记录。请勿在公开反馈中提供学生身份信息。</p><h2>托管与外部链接</h2><p>网站由 Cloudflare 提供托管和安全服务。传送网页和防范滥用可能涉及 IP 地址、请求网址、时间及浏览器信息，具体处理取决于实际设置与<a href="https://www.cloudflare.com/privacypolicy/">Cloudflare 隐私政策</a>。浏览器本地计算不等于访问网站时完全不产生网络数据。</p><p>打开 GitHub、原项目或其他外部页面时，对方按其政策处理访问。隐私或纠错问题可通过<a href="${repository}/issues">本站仓库</a>或<a href="https://www.simonliu.cn/about/">Simon 的联系渠道</a>反馈。</p><h2>来源与使用边界</h2><p>本站基于开源原项目部署，原作者署名、CC BY-NC 4.0 许可和数据限制见<a href="/guide/">使用说明与来源</a>。未来如果增加上传、账号、统计或广告，会按实际功能更新说明和用户选择。</p>`;
for (const [page, body] of [[pages[2], guide], [pages[3], privacy]]) {
  await mkdir(join(output, page.path), { recursive: true });
  await writeFile(join(output, page.path, 'index.html'), document(page, body));
}
await writeFile(join(output, '404.html'), document({ path: '/404.html', title: '页面不存在 · 中小学数学知识图谱', description: '该地址没有可访问页面，请返回知识图谱或使用说明。', type: 'WebPage' }, '<p>这个地址不存在，请使用上方导航返回公开页面。</p>', true));
await buildSiteFiles(site, output);
await writeFile(join(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/data/*\n  X-Robots-Tag: noindex\n');
await writeFile(join(output, 'llms.txt'), `# 中小学数学知识图谱\n\n> ${warning}\n\n- [图谱](${site.origin}/)\n- [前置诊断](${site.origin}/diagnose/)\n- [使用说明与来源](${site.origin}/guide/)\n- [数据与隐私](${site.origin}/privacy/)\n\n原项目：${upstream}，CC BY-NC 4.0。不得将草稿视作经官方或教师认证的测评。\n`);
console.log(`已生成 ${pages.length} 个公开页面与 SEO 文件；只发布 dist/。`);
