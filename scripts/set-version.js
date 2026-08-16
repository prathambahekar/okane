import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const newVersion = process.argv[2]?.trim().replace(/^v/, '');

if (!newVersion) {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  console.log(`\n📌 Current App Version: v${pkg.version}`);
  console.log(`\nUsage:`);
  console.log(`  npm run set-version <new-version>`);
  console.log(`  npm run bump <new-version>`);
  console.log(`\nExample:`);
  console.log(`  npm run set-version 0.9.1`);
  console.log(`  npm run set-version 1.0.0-beta.1\n`);
  process.exit(0);
}

const semverRegex = /^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.-]+)?$/;
if (!semverRegex.test(newVersion)) {
  console.error(`❌ Invalid version format: "${newVersion}". Please use semver format (e.g. 0.9.1, 1.0.0).`);
  process.exit(1);
}

console.log(`\n🚀 Updating App Version to v${newVersion}...\n`);

// 1. Update package.json
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  content.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  ✓ Updated package.json -> version: "${newVersion}"`);
}

// 2. Update public/settings.json
const settingsJsonPath = path.join(rootDir, 'public', 'settings.json');
if (fs.existsSync(settingsJsonPath)) {
  const content = JSON.parse(fs.readFileSync(settingsJsonPath, 'utf8'));
  content.appVersion = newVersion;
  fs.writeFileSync(settingsJsonPath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  ✓ Updated public/settings.json -> appVersion: "${newVersion}"`);
}

// 3. Update android/app/build.gradle
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');

  // Update versionName
  gradleContent = gradleContent.replace(/versionName\s+["'].*?["']/, `versionName "${newVersion}"`);

  // Auto-increment versionCode
  gradleContent = gradleContent.replace(/versionCode\s+(\d+)/, (match, code) => {
    const nextCode = parseInt(code, 10) + 1;
    console.log(`  ✓ Bumped Android versionCode -> ${nextCode}`);
    return `versionCode ${nextCode}`;
  });

  fs.writeFileSync(gradlePath, gradleContent);
  console.log(`  ✓ Updated android/app/build.gradle -> versionName "${newVersion}"`);
}

console.log(`\n✅ Version successfully set to v${newVersion}!`);
console.log(`   Frontend TypeScript/React components automatically pick up the new version.\n`);
