#!/usr/bin/env -S npx tsx
import fs from "fs/promises";
import path from "path";

const DEFAULT_OUTPUT_FILE = "PLATFORM_CODEBASE.md";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "uploads",
  "coverage",
  "build",
  "out",
  ".vercel",
  ".neon",
  ".yarn",
]);

const EXCLUDED_FILES = new Set([
  "next-env.d.ts",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
]);

const EXCLUDED_EXTENSIONS = new Set([".pem", ".key", ".tsbuildinfo"]);

const BINARY_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".mts": "ts",
  ".cts": "ts",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".prisma": "prisma",
  ".sql": "sql",
  ".css": "css",
  ".scss": "scss",
  ".json": "json",
  ".jsonc": "json",
  ".md": "markdown",
  ".mdx": "mdx",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".html": "html",
  ".xml": "xml",
  ".txt": "text",
  ".env": "dotenv",
};

interface ChapterDefinition {
  id: number;
  title: string;
  description: string;
}

const CHAPTERS: ChapterDefinition[] = [
  {
    id: 1,
    title: "Configuration & Project Setup",
    description:
      "Environment templates, package manifest, TypeScript/ESLint/Next.js build configs, CI workflows, and deployment schedules.",
  },
  {
    id: 2,
    title: "Product Specs, Architecture & Documentation",
    description:
      "Platform README, visual design specification (DESIGN.md), monetization strategy, and architecture decision specs.",
  },
  {
    id: 3,
    title: "Database Schema, Migrations & Seed (Prisma / Neon)",
    description:
      "Relational data models, PostgreSQL migrations, Prisma 7 configuration, and idempotent database seed script.",
  },
  {
    id: 4,
    title: "Core Domain & Infrastructure Libraries (lib/)",
    description:
      "Auth sessions, pricing math, escrow state machines, IntaSend integration, Cloudflare R2 storage, Redis cache, and notifications.",
  },
  {
    id: 5,
    title: "Reusable UI Components & Layout Shells (components/)",
    description:
      "Shared navigation shells, task cards, interactive commissioning ledgers, badges, and editorial visual primitives.",
  },
  {
    id: 6,
    title: "REST API Route Handlers & Webhooks (app/api/)",
    description:
      "Authenticated API endpoints, IntaSend payment webhooks, R2 media/file presign & upload routes, and scheduled cron jobs.",
  },
  {
    id: 7,
    title: "Application Pages & User Workspaces (app/)",
    description:
      "Public marketplace routes, booking checkout wizard, customer dashboard, Creators Hub studio, bidding arena, and Admin console.",
  },
  {
    id: 8,
    title: "CLI Automation, Tooling & Test Suites (scripts/, tests/ & Custom Modules)",
    description:
      "Terminal utilities, automated backend/storage test suites, and any custom workspace folders or modules.",
  },
];

interface CliOptions {
  outFile: string;
}

interface TreeNode {
  name: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
}

interface ExportedCodeFile {
  relPath: string;
  language: string;
  content: string;
  normalizedContent: string;
  lineCount: number;
  bytes: number;
  chapterId: number;
  chapterTitle: string;
  purpose: string;
}

interface WalkResult {
  dirs: string[];
  allFiles: string[];
  codeFiles: ExportedCodeFile[];
  binaryFiles: string[];
}

function parseCliArgs(argv: string[]): CliOptions {
  let outFile = DEFAULT_OUTPUT_FILE;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: npm run codebase:export [-- --out <path>]",
          "       npx tsx scripts/export-codebase.ts [--out <path>]",
          "",
          `Generates or updates structured Markdown documentation (default: ${DEFAULT_OUTPUT_FILE})`,
          "covering every non-binary source file, module metrics, TOC, per-file metadata, and the Project Structure tree.",
        ].join("\n")
      );
      process.exit(0);
    } else if (arg === "--out") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Missing value for --out flag.");
      }
      outFile = next;
      i += 1;
    } else if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length).trim();
      if (!value) {
        throw new Error("Missing value for --out= flag.");
      }
      outFile = value;
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(
        `Unknown argument: ${arg}. Supported flags: --out <path>, --help`
      );
    }
  }

  return { outFile };
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function isExcludedFileName(fileName: string): boolean {
  if (EXCLUDED_FILES.has(fileName)) return true;
  if (
    (fileName === ".env" || fileName.startsWith(".env.")) &&
    fileName !== ".env.example"
  ) {
    return true;
  }
  const ext = path.extname(fileName).toLowerCase();
  return EXCLUDED_EXTENSIONS.has(ext);
}

function getFenceLanguage(relPath: string): string {
  const baseName = path.basename(relPath);
  if (baseName === ".gitignore" || baseName === ".dockerignore") return "text";
  if (baseName === "Dockerfile") return "dockerfile";
  if (baseName.startsWith(".env")) return "dotenv";

  const ext = path.extname(baseName).toLowerCase();
  return LANGUAGE_BY_EXT[ext] ?? "text";
}

function getSafeFence(content: string): string {
  const matches = content.match(/`+/g);
  let longestRun = 0;
  if (matches) {
    for (const run of matches) {
      if (run.length > longestRun) longestRun = run.length;
    }
  }
  return "`".repeat(Math.max(3, longestRun + 1));
}

function isBinaryBuffer(buffer: Buffer, filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  return buffer.includes(0);
}

function toMarkdownAnchor(headingText: string): string {
  return headingText
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s/g, "-");
}

function classifyChapter(relPath: string): ChapterDefinition {
  const lower = relPath.toLowerCase();

  if (lower.startsWith("app/api/")) return CHAPTERS[5];
  if (lower.startsWith("app/")) return CHAPTERS[6];
  if (lower.startsWith("components/")) return CHAPTERS[4];
  if (lower.startsWith("lib/")) return CHAPTERS[3];
  if (lower.startsWith("prisma/") || lower === "prisma.config.ts") {
    return CHAPTERS[2];
  }
  if (lower.startsWith("scripts/") || lower.startsWith("tests/")) {
    return CHAPTERS[7];
  }
  if (
    lower.startsWith("docs/") ||
    lower === "readme.md" ||
    lower === "design.md" ||
    lower === "agents.md" ||
    (!lower.includes("/") && (lower.endsWith(".md") || lower.endsWith(".mdx")))
  ) {
    return CHAPTERS[1];
  }

  const rootConfigFiles = new Set([
    ".gitignore",
    ".env.example",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "next.config.mjs",
    "next.config.js",
    "eslint.config.mjs",
    "vercel.json",
    "neon.ts",
    "postcss.config.mjs",
    "tailwind.config.ts",
  ]);
  if (
    rootConfigFiles.has(lower) ||
    lower.startsWith(".github/") ||
    lower.startsWith(".qodo/") ||
    lower.startsWith(".superpowers/")
  ) {
    return CHAPTERS[0];
  }

  return CHAPTERS[7];
}

function extractTopExports(content: string, limit = 4): string[] {
  const names: string[] = [];
  const pattern =
    /^export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match[1] && !names.includes(match[1])) {
      names.push(match[1]);
      if (names.length >= limit) break;
    }
  }
  return names;
}

function extractLeadingJsDoc(content: string): string | null {
  const match = content.match(/^\s*(?:["']use client["'];?\s*)?\/\*\*([\s\S]*?)\*\//);
  if (!match) return null;
  const cleaned = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line && !line.startsWith("@"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 10) return null;
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

function inferFilePurpose(relPath: string, content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const isClient = /^\s*["']use client["']/.test(normalized);
  const exportsList = extractTopExports(normalized);

  if (relPath === "prisma/schema.prisma") {
    return "Canonical Prisma relational database schema (enums, models, relations, and indexes).";
  }
  if (relPath === "prisma/seed.ts") {
    return "Idempotent database seeding script populating config, categories, demo personas, and sample listings.";
  }
  if (relPath.startsWith("prisma/migrations/") && relPath.endsWith(".sql")) {
    return "Versioned PostgreSQL DDL migration script generated by Prisma Migrate.";
  }
  if (relPath === "app/layout.tsx") {
    return "Root Next.js App Router layout configuring typography, global CSS, auth context, navbar, and footer.";
  }
  if (relPath === "app/globals.css") {
    return "Global Tailwind CSS 4 configuration, color/typography design tokens, editorial card surfaces, and animations.";
  }

  if (relPath.startsWith("app/api/") && relPath.endsWith("/route.ts")) {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((method) =>
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).test(normalized)
    );
    const routePath = "/" + relPath.replace(/^app\//, "").replace(/\/route\.ts$/, "");
    const methodLabel = methods.length > 0 ? `[${methods.join(", ")}] ` : "";
    return `Next.js API Route Handler ${methodLabel}serving ${routePath}.`;
  }

  if (relPath.startsWith("app/") && relPath.endsWith("page.tsx")) {
    const routePath =
      relPath === "app/page.tsx"
        ? "/"
        : "/" + relPath.replace(/^app\//, "").replace(/\/page\.tsx$/, "");
    return `Next.js App Router ${isClient ? "Client" : "Server"} Page rendered at ${routePath}.`;
  }

  if (relPath.startsWith("components/")) {
    const jsDoc = extractLeadingJsDoc(normalized);
    const componentLabel = isClient ? "Client UI Component" : "UI Component";
    if (jsDoc) return `${componentLabel} — ${jsDoc}`;
    if (exportsList.length > 0) {
      return `${componentLabel} exporting ${exportsList.join(", ")}.`;
    }
    return `${componentLabel} module for shared interface rendering.`;
  }

  if (relPath.startsWith("lib/")) {
    const jsDoc = extractLeadingJsDoc(normalized);
    if (jsDoc) return `Core utility module — ${jsDoc}`;
    if (exportsList.length > 0) {
      return `Core domain & infrastructure module exporting ${exportsList.join(", ")}.`;
    }
    return "Core domain & infrastructure helper module.";
  }

  if (relPath.startsWith("tests/")) {
    return "Automated Node/TSX test suite validating platform contracts, storage, and workflows.";
  }

  if (relPath.startsWith("scripts/")) {
    return "Executable terminal automation script for platform maintenance and developer tooling.";
  }

  if (relPath.endsWith(".md") || relPath.endsWith(".mdx")) {
    const headingMatch = normalized.match(/^#\s+(.+)$/m);
    if (headingMatch?.[1]) {
      return `Markdown documentation: ${headingMatch[1].trim()}.`;
    }
    return "Project Markdown documentation.";
  }

  if (relPath === "package.json") {
    return "Project manifest defining runtime dependencies, dev dependencies, and npm scripts.";
  }
  if (relPath === "vercel.json") {
    return "Vercel deployment configuration defining scheduled platform cron endpoints.";
  }
  if (relPath === ".env.example") {
    return "Environment variable template documenting required database, auth, payment, and storage keys.";
  }

  if (exportsList.length > 0) {
    return `Project module exporting ${exportsList.join(", ")}.`;
  }

  return "Repository configuration or supporting source file.";
}

async function walkRepository(
  rootDir: string,
  outputAbsPath: string
): Promise<WalkResult> {
  const dirs: string[] = [];
  const allFiles: string[] = [];
  const codeFiles: ExportedCodeFile[] = [];
  const binaryFiles: string[] = [];

  async function visit(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = toPosixPath(path.relative(rootDir, fullPath));

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        dirs.push(relPath);
        await visit(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (path.resolve(fullPath) === outputAbsPath) continue;
      if (isExcludedFileName(entry.name)) continue;

      allFiles.push(relPath);

      const raw = await fs.readFile(fullPath);
      if (isBinaryBuffer(raw, fullPath)) {
        binaryFiles.push(relPath);
        continue;
      }

      const content = raw.toString("utf8");
      const normalizedContent = content
        .replace(/\r\n/g, "\n")
        .replace(/\n$/, "");
      const lineCount =
        normalizedContent.length === 0 ? 0 : normalizedContent.split("\n").length;
      const chapter = classifyChapter(relPath);

      codeFiles.push({
        relPath,
        language: getFenceLanguage(relPath),
        content,
        normalizedContent,
        lineCount,
        bytes: raw.byteLength,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        purpose: inferFilePurpose(relPath, content),
      });
    }
  }

  await visit(rootDir);

  dirs.sort((a, b) => a.localeCompare(b, "en"));
  allFiles.sort((a, b) => a.localeCompare(b, "en"));
  codeFiles.sort((a, b) => {
    if (a.chapterId !== b.chapterId) return a.chapterId - b.chapterId;
    return a.relPath.localeCompare(b.relPath, "en");
  });
  binaryFiles.sort((a, b) => a.localeCompare(b, "en"));

  return { dirs, allFiles, codeFiles, binaryFiles };
}

function buildAsciiTree(dirs: string[], files: string[]): string {
  const root: TreeNode = {
    name: ".",
    isDir: true,
    children: new Map(),
  };

  function ensureDir(dirPath: string): TreeNode {
    const parts = dirPath.split("/").filter(Boolean);
    let node = root;
    for (const part of parts) {
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, isDir: true, children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }
    return node;
  }

  for (const dir of dirs) {
    ensureDir(dir);
  }

  for (const filePath of files) {
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;
    const parent = ensureDir(parts.join("/"));
    parent.children.set(fileName, {
      name: fileName,
      isDir: false,
      children: new Map(),
    });
  }

  const lines: string[] = ["."];

  function render(node: TreeNode, prefix: string): void {
    const children = [...node.children.values()].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, "en");
    });

    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const suffix = child.isDir ? "/" : "";
      lines.push(`${prefix}${connector}${child.name}${suffix}`);
      if (child.isDir && child.children.size > 0) {
        render(child, `${prefix}${isLast ? "    " : "│   "}`);
      }
    });
  }

  render(root, "");
  return lines.join("\n");
}

function formatKb(bytes: number): string {
  return (bytes / 1024).toFixed(1);
}

function buildMarkdownDocument(
  rootDir: string,
  outputRelPath: string,
  walk: WalkResult
): string {
  const projectName = path.basename(rootDir);
  const generatedAt = new Date().toISOString();

  const filesByChapter = new Map<number, ExportedCodeFile[]>();
  for (const chapter of CHAPTERS) {
    filesByChapter.set(chapter.id, []);
  }
  for (const file of walk.codeFiles) {
    filesByChapter.get(file.chapterId)?.push(file);
  }

  const totalLines = walk.codeFiles.reduce((sum, f) => sum + f.lineCount, 0);
  const totalBytes = walk.codeFiles.reduce((sum, f) => sum + f.bytes, 0);

  const metricsRows = CHAPTERS.map((chapter) => {
    const list = filesByChapter.get(chapter.id) ?? [];
    const lines = list.reduce((s, f) => s + f.lineCount, 0);
    const bytes = list.reduce((s, f) => s + f.bytes, 0);
    const headingText = `${chapter.id}. ${chapter.title}`;
    return `| [${headingText}](#${toMarkdownAnchor(headingText)}) | ${list.length} | ${lines.toLocaleString("en-US")} | ${formatKb(bytes)} KB |`;
  }).join("\n");

  const tocSections = CHAPTERS.map((chapter) => {
    const list = filesByChapter.get(chapter.id) ?? [];
    if (list.length === 0) return null;
    const headingText = `${chapter.id}. ${chapter.title}`;
    const fileLinks = list
      .map(
        (file) =>
          `  - [\`${file.relPath}\`](#${toMarkdownAnchor(file.relPath)}) — ${file.lineCount} lines`
      )
      .join("\n");
    return `- **[${headingText}](#${toMarkdownAnchor(headingText)})** (${list.length} files)\n${fileLinks}`;
  })
    .filter(Boolean)
    .join("\n");

  const header = [
    `# ${projectName} — Technical Codebase Documentation`,
    "",
    `> **Snapshot File:** \`${outputRelPath}\`  `,
    `> **Generated:** \`${generatedAt}\`  `,
    `> **Refresh Command:** \`npm run codebase:export\` (or \`./scripts/export-codebase.ts\`)`,
    "",
    "Complete, self-updating single-file technical reference for the **Tovolana Writers** platform—covering project setup, architecture specs, Prisma database schema, domain libraries, UI components, API routes, application pages, automation scripts, tests, and the live directory tree.",
    "",
    "## Platform Overview & Stack",
    "",
    "| Layer | Technology |",
    "| --- | --- |",
    "| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |",
    "| **Styling** | Tailwind CSS 4, `Inter` + `Plus Jakarta Sans` (`tabular-nums`), Lucide Icons |",
    "| **Database** | Neon PostgreSQL (`@prisma/adapter-pg`), Prisma 7 (`prisma/schema.prisma`) |",
    "| **Cache & Queues** | Redis (`ioredis`), Vercel Cron (`vercel.json`) |",
    "| **Payments** | IntaSend (M-Pesa STK Push, Card Checkout, Webhook Idempotency) |",
    "| **Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) |",
    "",
    "## Codebase Metrics by Module",
    "",
    "| Architectural Chapter | Source Files | Lines of Code | Size |",
    "| --- | ---: | ---: | ---: |",
    metricsRows,
    `| **Total Exported Source** | **${walk.codeFiles.length}** | **${totalLines.toLocaleString("en-US")}** | **${formatKb(totalBytes)} KB** |`,
    "",
    `- **Tracked Directories:** ${walk.dirs.length}`,
    `- **Binary / Media Assets (listed in [Project Structure](#project-structure)):** ${walk.binaryFiles.length}`,
    "",
    "## Table of Contents",
    "",
    tocSections,
    `- **[Project Structure](#project-structure)** (Directory Tree & Complete Path Index)`,
    "",
    "---",
    "",
  ].join("\n");

  const chapterBlocks = CHAPTERS.map((chapter) => {
    const list = filesByChapter.get(chapter.id) ?? [];
    if (list.length === 0) return "";

    const fileEntries = list
      .map((file) => {
        const fence = getSafeFence(file.normalizedContent);
        return [
          `### \`${file.relPath}\``,
          "",
          `> **Path:** \`${file.relPath}\` | **Module:** ${file.chapterTitle} | **Lines:** ${file.lineCount} | **Size:** ${formatKb(file.bytes)} KB  `,
          `> **Purpose:** ${file.purpose}`,
          "",
          `${fence}${file.language}`,
          file.normalizedContent,
          fence,
          "",
        ].join("\n");
      })
      .join("\n");

    return [
      `## ${chapter.id}. ${chapter.title}`,
      "",
      `_${chapter.description}_`,
      "",
      fileEntries,
      "---",
      "",
    ].join("\n");
  }).join("");

  const tree = buildAsciiTree(walk.dirs, walk.allFiles);
  const flatList = walk.allFiles.map((filePath) => `- \`${filePath}\``).join("\n");

  const structureSection = [
    "## Project Structure",
    "",
    `- **Total Directories:** ${walk.dirs.length}`,
    `- **Exported Text / Code Files:** ${walk.codeFiles.length} (${totalLines.toLocaleString("en-US")} lines)`,
    `- **Binary / Media Assets:** ${walk.binaryFiles.length}`,
    `- **Total Project Files:** ${walk.allFiles.length}`,
    "",
    "### Directory Tree",
    "",
    "```text",
    tree,
    "```",
    "",
    "### All Relative File Paths",
    "",
    flatList,
    "",
  ].join("\n");

  return `${header}${chapterBlocks}${structureSection}`;
}

async function main(): Promise<void> {
  const { outFile } = parseCliArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const outputAbsPath = path.resolve(rootDir, outFile);
  const outputRelPath = toPosixPath(path.relative(rootDir, outputAbsPath));

  const walk = await walkRepository(rootDir, outputAbsPath);
  const markdown = buildMarkdownDocument(rootDir, outputRelPath, walk);

  await fs.mkdir(path.dirname(outputAbsPath), { recursive: true });
  await fs.writeFile(outputAbsPath, markdown, "utf8");

  const sizeKb = (Buffer.byteLength(markdown, "utf8") / 1024).toFixed(1);
  console.log(`Codebase documentation written to ${outputRelPath} (${sizeKb} KB)`);
  console.log(
    `Documented ${walk.codeFiles.length} source files across 8 chapters, ${walk.binaryFiles.length} binary assets in tree, and ${walk.dirs.length} directories.`
  );
}

main().catch((err) => {
  console.error(
    "Failed to export codebase documentation:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
