import fs from 'fs';
import path from 'path';

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

function fixSyntaxErrors() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = walkDir(srcDir);

  let fixedFiles = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let nextContent = content;

    // Fix 'var(--radius-full)'99, 'var(--radius-full)'9, 'var(--token)'99 etc.
    nextContent = nextContent.replace(/'var\((--[a-zA-Z0-9_-]+)\)'[0-9.]+/g, "'var($1)'");
    nextContent = nextContent.replace(/"var\((--[a-zA-Z0-9_-]+)\)"[0-9.]+/g, '"var($1)"');
    nextContent = nextContent.replace(/`var\((--[a-zA-Z0-9_-]+)\)`[0-9.]+/g, '`var($1)`');
    nextContent = nextContent.replace(/var\((--[a-zA-Z0-9_-]+)\)[0-9.]+/g, 'var($1)');

    if (nextContent !== content) {
      fs.writeFileSync(file, nextContent, 'utf-8');
      fixedFiles++;
      console.log(`Fixed syntax in ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log(`Cleaned up corrupted token strings in ${fixedFiles} files.`);
}

fixSyntaxErrors();
