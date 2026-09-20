import fs from 'fs';

function inspectViolations(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  console.log(`=== Violations in ${filePath} ===`);
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Check color / shadow / radius / fs
    const colorMatches = line.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g);
    if (colorMatches) {
      for (const c of colorMatches) {
        if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' && !line.includes('fill=') && !line.includes('stroke=')) {
          console.log(`[L${lineNum}] Color: ${c} | Line: ${line.trim().slice(0, 80)}`);
        }
      }
    }
  });
}

const target = process.argv[2];
if (target) {
  inspectViolations(target);
}
