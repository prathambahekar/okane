import fs from 'fs';
import path from 'path';

interface Violation {
  file: string;
  line: number;
  type: 'Color' | 'Typography' | 'Radius' | 'Spacing' | 'Shadow';
  property: string;
  value: string;
  suggestedToken: string;
}

interface Stats {
  tokenized: number;
  hardcoded: number;
  exceptions: number;
}

const stats: Record<'colors' | 'typography' | 'radius' | 'spacing' | 'shadows', Stats> = {
  colors: { tokenized: 0, hardcoded: 0, exceptions: 0 },
  typography: { tokenized: 0, hardcoded: 0, exceptions: 0 },
  radius: { tokenized: 0, hardcoded: 0, exceptions: 0 },
  spacing: { tokenized: 0, hardcoded: 0, exceptions: 0 },
  shadows: { tokenized: 0, hardcoded: 0, exceptions: 0 },
};

const violations: Violation[] = [];
const fileStats: Map<string, { tokenized: number; hardcoded: number; violations: number }> = new Map();

// Whitelisted files / patterns for intentional brand or theme definitions
const BRAND_FILES = [
  'BrandIcons.tsx',
  'WalletIconRenderer.tsx',
  'brand-icons.css',
  'tokens.css', // Defines the tokens
  'theme.ts',   // MUI theme mapping
];

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function suggestRadius(val: string): string {
  const normalized = val.endsWith('px') || val.endsWith('%') ? val : `${val}px`;
  if (normalized === '9999px' || val === '9999') return '--radius-full';
  if (normalized === '50%') return '50%';
  const num = parseInt(val, 10);
  if (isNaN(num)) return '--radius-md';
  if (num <= 6) return '--radius-xs';
  if (num <= 9) return '--radius-sm';
  if (num <= 13) return '--radius-md';
  if (num <= 17) return '--radius-lg';
  if (num <= 22) return '--radius-xl';
  if (num <= 30) return '--radius-2xl';
  return '--radius-full';
}

function suggestFs(val: string): string {
  const num = parseFloat(val);
  if (isNaN(num)) return '--fs-base';
  if (num <= 11.5) return '--fs-caption';
  if (num <= 12.5) return '--fs-xs';
  if (num <= 13.5) return '--fs-sm';
  if (num <= 14.5) return '--fs-base';
  if (num <= 15.5) return '--fs-md';
  if (num <= 17) return '--fs-lg';
  if (num <= 22) return '--fs-xl';
  if (num <= 28) return '--fs-hero-sm';
  return '--fs-hero';
}

function auditFile(filePath: string) {
  const relPath = path.relative(process.cwd(), filePath);
  const isBrandFile = BRAND_FILES.some(b => relPath.endsWith(b));
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let fileTokenCount = 0;
  let fileHardcodedCount = 0;

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    // Check token usage
    const varMatches = lineText.match(/var\(--[a-zA-Z0-9_-]+\)/g);
    if (varMatches) {
      for (const v of varMatches) {
        fileTokenCount++;
        if (v.includes('--fs-') || v.includes('--fw-')) {
          stats.typography.tokenized++;
        } else if (v.includes('--radius-')) {
          stats.radius.tokenized++;
        } else if (v.includes('--space-') || v.includes('--pad-') || v.includes('--margin-')) {
          stats.spacing.tokenized++;
        } else if (v.includes('--shadow-') || v.includes('--shadow')) {
          stats.shadows.tokenized++;
        } else {
          stats.colors.tokenized++;
        }
      }
    }

    // If it's a known brand / tokens definition file, skip violations or count as intentional
    if (isBrandFile) {
      if (lineText.match(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/)) {
        stats.colors.exceptions++;
      }
      return;
    }

    // Check for hard-coded colors in regular files
    const colorMatches = lineText.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g);
    if (colorMatches) {
      for (const color of colorMatches) {
        // Exclude 0 0 0 or purely transparent black/white overlay if appropriate, but flag raw theme colors
        if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
          continue;
        }
        // Check if this line is an intentional SVG path or brand logo
        if (lineText.includes('fill=') || lineText.includes('stroke=') || lineText.includes('logoKey') || lineText.includes('presetGroup')) {
          stats.colors.exceptions++;
        } else {
          stats.colors.hardcoded++;
          fileHardcodedCount++;
          let suggested = '--text, --border, or --surface';
          if (color.toLowerCase().includes('ef4444') || color.toLowerCase().includes('239, 68, 68')) suggested = '--debit';
          else if (color.toLowerCase().includes('10b981') || color.toLowerCase().includes('16, 185, 129') || color.toLowerCase().includes('22c55e')) suggested = '--credit';
          else if (color.toLowerCase().includes('f59e0b') || color.toLowerCase().includes('245, 158, 11')) suggested = '--amber';
          else if (color.toLowerCase().includes('6366f1') || color.toLowerCase().includes('99, 102, 241')) suggested = '--accent';
          else if (color.toLowerCase().includes('ffffff') || color === '#fff') suggested = '--surface, --text, or --accent-contrast';
          else if (color.toLowerCase().includes('000000') || color === '#000') suggested = '--bg or --text';

          violations.push({
            file: relPath,
            line: lineNum,
            type: 'Color',
            property: 'color/background/border',
            value: color,
            suggestedToken: suggested,
          });
        }
      }
    }

    // Check for raw border-radius (e.g. borderRadius: 12 or border-radius: 12px)
    const radiusInline = lineText.match(/borderRadius:\s*([0-9]+|'[^']+'|"[^"]+")/);
    const radiusCss = lineText.match(/border-radius:\s*([0-9]+px|[0-9]+%)/);
    if (radiusInline || radiusCss) {
      const val = radiusInline ? radiusInline[1].replace(/['"]/g, '') : radiusCss![1];
      if (!val.startsWith('var(') && val !== '0') {
        stats.radius.hardcoded++;
        fileHardcodedCount++;
        violations.push({
          file: relPath,
          line: lineNum,
          type: 'Radius',
          property: 'borderRadius',
          value: val,
          suggestedToken: suggestRadius(val),
        });
      }
    }

    // Check for raw font-size
    const fsInline = lineText.match(/fontSize:\s*([0-9.]+|'[^']+'|"[^"]+")/);
    const fsCss = lineText.match(/font-size:\s*([0-9.]+px)/);
    if (fsInline || fsCss) {
      const val = fsInline ? fsInline[1].replace(/['"]/g, '') : fsCss![1];
      if (!val.startsWith('var(') && !val.includes('inherit')) {
        stats.typography.hardcoded++;
        fileHardcodedCount++;
        violations.push({
          file: relPath,
          line: lineNum,
          type: 'Typography',
          property: 'fontSize',
          value: val,
          suggestedToken: suggestFs(val),
        });
      }
    }

    // Check for raw box-shadow
    const shadowInline = lineText.match(/boxShadow:\s*('[^']+'|"[^"]+")/);
    const shadowCss = lineText.match(/box-shadow:\s*([^;]+);/);
    if (shadowInline || shadowCss) {
      const val = shadowInline ? shadowInline[1].replace(/['"]/g, '') : shadowCss![1];
      if (!val.startsWith('var(') && val !== 'none') {
        stats.shadows.hardcoded++;
        fileHardcodedCount++;
        violations.push({
          file: relPath,
          line: lineNum,
          type: 'Shadow',
          property: 'boxShadow',
          value: val,
          suggestedToken: '--shadow, --shadow-sm, --shadow-md, or --shadow-lg',
        });
      }
    }
  });

  fileStats.set(relPath, {
    tokenized: fileTokenCount,
    hardcoded: fileHardcodedCount,
    violations: fileHardcodedCount,
  });
}

function runAudit() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = walkDir(srcDir);

  for (const file of files) {
    auditFile(file);
  }

  const totalTokens = stats.colors.tokenized + stats.typography.tokenized + stats.radius.tokenized + stats.spacing.tokenized + stats.shadows.tokenized;
  const totalHardcoded = stats.colors.hardcoded + stats.typography.hardcoded + stats.radius.hardcoded + stats.shadows.hardcoded;
  const healthPercent = ((totalTokens / (totalTokens + totalHardcoded)) * 100).toFixed(1);

  console.log('\n======================================================');
  console.log('              OKANE THEME AUDIT & REPORT              ');
  console.log('======================================================\n');

  console.log(`📊 SYSTEM THEME HEALTH: ${healthPercent}% TOKENIZED (${totalTokens} tokens vs ${totalHardcoded} hardcoded values)\n`);

  const calcRate = (tok: number, hard: number) => {
    const sum = tok + hard;
    if (sum === 0) return '100.0%';
    return `${((tok / sum) * 100).toFixed(1)}%`;
  };

  console.log('🎨 COLOR SYSTEM:');
  console.log(`   • Tokenized usages:      ${stats.colors.tokenized}`);
  console.log(`   • Hard-coded violations: ${stats.colors.hardcoded}`);
  console.log(`   • Intentional/Brand:     ${stats.colors.exceptions}`);
  console.log(`   • Compliance Rate:       ${calcRate(stats.colors.tokenized, stats.colors.hardcoded)}\n`);

  console.log('✍️  TYPOGRAPHY SYSTEM:');
  console.log(`   • Tokenized usages:      ${stats.typography.tokenized}`);
  console.log(`   • Hard-coded fontSizes:  ${stats.typography.hardcoded}`);
  console.log(`   • Compliance Rate:       ${calcRate(stats.typography.tokenized, stats.typography.hardcoded)}\n`);

  console.log('🔘 BORDER RADIUS SYSTEM:');
  console.log(`   • Tokenized usages:      ${stats.radius.tokenized}`);
  console.log(`   • Hard-coded radii:      ${stats.radius.hardcoded}`);
  console.log(`   • Compliance Rate:       ${calcRate(stats.radius.tokenized, stats.radius.hardcoded)}\n`);

  console.log('📐 SPACING SYSTEM:');
  console.log(`   • Tokenized usages:      ${stats.spacing.tokenized}\n`);

  console.log('☁️  ELEVATION & SHADOW SYSTEM:');
  console.log(`   • Tokenized usages:      ${stats.shadows.tokenized}`);
  console.log(`   • Hard-coded shadows:    ${stats.shadows.hardcoded}`);
  console.log(`   • Compliance Rate:       ${calcRate(stats.shadows.tokenized, stats.shadows.hardcoded)}\n`);

  // Top files by hardcoded violations
  const sortedFiles = Array.from(fileStats.entries()).sort((a, b) => b[1].violations - a[1].violations);
  const cleanFiles = sortedFiles.filter(([pathStr, f]) => f.violations === 0 && f.tokenized > 0 && !BRAND_FILES.some(b => pathStr.endsWith(b)));

  console.log('------------------------------------------------------');
  console.log('🏆 100% COMPLIANT / FULLY TOKENIZED FILES:');
  console.log('------------------------------------------------------');
  cleanFiles.forEach(([filePath, f]) => {
    console.log(`   ✅ ${filePath} (${f.tokenized} tokens used, 0 violations)`);
  });
  console.log();

  console.log('------------------------------------------------------');
  console.log('📌 TOP FILES NEEDING MIGRATION (BY VIOLATION COUNT):');
  console.log('------------------------------------------------------');
  sortedFiles.filter(([, f]) => f.violations > 0).slice(0, 15).forEach(([filePath, f]) => {
    const rate = calcRate(f.tokenized, f.hardcoded);
    console.log(`   ⚠️  ${filePath.padEnd(45)} | Violations: ${String(f.violations).padStart(4)} | Tokens: ${String(f.tokenized).padStart(4)} | Rate: ${rate}`);
  });
  console.log();

  console.log('------------------------------------------------------');
  console.log('📁 DIRECTORY COMPLIANCE BREAKDOWN:');
  console.log('------------------------------------------------------');
  const dirMap = new Map<string, { tokenized: number; hardcoded: number }>();
  sortedFiles.forEach(([filePath, f]) => {
    const dir = path.dirname(filePath);
    const existing = dirMap.get(dir) || { tokenized: 0, hardcoded: 0 };
    existing.tokenized += f.tokenized;
    existing.hardcoded += f.hardcoded;
    dirMap.set(dir, existing);
  });
  Array.from(dirMap.entries())
    .sort((a, b) => (b[1].tokenized + b[1].hardcoded) - (a[1].tokenized + a[1].hardcoded))
    .forEach(([dir, d]) => {
      console.log(`   📂 ${dir.padEnd(35)} | Compliance: ${calcRate(d.tokenized, d.hardcoded).padStart(6)} | Tokens: ${String(d.tokenized).padStart(4)} | Hardcoded: ${String(d.hardcoded).padStart(4)}`);
    });
  console.log('\n======================================================\n');
}

runAudit();
