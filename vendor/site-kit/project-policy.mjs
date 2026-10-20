export const projectIcons = [
  "music",
  "calculator",
  "network",
  "code",
  "globe",
  "book",
];
export const projectIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validProjectHref(value) {
  if (typeof value !== "string" || /[\s\\\u0000-\u001f]/u.test(value))
    return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function validateCategories(categories) {
  if (!Array.isArray(categories)) throw new Error("分类配置必须为数组");
  const ids = new Set();
  for (const category of categories) {
    if (
      !category ||
      typeof category.id !== "string" ||
      !projectIdPattern.test(category.id) ||
      category.id === "all" ||
      ids.has(category.id)
    )
      throw new Error(`分类 ID 无效或重复: ${category.id}`);
    for (const locale of ["zh-CN", "en"])
      if (
        typeof category.label?.[locale] !== "string" ||
        !category.label[locale].trim()
      )
        throw new Error(`分类缺少 ${locale} 名称: ${category.id}`);
    ids.add(category.id);
  }
  return ids;
}

export function validateProject(project, categories) {
  const fail = message => {
    throw new Error(`${project?.id ?? "project"}: ${message}`);
  };
  if (
    !project ||
    typeof project.id !== "string" ||
    !projectIdPattern.test(project.id)
  )
    fail("ID 只能使用小写字母、数字和连字符");
  if (!validateCategories(categories).has(project.category))
    fail(`未知分类 ${project.category}`);
  if (!projectIcons.includes(project.icon)) fail("不支持的图标");
  if (!Number.isFinite(project.order) || typeof project.featured !== "boolean")
    fail("排序或首页展示字段无效");
  if (project.draft !== undefined && typeof project.draft !== "boolean")
    fail("draft 必须为布尔值");
  if (
    !Array.isArray(project.languages) ||
    !project.languages.length ||
    project.languages.some(locale => !["zh-CN", "en"].includes(locale))
  )
    fail("languages 只支持 zh-CN / en");
  if (
    !project.url?.["zh-CN"] ||
    Object.values(project.url).some(url => !validProjectHref(url))
  )
    fail("访问地址必须为 http(s) URL 或站内绝对路径");
  if (
    !/^\/images\/projects\/[a-z0-9][a-z0-9.-]*\.(webp|png|jpe?g|avif|svg)$/i.test(
      project.image
    )
  )
    fail("图片必须放在 public/images/projects/ 下");
  if (!project.locales?.["zh-CN"]) fail("缺少中文介绍");
  for (const [locale, copy] of Object.entries(project.locales)) {
    if (!["zh-CN", "en"].includes(locale)) fail(`不支持的介绍语言 ${locale}`);
    if (!copy || typeof copy !== "object" || Array.isArray(copy))
      fail(`${locale} 介绍必须为对象`);
    for (const field of ["title", "kind", "summary"])
      if (typeof copy[field] !== "string" || !copy[field].trim())
        fail(`${locale}.${field} 不能为空`);
    if (
      !Array.isArray(copy.steps) ||
      copy.steps.some(step => typeof step !== "string" || !step.trim())
    )
      fail(`${locale}.steps 必须为文字数组`);
    for (const field of ["tagline", "boundary", "action"])
      if (copy[field] !== undefined && typeof copy[field] !== "string")
        fail(`${locale}.${field} 必须为文字`);
    if (
      copy.article &&
      (!validProjectHref(copy.article.url) ||
        typeof copy.article.title !== "string" ||
        !copy.article.title.trim())
    )
      fail(`${locale}.article 无效`);
  }
  return project;
}

export function validateProjectCatalog(projects, categories) {
  const ids = new Set(),
    urls = new Set();
  for (const project of projects) {
    validateProject(project, categories);
    const address = new URL(project.url["zh-CN"], "https://blog.simonliu.cn");
    address.hash = "";
    address.pathname = address.pathname.replace(/\/$/, "") || "/";
    const url = address.href;
    if (ids.has(project.id) || urls.has(url))
      throw new Error(`作品 ID 或网址重复: ${project.id}`);
    ids.add(project.id);
    urls.add(url);
  }
  return projects;
}
