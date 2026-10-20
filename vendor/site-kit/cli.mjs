#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  registerSite,
  buildSiteFiles,
  auditSite,
  validateSites,
} from "./index.mjs";

const output = value => process.stdout.write(`${value}\n`);

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      config: { type: "string" },
      site: { type: "string" },
      all: { type: "boolean" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });
  const root = resolve(values.root ?? process.cwd()),
    command = positionals[0];
  if (values.help || !command) {
    output(
      "站点工具\nregister --config registration.json [--root 中央目录仓库]\nprepare --config site.json --out 输出目录\naudit --config site.json\nprepare --site ID --out 输出目录 [--root 中央目录仓库]\naudit --site ID | --all [--root 中央目录仓库]\n只生成文件或执行明确命令，不会自动提交 Git、修改 DNS 或部署。"
    );
  } else if (command === "register") {
    if (!values.config) throw new Error("请提供 --config 登记资料 JSON");
    output(
      JSON.stringify(
        await registerSite(
          JSON.parse(await readFile(resolve(values.config), "utf8")),
          { root }
        ),
        null,
        2
      )
    );
  } else if (["prepare", "audit"].includes(command)) {
    let selected;
    if (values.config) {
      if (values.site || values.all)
        throw new Error("--config 不能与 --site 或 --all 混用");
      const configured = JSON.parse(
        await readFile(resolve(values.config), "utf8")
      );
      selected = [configured.site ?? configured];
    } else {
      const registry = JSON.parse(
        await readFile(resolve(root, "config/sites.json"), "utf8")
      );
      if (registry.version !== 1) throw new Error("站点登记表版本不支持");
      validateSites(registry.sites);
      selected = values.all
        ? registry.sites
        : registry.sites.filter(site => site.id === values.site);
    }
    validateSites(selected);
    if (!selected.length)
      throw new Error("请通过 --site 指定已有站点，或用 audit --all");
    if (command === "prepare") {
      if (!values.out || selected.length !== 1 || values.all)
        throw new Error("prepare 需要一个 --site 或 --config 及 --out 目录");
      output(
        JSON.stringify(
          await buildSiteFiles(selected[0], resolve(values.out)),
          null,
          2
        )
      );
    } else {
      for (const site of selected) {
        const result = await auditSite(site, {
          checkMetadata: true,
          check404: true,
        });
        output(JSON.stringify(result, null, 2));
        if (!result.ok) process.exitCode = 1;
      }
    }
  } else throw new Error(`未知命令: ${command}`);
} catch (error) {
  process.stderr.write(`站点工具: ${error.message}\n`);
  process.exitCode = 1;
}
