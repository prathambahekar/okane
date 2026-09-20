import fs from 'fs';
import path from 'path';

const BRAND_FILES = [
  'BrandIcons.tsx',
  'WalletIconRenderer.tsx',
  'brand-icons.css',
  'tokens.css',
  'theme.ts',
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

function processCssContent(content: string): string {
  let res = content;

  // Clean var(--token, #hex) fallbacks
  res = res.replace(/var\((--[a-zA-Z0-9_-]+),\s*#[0-9a-fA-F]{3,8}\)/g, 'var($1)');
  res = res.replace(/var\((--[a-zA-Z0-9_-]+),\s*rgba?\([^)]+\)\)/g, 'var($1)');

  // Fix corrupted var(--radius-full)'99
  res = res.replace(/var\(--radius-full\)[0-9]+/g, 'var(--radius-full)');

  // Shadows
  res = res.replace(/box-shadow:\s*(?:0\s+16px\s+40px|0\s+25px\s+60px|0\s+-10px\s+40px|0\s+8px\s+32px|0\s+8px\s+26px|0\s+8px\s+24px|0\s+24px\s+60px|0\s+20px\s+50px)[^;!}]+(?=[;\s!}])/gi, 'box-shadow: var(--shadow-floating)');
  res = res.replace(/box-shadow:\s*(?:0\s+4px\s+20px|0\s+6px\s+20px|0\s+2px\s+10px)[^;!}]+(?=[;\s!}])/gi, 'box-shadow: var(--shadow-lg)');
  res = res.replace(/box-shadow:\s*(?:0\s+1px\s+2px|0\s+1px\s+3px|0\s+1px\s+4px|0\s+2px\s+8px\s+rgba\(0,\s*0,\s*0,\s*0\.02\))\s+rgba\([^)]+\)(?=[;\s!}])/gi, 'box-shadow: var(--shadow-sm)');
  res = res.replace(/box-shadow:\s*(?:0\s+2px\s+[4-8]px|0\s+4px\s+1[0-4]px)\s+rgba\([^)]+\)(?=[;\s!}])/gi, 'box-shadow: var(--shadow-md)');
  res = res.replace(/box-shadow:\s*(?:0\s+[6-8]px\s+1[6-9]px|0\s+10px\s+2[0-9]px)\s+rgba\([^)]+\)(?=[;\s!}])/gi, 'box-shadow: var(--shadow-lg)');

  // Gradients for segmented controls and hero cards
  res = res.replace(/linear-gradient\(180deg,\s*#27272a\s+0%,\s*#18181b\s+60%,\s*#09090b\s+100%\)/gi, 'var(--accent-gradient)');
  res = res.replace(/linear-gradient\(180deg,\s*#ffffff\s+0%,\s*#f4f4f5\s+55%,\s*#e4e4e7\s+100%\)/gi, 'var(--accent-gradient)');
  res = res.replace(/linear-gradient\(180deg,\s*rgba\(24,\s*24,\s*27,\s*0\.32\)\s+0%,\s*rgba\(24,\s*24,\s*27,\s*0\.16\)\s+100%\)/gi, 'var(--surface2)');
  res = res.replace(/linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.35\)\s+0%,\s*rgba\(255,\s*255,\s*255,\s*0\.15\)\s+100%\)/gi, 'var(--surface2)');
  res = res.replace(/linear-gradient\(180deg,\s*rgba\(24,\s*24,\s*27,\s*0\.60\)\s+0%,\s*rgba\(24,\s*24,\s*27,\s*0\.32\)\s+100%\)/gi, 'var(--surface3)');
  res = res.replace(/linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.65\)\s+0%,\s*rgba\(255,\s*255,\s*255,\s*0\.35\)\s+100%\)/gi, 'var(--surface3)');

  // Blue / Info / Accent variants
  res = res.replace(/(?:color|fill|stroke):\s*(?:#0284c7|#38bdf8|#0ea5e9|#2563eb|#3b82f6|#60a5fa)(?=[;\s!}])/g, 'color: var(--accent)');
  res = res.replace(/background(?:-color)?:\s*rgba\((?:2,\s*132,\s*199|14,\s*165,\s*233|37,\s*99,\s*235|59,\s*130,\s*246|25,\s*118,\s*210|56,\s*189,\s*248)[^)]+\)(?=[;\s!}])/g, 'background: var(--accent-soft)');
  res = res.replace(/border(?:-color)?:\s*1px\s+solid\s+rgba\((?:2,\s*132,\s*199|14,\s*165,\s*233|56,\s*189,\s*248|25,\s*118,\s*210)[^)]+\)(?=[;\s!}])/g, 'border: 1px solid var(--accent-border)');
  res = res.replace(/border-color:\s*rgba\((?:2,\s*132,\s*199|14,\s*165,\s*233|56,\s*189,\s*248|25,\s*118,\s*210)[^)]+\)(?=[;\s!}])/g, 'border-color: var(--accent-border)');

  // Credit / Green variants
  res = res.replace(/(?:color|fill|stroke):\s*(?:#4ade80|#22c55e|#16a34a|#66bb6a)(?=[;\s!}])/g, 'color: var(--credit)');
  res = res.replace(/background(?:-color)?:\s*rgba\((?:74,\s*222,\s*128|34,\s*197,\s*94|102,\s*187,\s*106|22,\s*163,\s*74)[^)]+\)(?=[;\s!}])/g, 'background: var(--credit-bg)');
  res = res.replace(/border(?:-color)?:\s*1px\s+solid\s+rgba\((?:74,\s*222,\s*128|34,\s*197,\s*94|102,\s*187,\s*106|22,\s*163,\s*74)[^)]+\)(?=[;\s!}])/g, 'border: 1px solid var(--credit-border)');
  res = res.replace(/border-color:\s*rgba\((?:74,\s*222,\s*128|34,\s*197,\s*94|102,\s*187,\s*106|22,\s*163,\s*74)[^)]+\)(?=[;\s!}])/g, 'border-color: var(--credit-border)');

  // Debit / Red variants
  res = res.replace(/(?:color|fill|stroke):\s*(?:#fb7185|#e11d48|#f43f5e|#ef4444|#ef5350|#dc2626)(?=[;\s!}])/g, 'color: var(--debit)');
  res = res.replace(/background(?:-color)?:\s*rgba\((?:244,\s*63,\s*94|239,\s*68,\s*68|239,\s*83,\s*80|220,\s*38,\s*38)[^)]+\)(?=[;\s!}])/g, 'background: var(--debit-bg)');
  res = res.replace(/border(?:-color)?:\s*1px\s+solid\s+rgba\((?:244,\s*63,\s*94|239,\s*68,\s*68|239,\s*83,\s*80|220,\s*38,\s*38)[^)]+\)(?=[;\s!}])/g, 'border: 1px solid var(--debit-border)');
  res = res.replace(/border-color:\s*rgba\((?:244,\s*63,\s*94|239,\s*68,\s*68|239,\s*83,\s*80|220,\s*38,\s*38)[^)]+\)(?=[;\s!}])/g, 'border-color: var(--debit-border)');

  // Amber variants
  res = res.replace(/(?:color|fill|stroke):\s*(?:#fef08a|#fbbf24|#f59e0b|#d97706)(?=[;\s!}])/g, 'color: var(--amber)');
  res = res.replace(/background(?:-color)?:\s*rgba\((?:251,\s*191,\s*36|245,\s*158,\s*11|217,\s*119,\s*6)[^)]+\)(?=[;\s!}])/g, 'background: var(--amber-bg)');
  res = res.replace(/border(?:-color)?:\s*1px\s+solid\s+rgba\((?:251,\s*191,\s*36|245,\s*158,\s*11|217,\s*119,\s*6)[^)]+\)(?=[;\s!}])/g, 'border: 1px solid var(--amber-border)');
  res = res.replace(/border-color:\s*rgba\((?:251,\s*191,\s*36|245,\s*158,\s*11|217,\s*119,\s*6)[^)]+\)(?=[;\s!}])/g, 'border-color: var(--amber-border)');

  // Slate / Gray text & backgrounds
  res = res.replace(/color:\s*(?:#cbd5e1|#94a3b8|#64748b|#525666|#8a8e9e|#475569|#7d8191|#555770|#8e8e93|#6c7185|#374151)(?=[;\s!}])/g, 'color: var(--text-2)');
  res = res.replace(/color:\s*(?:#0f172a|#111111|#0b0c10|#000000|#0f1015)(?=[;\s!}])/g, 'color: var(--text)');
  res = res.replace(/background(?:-color)?:\s*rgba\((?:148,\s*163,\s*184|100,\s*116,\s*139|125,\s*125,\s*125)[^)]+\)(?=[;\s!}])/g, 'background: var(--surface2)');
  res = res.replace(/border(?:-color)?:\s*1px\s+solid\s+rgba\((?:148,\s*163,\s*184|100,\s*116,\s*139|125,\s*125,\s*125)[^)]+\)(?=[;\s!}])/g, 'border: 1px solid var(--border)');
  res = res.replace(/background(?:-color)?:\s*(?:#131417|#17181c|#121214|#0d0d0f|#262936|#f1f3f7|#e6e8ee)(?=[;\s!}])/g, 'background-color: var(--surface2)');

  // Light transparent backgrounds & hovers
  res = res.replace(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.0[2-9]\)(?=[;\s!}])/g, 'background-color: var(--accent-soft)');
  res = res.replace(/background(?:-color)?:\s*rgba\(0,\s*0,\s*0,\s*0\.0[2-6]\)(?=[;\s!}])/g, 'background-color: var(--accent-soft)');
  res = res.replace(/background(?:-color)?:\s*rgba\(24,\s*24,\s*27,\s*0\.0[4-9]\)(?=[;\s!}])/g, 'background-color: var(--surface2)');
  res = res.replace(/background(?:-color)?:\s*rgba\(24,\s*24,\s*27,\s*0\.1[0-8]\)(?=[;\s!}])/g, 'background-color: var(--surface2)');
  res = res.replace(/background(?:-color)?:\s*rgba\(255,\s*255,\s*255,\s*0\.1[0-8]\)(?=[;\s!}])/g, 'background-color: var(--surface2)');

  // Transparent border colors
  res = res.replace(/border(?:-color)?:\s*1px\s+solid\s+rgba\((?:255,\s*255,\s*255|0,\s*0,\s*0|24,\s*24,\s*27),\s*0\.(?:0[7-9]|1[0-9]|2[0-5])\)(?=[;\s!}])/g, 'border: 1px solid var(--border)');
  res = res.replace(/border-color:\s*rgba\((?:255,\s*255,\s*255|0,\s*0,\s*0|24,\s*24,\s*27),\s*0\.(?:0[7-9]|1[0-9]|2[0-5])\)(?=[;\s!}])/g, 'border-color: var(--border)');

  return res;
}

function processTsxContent(content: string): string {
  let res = content;

  // Clean var(--token, #hex) or var(--token, rgba(...)) in strings
  res = res.replace(/var\((--[a-zA-Z0-9_-]+),\s*#[0-9a-fA-F]{3,8}\)/g, 'var($1)');
  res = res.replace(/var\((--[a-zA-Z0-9_-]+),\s*rgba?\([^)]+\)\)/g, 'var($1)');
  res = res.replace(/var\((--[a-zA-Z0-9_-]+),\s*['"][^'"]+['"]\)/g, 'var($1)');

  // Fix corrupted var(--radius-full)'99
  res = res.replace(/var\(--radius-full\)[0-9]+/g, 'var(--radius-full)');

  // Colors in inline styles
  res = res.replace(/color:\s*['"](?:#10b981|#34d399|#059669|#15803d|#16a34a|#2e7d32|#4ade80)['"]/gi, "color: 'var(--credit)'");
  res = res.replace(/color:\s*['"](?:#ef4444|#f87171|#dc2626|#b91c1c|#d32f2f|#f43f5e|#fb7185|#e11d48)['"]/gi, "color: 'var(--debit)'");
  res = res.replace(/color:\s*['"](?:#f59e0b|#fbbf24|#d97706|#b45309|#fef08a)['"]/gi, "color: 'var(--amber)'");
  res = res.replace(/color:\s*['"](?:#6366f1|#4f46e5|#818cf8|#7c3aed|#8b5cf6|#a78bfa|#c4b5fd|#0284c7|#38bdf8|#0ea5e9|#2563eb|#3b82f6)['"]/gi, "color: 'var(--accent)'");
  res = res.replace(/color:\s*['"](?:#71717a|#a1a1aa|#9ca3af|#94a3b8|#64748b|#8e8e93|#8a8e9e|#555770)['"]/gi, "color: 'var(--text-3)'");
  res = res.replace(/color:\s*['"](?:#52525b|#d4d4d8|#e4e4e7|#cbd5e1|#525666|#475569)['"]/gi, "color: 'var(--text-2)'");

  return res;
}

function runMigration() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = walkDir(srcDir);

  let updatedCount = 0;
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    if (BRAND_FILES.some(b => rel.endsWith(b))) continue;

    const content = fs.readFileSync(file, 'utf-8');
    let nextContent = content;

    if (file.endsWith('.css')) {
      nextContent = processCssContent(nextContent);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      nextContent = processTsxContent(nextContent);
    }

    if (nextContent !== content) {
      fs.writeFileSync(file, nextContent, 'utf-8');
      updatedCount++;
      console.log(`Updated ${rel}`);
    }
  }

  console.log(`Completed tokenizing ${updatedCount} files.`);
}

runMigration();
