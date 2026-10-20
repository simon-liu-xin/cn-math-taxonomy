import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  unlink,
  lstat,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  validateProjectCatalog,
  validateProject,
  projectIdPattern,
} from "./project-policy.mjs";

const blogOrigin = "https://blog.simonliu.cn";
const xmlEscape = value =>
  String(value).replace(
    /[<>&"']/g,
    char =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]
  );
const xmlDecode = value =>
  value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (original, code) => {
      const point =
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code);
      return point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : original;
    })
    .replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, entity) =>
        ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity]
    );
function originOf(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(`origin 必须是完整 HTTPS 根域名: ${value}`);
  return url.origin;
}
function pageUrl(origin, path = "/") {
  if (typeof path !== "string" || /[\s\\\u0000-\u001f]/u.test(path))
    throw new Error(`页面地址无效: ${path}`);
  const url = new URL(path, originOf(origin));
  if (
    url.origin !== originOf(origin) ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(`页面必须属于本站且不能含锚点: ${path}`);
  return url.href;
}
function textRequired(value, name) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} 不能为空`);
  return value.trim();
}
function publicPagePath(page) {
  if (typeof page === "string") return page;
  if (
    !page ||
    typeof page !== "object" ||
    page.private ||
    page.noindex ||
    page.draft ||
    page.indexable === false ||
    (page.visibility !== undefined && page.visibility !== "public")
  )
    throw new Error("pages 仅接受公开且允许索引的已发布页面");
  return page.path;
}

export async function readCatalog(root, locale = "zh-CN") {
  const language = locale === "en" ? "en" : "zh-CN";
  const categories = JSON.parse(
    await readFile(resolve(root, "src/data/project-categories.json"), "utf8")
  );
  const folder = resolve(root, "src/data/projects");
  const projects = await Promise.all(
    (await readdir(folder))
      .filter(name => name.endsWith(".json"))
      .map(async name =>
        JSON.parse(await readFile(resolve(folder, name), "utf8"))
      )
  );
  validateProjectCatalog(projects, categories);
  return {
    categories: categories.map(category => ({
      id: category.id,
      label: category.label[language],
    })),
    projects: projects
      .filter(project => !project.draft)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .map(project => {
        const pending = !project.locales[language];
        const copy = structuredClone(
          project.locales[language] ?? {
            title: project.locales["zh-CN"].title,
            kind: "Code project",
            summary: "English introduction awaiting publication.",
            steps: [],
          }
        );
        if (copy.article)
          copy.article.url = new URL(copy.article.url, blogOrigin).href;
        return {
          ...project,
          copy,
          pending,
          href: new URL(
            project.url[language] ?? project.url["zh-CN"],
            blogOrigin
          ).href,
          languageLabel: project.languages
            .map(lang =>
              lang === "en" ? "EN" : language === "en" ? "ZH" : "中"
            )
            .join(" / "),
          searchable: Object.values(project.locales)
            .flatMap(item => [item.title, item.summary, item.kind])
            .join(" ")
            .toLowerCase(),
        };
      }),
  };
}

/**
 * @param {{ origin: string, path?: string, title: string, description: string, locale?: string, alternates?: Array<{locale: string, path?: string, href?: string}> }} options
 */
export function pageMetadata({
  origin,
  path = "/",
  title,
  description,
  locale = "zh-CN",
  alternates = [],
}) {
  if (!["zh-CN", "en"].includes(locale))
    throw new Error("页面语言只支持 zh-CN / en");
  return {
    canonical: pageUrl(origin, path),
    title: textRequired(title, "title"),
    description: textRequired(description, "description"),
    locale,
    alternates: alternates.map(item => ({
      locale: textRequired(item.locale, "alternate.locale"),
      href: pageUrl(origin, item.path ?? item.href),
    })),
  };
}
/**
 * Render portable HTML head tags without requiring a framework.
 * @param {{origin:string,path?:string,title:string,description:string,locale?:string,alternates?:Array<{locale:string,path?:string,href?:string}>,siteName?:string,image?:string,imageAlt?:string,structuredData?:unknown,noindex?:boolean,author?:string,twitterCard?:"summary"|"summary_large_image"}} options
 */
export function renderPageHead(options) {
  const meta = pageMetadata(options);
  const tag = (attribute, key, value) =>
    `<meta ${attribute}="${key}" content="${xmlEscape(value)}">`;
  const image = options.image ? new URL(options.image, options.origin) : null;
  if (
    image &&
    (image.protocol !== "https:" || image.username || image.password)
  )
    throw new Error("分享图必须为 HTTPS 地址");
  return [
    `<title>${xmlEscape(meta.title)}</title>`,
    tag("name", "description", meta.description),
    tag("name", "author", options.author ?? "Simon Liu"),
    `<link rel="canonical" href="${xmlEscape(meta.canonical)}">`,
    ...(!options.noindex
      ? meta.alternates.map(
          item =>
            `<link rel="alternate" hreflang="${xmlEscape(item.locale)}" href="${xmlEscape(item.href)}">`
        )
      : []),
    ...(options.noindex ? [tag("name", "robots", "noindex,follow")] : []),
    tag("property", "og:type", "website"),
    tag("property", "og:title", meta.title),
    tag("property", "og:description", meta.description),
    tag("property", "og:url", meta.canonical),
    tag("property", "og:site_name", options.siteName ?? meta.title),
    tag("property", "og:locale", meta.locale === "en" ? "en_US" : "zh_CN"),
    tag(
      "name",
      "twitter:card",
      options.twitterCard ?? (image ? "summary_large_image" : "summary")
    ),
    tag("name", "twitter:title", meta.title),
    tag("name", "twitter:description", meta.description),
    ...(image
      ? [
          tag("property", "og:image", image.href),
          tag("property", "og:image:alt", options.imageAlt ?? meta.title),
          tag("name", "twitter:image", image.href),
          tag("name", "twitter:image:alt", options.imageAlt ?? meta.title),
        ]
      : []),
    ...(options.structuredData
      ? [
          `<script type="application/ld+json">${JSON.stringify(
            options.structuredData
          )
            .replace(/</g, "\\u003c")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029")}</script>`,
        ]
      : []),
  ].join("\n");
}
export function renderRobots({ origin, sitemapPath = "/sitemap.xml" }) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl(origin, sitemapPath)}\n`;
}
export function renderSitemap({ origin, pages = ["/"] }) {
  if (!Array.isArray(pages) || !pages.length)
    throw new Error("pages 必须包含真实已发布页面");
  const addresses = new Map(
    pages.map(page => [pageUrl(origin, publicPagePath(page)), page])
  );
  const entries = [...addresses].map(([url, page]) => {
    const object = typeof page === "string" ? {} : page;
    const lastmod = object.lastmod;
    if (
      lastmod &&
      (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(lastmod) ||
        !Number.isFinite(Date.parse(lastmod)))
    )
      throw new Error("lastmod 必须是真实有效日期");
    const alternates = (object.alternates ?? []).map(item => {
      const target = pageUrl(origin, item.path ?? item.href);
      if (!addresses.has(target))
        throw new Error("语言 alternate 必须对应已发布页面");
      return `<xhtml:link rel="alternate" hreflang="${xmlEscape(item.locale)}" href="${xmlEscape(target)}"/>`;
    });
    return `  <url><loc>${xmlEscape(url)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ""}${alternates.join("")}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>\n`;
}
export function validateSites(sites) {
  if (!Array.isArray(sites)) throw new Error("sites 必须为数组");
  const ids = new Set(),
    origins = new Set();
  for (const site of sites) {
    if (!projectIdPattern.test(site?.id ?? "") || ids.has(site.id))
      throw new Error("站点 ID 无效或重复");
    const origin = originOf(site.origin);
    if (origins.has(origin)) throw new Error(`域名重复: ${origin}`);
    textRequired(site.name, "name");
    textRequired(site.description, "description");
    if (
      !Array.isArray(site.locales) ||
      !site.locales.length ||
      site.locales.some(item => !["zh-CN", "en"].includes(item))
    )
      throw new Error("locales 只支持 zh-CN / en");
    if (
      site.sitemapMode !== undefined &&
      !["generated", "external"].includes(site.sitemapMode)
    )
      throw new Error("sitemapMode 无效");
    const sitemap = pageUrl(origin, site.sitemapPath ?? "/sitemap.xml");
    if (new URL(sitemap).search || !new URL(sitemap).pathname.endsWith(".xml"))
      throw new Error("sitemapPath 必须为本站 XML 文件地址");
    if (!Array.isArray(site.pages) || !site.pages.length)
      throw new Error("pages 必须列出真实已发布页面");
    site.pages.forEach(page => pageUrl(origin, publicPagePath(page)));
    ids.add(site.id);
    origins.add(origin);
  }
  return sites;
}
export async function buildSiteFiles(config, outputDir) {
  validateSites([config]);
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "robots.txt"), renderRobots(config));
  if (config.sitemapMode !== "external") {
    const pathname = new URL(
      pageUrl(config.origin, config.sitemapPath ?? "/sitemap.xml")
    ).pathname;
    const destination = resolve(outputDir, `.${pathname}`);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, renderSitemap(config));
  }
  const manifest = {
    version: 1,
    siteId: config.id,
    origin: originOf(config.origin),
    pages: config.pages.map(page =>
      pageMetadata({
        origin: config.origin,
        title: config.name,
        description: config.description,
        ...(typeof page === "string" ? { path: page } : page),
      })
    ),
  };
  await writeFile(
    resolve(outputDir, "seo-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}

export async function registerSite(
  { site, project },
  { root = process.cwd() } = {}
) {
  const registryPath = resolve(root, "config/sites.json"),
    folder = resolve(root, "src/data/projects");
  const lock = resolve(root, "config/.site-kit-register.lock");
  await mkdir(dirname(lock), { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("已有登记任务运行，请稍后重试");
    throw error;
  }
  let addedProject = false;
  let destination, temporary;
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8"));
    if (registry.version !== 1) throw new Error("站点登记表版本不支持");
    validateSites([...registry.sites, site]);
    if (project.id !== site.id)
      throw new Error("site.id 与 project.id 必须一致");
    if (
      new URL(project.url?.["zh-CN"] ?? "", blogOrigin).origin !==
      originOf(site.origin)
    )
      throw new Error("作品 URL 必须属于登记站点");
    const categories = JSON.parse(
      await readFile(resolve(root, "src/data/project-categories.json"), "utf8")
    );
    validateProject(project, categories);
    const existing = await Promise.all(
      (await readdir(folder))
        .filter(name => name.endsWith(".json"))
        .map(async name =>
          JSON.parse(await readFile(resolve(folder, name), "utf8"))
        )
    );
    validateProjectCatalog([...existing, project], categories);
    const imagePath = resolve(root, "public", `.${project.image}`);
    if (!(await lstat(imagePath)).isFile())
      throw new Error(`请先准备作品图片: ${project.image}`);
    destination = resolve(folder, `${project.id}.json`);
    temporary = resolve(dirname(registryPath), `.sites-${randomUUID()}.tmp`);
    await writeFile(
      temporary,
      `${JSON.stringify({ ...registry, sites: [...registry.sites, site] }, null, 2)}\n`,
      { flag: "wx" }
    );
    await writeFile(destination, `${JSON.stringify(project, null, 2)}\n`, {
      flag: "wx",
    });
    addedProject = true;
    await rename(temporary, registryPath);
    return { siteId: site.id, projectPath: destination, registryPath };
  } catch (error) {
    if (addedProject) await unlink(destination);
    if (error.code === "EEXIST")
      throw new Error("作品文件已存在，登记不会覆盖已有内容");
    throw error;
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    await import("node:fs/promises").then(fs => fs.rmdir(lock));
  }
}

// Parse sitemap XML conservatively: reject HTML, DTDs and malformed nesting.
function sitemapEntries(source) {
  if (/<!DOCTYPE|<!ENTITY|<html(?:\s|>)/i.test(source))
    throw new Error("sitemap 不是安全的 XML 站点地图");
  const cleaned = source
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const stack = [];
  let root,
    ended = false;
  const entries = [];
  for (const token of cleaned.match(/<[^>]*>|[^<]+/g) ?? []) {
    if (token.startsWith("<")) {
      const close = token.match(/^<\/([\w:-]+)\s*>$/);
      if (close) {
        if (stack.pop() !== close[1])
          throw new Error("sitemap XML 标签未正确闭合");
        if (!stack.length) ended = true;
        continue;
      }
      const open = token.match(
        /^<([\w:-]+)(?:\s+[\w:-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*(\/?)>$/
      );
      if (!open || ended) throw new Error("sitemap XML 格式无效");
      if (!root) {
        root = open[1];
        if (!["urlset", "sitemapindex"].includes(root))
          throw new Error("XML 缺少 urlset/sitemapindex 根元素");
      }
      if (!open[2]) stack.push(open[1]);
    } else {
      if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(token))
        throw new Error("sitemap XML 转义无效");
      const record = root === "urlset" ? "url" : "sitemap";
      const directField =
        stack.length === 3 && stack[0] === root && stack[1] === record;
      if (directField && stack[2] === "loc")
        entries.push(xmlDecode(token.trim()));
      else if (token.trim()) {
        const standardMetadata =
          directField &&
          (root === "sitemapindex"
            ? ["lastmod"]
            : ["lastmod", "changefreq", "priority"]
          ).includes(stack[2]);
        const extensionContent = stack
          .slice(1)
          .some(name => name.includes(":"));
        if (!standardMetadata && !extensionContent)
          throw new Error("sitemap XML 有非预期文字");
      }
    }
  }
  if (stack.length || !root || !ended || !entries.length)
    throw new Error("sitemap XML 缺少条目或未闭合");
  return { root, entries };
}
function canonicalFrom(html) {
  const links = html.match(/<link\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) ?? [];
  for (const link of links) {
    const attrs = {};
    for (const match of link.matchAll(
      /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    ))
      attrs[match[1].toLowerCase()] = match[2] ?? match[3];
    if (attrs.rel?.split(/\s+/).includes("canonical"))
      return xmlDecode(attrs.href ?? "");
  }
  return "";
}
export async function auditSite(
  config,
  {
    fetchPage = fetch,
    maxPages = 1000,
    maxSitemaps = 30,
    concurrency = 4,
    checkMetadata = false,
    check404 = false,
  } = {}
) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16)
    throw new Error("concurrency 必须为 1–16 的整数");
  validateSites([config]);
  const issues = [],
    checkedPages = [],
    checkedSitemaps = [],
    warnings = [],
    reports = [];
  async function fetchText(address) {
    const response = await fetchPage(address, {
      signal: AbortSignal.timeout(20000),
      headers: {
        "user-agent": "SimonSiteKit/1.0 (+https://www.simonliu.cn/)",
        accept: "text/plain,application/xml,text/html",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (
      response.url &&
      new URL(response.url).origin !== originOf(config.origin)
    )
      throw new Error("响应跳转至其他站点");
    const text = await response.text();
    if (Buffer.byteLength(text) > 10 * 1024 * 1024)
      throw new Error("响应超过 10 MB");
    return {
      text,
      type: response.headers.get("content-type") ?? "",
      headers: response.headers,
    };
  }
  try {
    const robot = await fetchText(pageUrl(config.origin, "/robots.txt"));
    if (
      !/text\/plain/i.test(robot.type) ||
      /<(?:!doctype|html)/i.test(robot.text) ||
      !/^User-agent\s*:/im.test(robot.text)
    )
      throw new Error("没有返回有效文本规则");
    if (
      !robot.text.includes(
        pageUrl(config.origin, config.sitemapPath ?? "/sitemap.xml")
      )
    )
      throw new Error("没有声明本站 sitemap");
    if (/^Disallow:\s*\/\s*$/im.test(robot.text))
      throw new Error("存在全站禁止抓取规则，需要人工确认");
  } catch (error) {
    issues.push(`robots.txt: ${error.message}`);
  }
  const sitemapQueue = [
      pageUrl(config.origin, config.sitemapPath ?? "/sitemap.xml"),
    ],
    pageQueue = new Set(
      config.pages.map(page =>
        pageUrl(config.origin, typeof page === "string" ? page : page.path)
      )
    );
  const visited = new Set();
  while (sitemapQueue.length) {
    const address = sitemapQueue.shift();
    if (visited.has(address)) continue;
    if (visited.size >= maxSitemaps) {
      issues.push(`sitemap 数量超过检查上限 ${maxSitemaps}`);
      break;
    }
    visited.add(address);
    try {
      pageUrl(config.origin, address);
      const result = await fetchText(address);
      if (!/(?:application|text)\/(?:[a-z0-9.+-]*\+)?xml/i.test(result.type))
        throw new Error("XML Content-Type 无效");
      const parsed = sitemapEntries(result.text);
      checkedSitemaps.push(address);
      for (const entry of parsed.entries) {
        if (!/^https:\/\//i.test(entry))
          throw new Error("sitemap URL 必须为完整 HTTPS 地址");
        const safe = pageUrl(config.origin, entry);
        if (parsed.root === "sitemapindex") sitemapQueue.push(safe);
        else pageQueue.add(safe);
      }
    } catch (error) {
      issues.push(`${address}: ${error.message}`);
    }
  }
  if (pageQueue.size > maxPages)
    issues.push(`页面数量超过检查上限 ${maxPages}，本次结果不完整`);
  const targets = [...pageQueue].slice(0, maxPages);
  let cursor = 0;
  async function inspect(address) {
    try {
      const result = await fetchText(address);
      if (!/text\/html|application\/xhtml\+xml/i.test(result.type))
        throw new Error("页面未返回 HTML");
      const head =
        result.text.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ??
        result.text;
      const canonical = canonicalFrom(head);
      if (canonical !== address)
        throw new Error(`canonical 无效或不匹配: ${canonical || "缺失"}`);
      if (
        /<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["'][^"']*noindex)[^>]*>/i.test(
          result.text
        )
      )
        throw new Error("sitemap 页面包含 noindex");
      if (/noindex|none/i.test(result.headers.get("x-robots-tag") ?? ""))
        throw new Error("sitemap 页面被 X-Robots-Tag 禁止索引");
      if (checkMetadata) {
        const metas = {};
        for (const tag of head.match(
          /<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi
        ) ?? []) {
          const attrs = {};
          for (const match of tag.matchAll(
            /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
          ))
            attrs[match[1].toLowerCase()] = xmlDecode(match[2] ?? match[3]);
          const key = (attrs.name ?? attrs.property ?? "").toLowerCase();
          if (key) (metas[key] ??= []).push(attrs.content ?? "");
        }
        const title = xmlDecode(
          head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
        ).trim();
        if (!title) throw new Error("缺少有效 title");
        if (metas.description?.length !== 1 || !metas.description[0].trim())
          throw new Error("必须有唯一且非空的 description");
        if (!/<h1\b[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/i.test(result.text))
          throw new Error("原始 HTML 缺少可读 H1");
        if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(result.text))
          throw new Error("缺少页面语言 lang");
        const schemas = [
          ...head.matchAll(
            /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
          ),
        ];
        for (const schema of schemas) JSON.parse(schema[1]);
        if (!schemas.length) warnings.push(`${address}: 未声明结构化数据`);
        if ([...title].length > 70)
          warnings.push(
            `${address}: 标题 ${[...title].length} 字符，建议精简至 70 以内`
          );
        for (const key of [
          "og:title",
          "og:description",
          "og:url",
          "og:site_name",
          "twitter:card",
        ])
          if (!metas[key]?.[0]) warnings.push(`${address}: 缺少 ${key}`);
        reports.push({
          url: address,
          title,
          description: metas.description[0],
          structuredData: schemas.length,
        });
      }
      checkedPages.push(address);
    } catch (error) {
      issues.push(`${address}: ${error.message}`);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
      while (cursor < targets.length) {
        const address = targets[cursor++];
        await inspect(address);
      }
    })
  );
  if (checkMetadata) {
    const titles = new Map();
    for (const report of reports) {
      const previous = titles.get(report.title);
      if (previous) warnings.push(`${report.url}: 与 ${previous} 使用相同标题`);
      else titles.set(report.title, report.url);
    }
  }
  if (check404) {
    const address = pageUrl(config.origin, "/__site-kit-missing-page__/");
    try {
      const response = await fetchPage(address, {
        signal: AbortSignal.timeout(20000),
      });
      if (![404, 410].includes(response.status))
        issues.push(`404 探测返回 ${response.status}，应返回 404/410`);
    } catch (error) {
      issues.push(`404 探测: ${error.message}`);
    }
  }
  return {
    siteId: config.id,
    ok: issues.length === 0,
    checkedSitemaps,
    checkedPages: checkedPages.sort(),
    issues,
    warnings: warnings.sort(),
    discoveredPages: pageQueue.size,
    attemptedPages: targets.length,
    complete:
      pageQueue.size <= maxPages &&
      visited.size <= maxSitemaps &&
      sitemapQueue.length === 0,
  };
}
