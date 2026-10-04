// scripts/release.js
// Safe release script for Vanya Downloader
// Usage: node scripts/release.js patch|minor|major

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function runOutput(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown version bump type: ${type}`);
}

async function release() {
  const bumpType = process.argv[2];
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error('Usage: node scripts/release.js patch|minor|major');
    process.exit(1);
  }

  // 1. Verify git repository
  try {
    runOutput('git rev-parse --is-inside-work-tree');
  } catch {
    console.error('ERROR: Not inside a git repository.');
    process.exit(1);
  }

  // 2. Verify git is configured with a remote
  try {
    runOutput('git remote get-url origin');
  } catch {
    console.error('ERROR: No git remote "origin" configured. Run: git remote add origin https://github.com/prashant-kuntal/vanya-downloader.git');
    process.exit(1);
  }

  // 3. Check for uncommitted changes
  const status = runOutput('git status --porcelain');
  if (status) {
    console.error('ERROR: You have uncommitted changes. Please commit or stash them before releasing.');
    console.error(status);
    process.exit(1);
  }

  // 4. Run TypeScript check
  console.log('\n📋 Running TypeScript check...');
  try {
    run('npx tsc --noEmit');
  } catch {
    console.error('ERROR: TypeScript check failed. Fix errors before releasing.');
    process.exit(1);
  }

  // 5. Run tests
  console.log('\n🧪 Running tests...');
  try {
    run('npx vitest run');
  } catch {
    console.error('ERROR: Tests failed. Fix failing tests before releasing.');
    process.exit(1);
  }

  // 6. Read current version and bump
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);

  console.log(`\n🔖 Bumping version: ${oldVersion} → ${newVersion}`);

  // 7. Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 8. Update CHANGELOG.md
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const date = new Date().toISOString().split('T')[0];
  const newEntry = `## [${newVersion}] - ${date}\n\n### Changed\n- Version bump: ${oldVersion} → ${newVersion} (${bumpType} release)\n\n`;

  if (fs.existsSync(changelogPath)) {
    const existing = fs.readFileSync(changelogPath, 'utf8');
    // Insert after the first heading
    const insertAt = existing.indexOf('\n## ');
    if (insertAt !== -1) {
      fs.writeFileSync(changelogPath, existing.slice(0, insertAt + 1) + newEntry + existing.slice(insertAt + 1), 'utf8');
    } else {
      fs.writeFileSync(changelogPath, existing + '\n' + newEntry, 'utf8');
    }
  } else {
    fs.writeFileSync(changelogPath, `# Changelog\n\nAll notable changes to Vanya Downloader.\n\n${newEntry}`, 'utf8');
  }

  // 9. Commit version bump
  run(`git add package.json CHANGELOG.md`);
  run(`git commit -m "chore: release v${newVersion}"`);

  // 10. Create and push tag
  const tag = `v${newVersion}`;
  run(`git tag ${tag}`);

  console.log(`\n🚀 Pushing commit and tag ${tag} to GitHub...`);
  run('git push origin main');
  run(`git push origin ${tag}`);

  console.log(`\n✅ Release v${newVersion} successfully tagged and pushed!`);
  console.log(`   GitHub Actions will now build and publish the Windows installer.`);
  console.log(`   Watch progress at: https://github.com/prashant-kuntal/vanya-downloader/actions`);
}

release().catch((err) => {
  console.error('Release failed:', err.message || err);
  process.exit(1);
});
