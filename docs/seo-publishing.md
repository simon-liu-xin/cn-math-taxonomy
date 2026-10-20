# 本站 SEO 与 GitHub 自动发布

正式站点为 `https://math-exam.simonliu.cn/`，现有 Cloudflare Worker 为 `cn-math-taxonomy`，关联 `simon-liu-xin/cn-math-taxonomy` 的 `main`。本站使用用户已有部署，不新建 Worker 或 Pages，不使用本机直接上传。原 README 中 `math.pansgo.com`、GitHub Pages 和 `scripts/deploy-cf.sh` 为上游项目历史资料，不是本站部署入口。

## 修改和发布

1. 修改页面或数据，执行 `node scripts/build-site.mjs`。
2. 执行 `node tests/test_engine.js` 和 `node --test tests/seo.test.mjs`。
3. 检查后提交并推送 GitHub `main`，Cloudflare 的现有 Git 集成自动调用 `npx wrangler deploy`；`wrangler.jsonc` 中的构建钩子会生成 `dist/`。
4. 确认 Cloudflare 构建对应提交成功，再核对正式域名上的页面与地图。推送或部署成功不代表已被搜索引擎收录。

`dist/` 只包含页面、诊断脚本与必需的五个数据文件，不上传 `.git`、源码脚本、教师待核工作记录或生成中间文件。未知路径返回真实 HTTP 404。不要修改现有自定义域名绑定，也不要创建另一份部署。

## 收录策略

四个公开规范页面：`/`、`/diagnose/`、`/guide/`、`/privacy/`。各页独立输出标题、摘要、canonical、结构化数据和分享字段，标题不超过 70 字符。当前只有中文全文，不生成不存在的英文版本或 hreflang。查询参数中的目标、随机种子、演示状态使用诊断主页作为 canonical，不逐个进入地图。

`/sitemap.xml` 只列这四页，`/robots.txt` 声明地图；统一主站地图同时引用本地图。数据 JSON 可供应用请求，但使用 HTTP noindex 排除独立索引。`llms.txt` 提供公开内容入口，不承诺 AI 引用或排名。

工具是基于原开源项目的部署，必须保留原项目署名、CC BY-NC 4.0 和“AI 生成的草稿，未经教师审核”的边界。Simon 是本站部署维护者，不将原项目改写为 Simon 原创或宣传为官方认证。诊断算法和题库保持不变。

共享元信息由固定在 `vendor/site-kit/` 的 0.2.0 工具提供。四页正文均可在无 JavaScript 时阅读说明，图谱筛选和诊断仍需浏览器脚本。
