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
          `Exports all platform source files into a single Markdown file (default: ${DEFAULT_OUTPUT_FILE})`,
          "with per-file relative paths and the full Project Structure tree at the end.",
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

      codeFiles.push({
        relPath,
        language: getFenceLanguage(relPath),
        content: raw.toString("utf8"),
      });
    }
  }

  await visit(rootDir);

  dirs.sort((a, b) => a.localeCompare(b, "en"));
  allFiles.sort((a, b) => a.localeCompare(b, "en"));
  codeFiles.sort((a, b) => a.relPath.localeCompare(b.relPath, "en"));
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

function buildMarkdownDocument(
  rootDir: string,
  outputRelPath: string,
  walk: WalkResult
): string {
  const projectName = path.basename(rootDir);
  const generatedAt = new Date().toISOString();

  const header = [
    `# ${projectName} — Full Platform Codebase Snapshot`,
    "",
    `> Generated automatically on \`${generatedAt}\` into \`${outputRelPath}\`.`,
    `> Re-run \`npm run codebase:export\` (or \`npx tsx scripts/export-codebase.ts\`) at any time to refresh this file with new files and folders.`,
    "",
    `- **Exported Source Files:** ${walk.codeFiles.length}`,
    `- **Binary / Media Assets (listed in structure):** ${walk.binaryFiles.length}`,
    `- **Total Tracked Directories:** ${walk.dirs.length}`,
    "",
    "---",
    "",
  ].join("\n");

  const fileSections = walk.codeFiles
    .map((file) => {
      const fence = getSafeFence(file.content);
      const normalized = file.content.replace(/\r\n/g, "\n").replace(/\n$/, "");

      return [
        `## \`${file.relPath}\``,
        "",
        `**Path:** \`${file.relPath}\``,
        "",
        `${fence}${file.language}`,
        normalized,
        fence,
        "",
      ].join("\n");
    })
    .join("\n");

  const tree = buildAsciiTree(walk.dirs, walk.allFiles);
  const flatList = walk.allFiles.map((filePath) => `- \`${filePath}\``).join("\n");

  const structureSection = [
    "---",
    "",
    "## Project Structure",
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

  return `${header}${fileSections}${structureSection}`;
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
  console.log(`Codebase snapshot written to ${outputRelPath} (${sizeKb} KB)`);
  console.log(
    `Included ${walk.codeFiles.length} text/code files, ${walk.binaryFiles.length} binary assets in tree, and ${walk.dirs.length} directories.`
  );
}

main().catch((err) => {
  console.error("Failed to export codebase:", err instanceof Error ? err.message : err);
  process.exit(1);
});
