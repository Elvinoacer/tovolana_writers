#!/usr/bin/env -S npx tsx
import fs from "fs";
import path from "path";
import readline from "readline/promises";
import ts from "typescript";

const ROOT_DIR = process.cwd();
const DEFAULT_OUTPUT_FILE = "one_file_code.md";

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
};

interface BundledFile {
  relPath: string;
  absPath: string;
  content: string;
  lineCount: number;
  byteCount: number;
  role: string;
  language: string;
}

interface CliOptions {
  entryPath?: string;
  outFile: string;
  watch: boolean;
  componentsOnly: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    outFile: DEFAULT_OUTPUT_FILE,
    watch: true, // Default to real-time watch mode
    componentsOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--once" || arg === "-1") {
      options.watch = false;
    } else if (arg === "--watch" || arg === "-w") {
      options.watch = true;
    } else if (arg === "--components-only") {
      options.componentsOnly = true;
    } else if (arg === "--out" || arg === "-o") {
      options.outFile = args[++i] || DEFAULT_OUTPUT_FILE;
    } else if (arg === "--help" || arg === "-h") {
      printUsageAndExit();
    } else if (!arg.startsWith("-") && !options.entryPath) {
      options.entryPath = arg;
    }
  }

  return options;
}

function printUsageAndExit(): never {
  console.log(`
Usage:
  npx tsx scripts/bundle-file.ts [entryFile] [options]
  npm run bundle [-- [entryFile] [options]]

Options:
  --watch, -w          Watch for changes in real-time (default: true)
  --once, -1           Bundle once and exit (no watch mode)
  --out, -o <file>     Target output file (default: one_file_code.md)
  --components-only    Only include React components/UI files
  --help, -h           Show this help message

Examples:
  npx tsx scripts/bundle-file.ts app/explore/page.tsx
  npx tsx scripts/bundle-file.ts app/explore --once
  npm run bundle
`);
  process.exit(0);
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
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

function getLanguage(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  return LANGUAGE_BY_EXT[ext] || "text";
}

function determineRole(relPath: string, isEntry: boolean): string {
  if (isEntry) {
    if (relPath.includes("/page.") || relPath.endsWith("page.tsx")) {
      return "Entry Page";
    }
    return "Primary Entry Module";
  }
  if (relPath.startsWith("components/ui/")) {
    return "UI Primitive Component";
  }
  if (relPath.startsWith("components/")) {
    return "Sub-Component";
  }
  if (relPath.startsWith("lib/")) {
    return "Domain / Infrastructure Library";
  }
  if (relPath.startsWith("app/api/")) {
    return "API Route Handler";
  }
  if (relPath.includes("config") || relPath.endsWith(".prisma") || relPath === "neon.ts") {
    return "Configuration / Schema";
  }
  return "Imported Module";
}

function resolveEntryFile(input: string, rootDir: string): string | null {
  const clean = input.trim().replace(/^@\//, "");
  const directPath = path.resolve(rootDir, clean);

  // Exact file check
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return normalizePath(path.relative(rootDir, directPath));
  }

  // Common extensions check
  const candidateExts = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json", ".css"];
  for (const ext of candidateExts) {
    const candidate = directPath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePath(path.relative(rootDir, candidate));
    }
  }

  // Directory index or page check
  const candidateSubFiles = [
    "page.tsx",
    "page.ts",
    "page.jsx",
    "page.js",
    "index.tsx",
    "index.ts",
    "index.jsx",
    "index.js",
  ];
  for (const sub of candidateSubFiles) {
    const candidate = path.join(directPath, sub);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePath(path.relative(rootDir, candidate));
    }
  }

  // Also check inside app/ if not prefixed with app/
  if (!clean.startsWith("app/") && !clean.startsWith("components/") && !clean.startsWith("lib/")) {
    const appAttempt = resolveEntryFile(path.join("app", clean), rootDir);
    if (appAttempt) return appAttempt;
  }

  return null;
}

function loadTsConfigPaths(rootDir: string): Record<string, string[]> {
  const tsconfigPath = path.join(rootDir, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return { "@/*": ["./*"] };
  try {
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    // Strip simple comments or parse JSON
    const parsed = JSON.parse(raw);
    return parsed?.compilerOptions?.paths || { "@/*": ["./*"] };
  } catch {
    return { "@/*": ["./*"] };
  }
}

function resolveImportSpecifier(
  specifier: string,
  containingAbsPath: string,
  rootDir: string,
  paths: Record<string, string[]>
): string | null {
  let targetAbs: string | null = null;

  if (specifier.startsWith(".")) {
    targetAbs = path.resolve(path.dirname(containingAbsPath), specifier);
  } else if (specifier.startsWith("@/")) {
    targetAbs = path.resolve(rootDir, specifier.slice(2));
  } else {
    // Check if matching any custom path alias
    for (const [aliasPattern, targetList] of Object.entries(paths)) {
      const prefix = aliasPattern.replace(/\*$/, "");
      if (specifier.startsWith(prefix) && targetList.length > 0) {
        const replacement = targetList[0].replace(/\*$/, "");
        const remainder = specifier.slice(prefix.length);
        targetAbs = path.resolve(rootDir, replacement, remainder);
        break;
      }
    }
  }

  if (!targetAbs) {
    return null; // External package or unmapped alias
  }

  // Check possible extensions
  const exts = [
    "",
    ".tsx",
    ".ts",
    ".jsx",
    ".js",
    ".mjs",
    ".json",
    ".css",
    "/index.tsx",
    "/index.ts",
    "/index.jsx",
    "/index.js",
    "/page.tsx",
  ];

  for (const ext of exts) {
    const candidate = targetAbs + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const rel = normalizePath(path.relative(rootDir, candidate));
      if (!rel.startsWith("node_modules/") && !rel.startsWith(".next/")) {
        return rel;
      }
    }
  }

  return null;
}

function extractImportsFromFile(absPath: string): string[] {
  const ext = path.extname(absPath).toLowerCase();
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(ext)) {
    return [];
  }

  const content = fs.readFileSync(absPath, "utf-8");
  const sf = ts.createSourceFile(
    absPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ext === ".tsx" ? ts.ScriptKind.TSX : ext === ".jsx" ? ts.ScriptKind.JSX : ts.ScriptKind.TS
  );

  const specifiers: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return specifiers;
}

function collectCodebaseFiles(
  entryRelPath: string,
  rootDir: string,
  options: { componentsOnly: boolean }
): BundledFile[] {
  const paths = loadTsConfigPaths(rootDir);
  const visited = new Set<string>();
  const queue: string[] = [entryRelPath];
  const collectedRelPaths: string[] = [];

  while (queue.length > 0) {
    const currentRel = queue.shift()!;
    if (visited.has(currentRel)) continue;
    visited.add(currentRel);
    collectedRelPaths.push(currentRel);

    const currentAbs = path.resolve(rootDir, currentRel);
    const importSpecifiers = extractImportsFromFile(currentAbs);

    for (const spec of importSpecifiers) {
      const resolved = resolveImportSpecifier(spec, currentAbs, rootDir, paths);
      if (resolved && !visited.has(resolved)) {
        if (options.componentsOnly) {
          const isComponent =
            resolved.startsWith("components/") ||
            resolved.includes("/components/") ||
            resolved.endsWith(".tsx") ||
            resolved.endsWith(".jsx");
          if (!isComponent) continue;
        }
        queue.push(resolved);
      }
    }
  }

  // Sort files logically:
  // 1. Entry file always first
  // 2. Sub-components (components/)
  // 3. App routes / pages
  // 4. Lib / utilities
  // 5. Config / other
  const entry = collectedRelPaths[0];
  const others = collectedRelPaths.slice(1);

  others.sort((a, b) => {
    const score = (p: string) => {
      if (p.startsWith("components/ui/")) return 2;
      if (p.startsWith("components/")) return 1;
      if (p.startsWith("lib/")) return 3;
      if (p.startsWith("app/")) return 4;
      return 5;
    };
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  const finalRelPaths = [entry, ...others];

  return finalRelPaths.map((rel) => {
    const absPath = path.resolve(rootDir, rel);
    const content = fs.readFileSync(absPath, "utf-8");
    const lines = content.split("\n").length;
    const bytes = Buffer.byteLength(content, "utf-8");
    const role = determineRole(rel, rel === entry);
    const language = getLanguage(rel);

    return {
      relPath: rel,
      absPath,
      content,
      lineCount: lines,
      byteCount: bytes,
      role,
      language,
    };
  });
}

function buildMarkdownDocument(
  files: BundledFile[],
  entryRelPath: string,
  watchMode: boolean
): string {
  const timestamp = new Date().toISOString().replace("T", " ").replace(/\..+/, " UTC");
  const totalLines = files.reduce((acc, f) => acc + f.lineCount, 0);
  const totalKb = (
    files.reduce((acc, f) => acc + f.byteCount, 0) / 1024
  ).toFixed(1);

  const lines: string[] = [];

  // Header & Metadata
  lines.push(`# Code Bundle: \`${entryRelPath}\``);
  lines.push("");
  lines.push(`> **Primary Entry:** \`${entryRelPath}\`  `);
  lines.push(`> **Total Files Included:** ${files.length}  `);
  lines.push(`> **Total Lines of Code:** ${totalLines.toLocaleString()} lines  `);
  lines.push(`> **Total Size:** ${totalKb} KB  `);
  lines.push(`> **Last Updated:** ${timestamp}  `);
  lines.push(
    `> **Mode:** ${watchMode ? "🔴 Real-Time Watch Active (Auto-replaces on save)" : "⚪ Single Export"}`
  );
  lines.push("");

  // Table of Contents
  lines.push("## Table of Contents & File Register");
  lines.push("");
  lines.push("| # | Relative File Path | Role | Lines | Size |");
  lines.push("|---|--------------------|------|-------|------|");

  files.forEach((file, idx) => {
    const anchor = `${idx + 1}-${file.relPath
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    const sizeKb = (file.byteCount / 1024).toFixed(1);
    lines.push(
      `| ${idx + 1} | [\`${file.relPath}\`](#${anchor}) | **${file.role}** | ${file.lineCount} | ${sizeKb} KB |`
    );
  });

  lines.push("");
  lines.push("---");
  lines.push("");

  // Code Sections
  files.forEach((file, idx) => {
    const fence = getSafeFence(file.content);
    const sizeKb = (file.byteCount / 1024).toFixed(1);
    const anchor = `${idx + 1}-${file.relPath
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

    lines.push(`<a id="${anchor}"></a>`);
    lines.push(`## ${idx + 1}. \`${file.relPath}\``);
    lines.push("");
    lines.push(`> **Relative Path:** \`${file.relPath}\`  `);
    lines.push(`> **Role:** ${file.role}  `);
    lines.push(`> **Language:** \`${file.language}\` | **Lines:** ${file.lineCount} | **Size:** ${sizeKb} KB`);
    lines.push("");
    lines.push(`${fence}${file.language}`);
    lines.push(file.content);
    lines.push(fence);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

function writeMarkdownBundle(
  entryRelPath: string,
  outFileName: string,
  options: { componentsOnly: boolean; watch: boolean }
): { files: BundledFile[]; outPath: string } {
  const files = collectCodebaseFiles(entryRelPath, ROOT_DIR, {
    componentsOnly: options.componentsOnly,
  });
  const markdown = buildMarkdownDocument(files, entryRelPath, options.watch);
  const outPath = path.resolve(ROOT_DIR, outFileName);

  fs.writeFileSync(outPath, markdown, "utf-8");
  return { files, outPath };
}

async function main() {
  const cliOptions = parseCliArgs();

  let entryInput = cliOptions.entryPath;

  if (!entryInput) {
    console.log("==========================================================");
    console.log("📦 Codebase Page & Dependency Bundler");
    console.log("==========================================================");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      const answer = await rl.question(
        "Enter the relative file path to bundle (e.g., app/explore/page.tsx): "
      );
      entryInput = answer.trim();
    } finally {
      rl.close();
    }
  }

  if (!entryInput) {
    console.error("❌ Error: No file path provided.");
    process.exit(1);
  }

  const resolvedEntry = resolveEntryFile(entryInput, ROOT_DIR);
  if (!resolvedEntry) {
    console.error(`❌ Error: Could not find file matching: "${entryInput}"`);
    console.error("   Make sure the path is relative to the project root (e.g. app/explore/page.tsx).");
    process.exit(1);
  }

  console.log(`\n🔍 Analyzing dependency tree for: ${resolvedEntry}`);
  const { files, outPath } = writeMarkdownBundle(resolvedEntry, cliOptions.outFile, {
    componentsOnly: cliOptions.componentsOnly,
    watch: cliOptions.watch,
  });

  const totalLines = files.reduce((acc, f) => acc + f.lineCount, 0);
  console.log(`✓ Generated ${cliOptions.outFile} with ${files.length} files (${totalLines.toLocaleString()} total lines)`);
  console.log("Included files:");
  files.forEach((f, i) => {
    console.log(`  ${i + 1}. [${f.role}] ${f.relPath} (${f.lineCount} lines)`);
  });

  if (!cliOptions.watch) {
    console.log(`\n🎉 Done! Bundled to ${outPath}`);
    return;
  }

  // Real-Time Watcher Mode
  console.log("\n==========================================================");
  console.log(`🔴 REAL-TIME WATCH MODE ACTIVE on ${cliOptions.outFile}`);
  console.log("   Editing any included component or import will automatically");
  console.log("   regenerate and replace the contents of this file in real-time.");
  console.log("   Press Ctrl+C to exit.");
  console.log("==========================================================\n");

  const activeWatchers = new Map<string, fs.FSWatcher>();
  let debounceTimer: NodeJS.Timeout | null = null;
  let currentWatchedFiles = new Set<string>();

  function updateWatchers(newFiles: BundledFile[]) {
    const newPaths = new Set(newFiles.map((f) => f.absPath));

    // Remove obsolete watchers
    for (const [absPath, watcher] of activeWatchers.entries()) {
      if (!newPaths.has(absPath)) {
        watcher.close();
        activeWatchers.delete(absPath);
      }
    }

    // Add new watchers
    for (const file of newFiles) {
      if (!activeWatchers.has(file.absPath)) {
        try {
          const watcher = fs.watch(file.absPath, (eventType) => {
            handleFileEvent(file.relPath, eventType);
          });
          watcher.on("error", () => {
            // Re-watch on next cycle
            watcher.close();
            activeWatchers.delete(file.absPath);
          });
          activeWatchers.set(file.absPath, watcher);
        } catch (err) {
          // File might be temporarily locked or removed
        }
      }
    }
    currentWatchedFiles = newPaths;
  }

  function handleFileEvent(changedRelPath: string, eventType: string) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const timeStr = new Date().toLocaleTimeString("en-KE", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const res = writeMarkdownBundle(resolvedEntry!, cliOptions.outFile, {
          componentsOnly: cliOptions.componentsOnly,
          watch: true,
        });
        updateWatchers(res.files);
        const count = res.files.length;
        const lines = res.files.reduce((a, b) => a + b.lineCount, 0);
        console.log(
          `[${timeStr}] ↻ Change detected in ${changedRelPath} (${eventType}) → Updated ${cliOptions.outFile} (${count} files, ${lines.toLocaleString()} lines)`
        );
      } catch (err: any) {
        console.error(`⚠️ Error updating bundle: ${err?.message || err}`);
      }
    }, 150);
  }

  // Initial watcher setup
  updateWatchers(files);

  const cleanup = () => {
    console.log("\nStopping file watchers. Goodbye!");
    for (const watcher of activeWatchers.values()) {
      watcher.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
