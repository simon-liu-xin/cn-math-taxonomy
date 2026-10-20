# @simonliu/site-kit

用于多个独立网站的 SEO 配置、robots.txt / sitemap 生成、公开页面检查，以及中央作品目录登记。需要 Node.js 22.12 或更高版本，无运行时依赖。当前通过本地 tarball 分发，没有发布到 npm。

## 打包与安装

在工具源码仓库根目录：

```sh
npm pack ./packages/site-kit --pack-destination /tmp
```

把生成的 `simonliu-site-kit-0.2.0.tgz` 放到目标项目的 `vendor/` 中，在目标项目执行：

```sh
npm install --save-dev ./vendor/simonliu-site-kit-0.2.0.tgz
```

目标项目提交 tarball、package.json 和锁文件后，其持续集成可用原来的依赖安装流程复现，不需要检出博客源码。

## 单站配置

新项目根目录创建 `site.json`：

```json
{
  "id": "demo",
  "origin": "https://demo.simonliu.cn",
  "name": "示例工具",
  "description": "准确描述工具用途。",
  "locales": ["zh-CN"],
  "pages": ["/"],
  "sitemapPath": "/sitemap.xml",
  "sitemapMode": "generated"
}
```

```sh
npx --no-install simon-site prepare --config site.json --out public
npx --no-install simon-site audit --config site.json
```

prepare 生成 robots.txt、XML sitemap 和 seo-manifest.json。模板仍须把清单中的标题、摘要、canonical 等写入页面 HTML。audit 检查正式域名，不会替你部署；超时、超出上限或错误均返回非零退出码。默认最多 30 个 sitemap、1,000 个页面，不能把部分成功当成全量通过。

已有框架负责生成 sitemap 时，设 `sitemapMode: "external"`，避免覆盖它。不要将基础 robots 模板直接覆盖已有的完整抓取规则；先输出到临时目录比较。

登记中央目录使用 `simon-site register --config registration.json --root /中央目录仓库`，仍需要中央仓库中的站点、分类、作品资料和封面。它不会修改 DNS、部署或提交 Git。主站与博客读取这份中央资料后重新构建才能同步展示。

代码可通过 `import { pageMetadata, renderPageHead, buildSiteFiles, auditSite } from "@simonliu/site-kit"` 使用；目录读取器 `readCatalog(root, locale)` 只在需要读取中央作品目录时使用。完整接口和登记字段见源码仓库 `docs/site-kit.md`。

0.2.0 新增可直接输出 HTML 的 renderPageHead，统一转义元信息和 JSON-LD。renderSitemap 支持真实 lastmod 与已发布语言对应页；CLI audit 检查原始 HTML 的标题、摘要、H1、语言、JSON-LD 语法和 HTTP 索引响应头，并探测真实 404。页面按最多四个并发检查；超过配置上限仍报告未完整覆盖。警告和失败分开列出，不把已接收网址当作搜索收录结果。
