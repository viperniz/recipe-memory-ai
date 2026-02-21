// Cross-browser build script for Video Memory AI extension
// Produces dist/chrome/ and dist/firefox/ directories + ZIP files

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'extension');
const DIST_DIR = path.join(__dirname, 'dist');
const CHROME_DIR = path.join(DIST_DIR, 'chrome');
const FIREFOX_DIR = path.join(DIST_DIR, 'firefox');

// --- Helpers ---

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmDirSync(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function createZip(sourceDir, zipPath) {
  // Use tar on Windows Git Bash or PowerShell Compress-Archive
  const zipName = path.basename(zipPath);
  const zipDir = path.dirname(zipPath);

  try {
    // Try using PowerShell (works on Windows)
    const psCmd = `powershell -Command "Compress-Archive -Path '${sourceDir}${path.sep}*' -DestinationPath '${zipPath}' -Force"`;
    execSync(psCmd, { stdio: 'pipe' });
    return true;
  } catch {
    try {
      // Fallback: try zip command (Linux/Mac)
      execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, { stdio: 'pipe' });
      return true;
    } catch {
      console.warn(`  Could not create ZIP: ${zipName} (install zip or use PowerShell)`);
      return false;
    }
  }
}

// --- Firefox manifest patch ---

function patchFirefoxManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Add Firefox-specific settings
  manifest.browser_specific_settings = {
    gecko: {
      id: 'videomemory@videomemory.ai',
      strict_min_version: '109.0'
    }
  };

  // Firefox MV3 uses "background.scripts" array instead of "service_worker"
  // However, Firefox 121+ supports service_worker. For broader compat, use scripts.
  if (manifest.background && manifest.background.service_worker) {
    manifest.background = {
      scripts: [manifest.background.service_worker]
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// --- Main ---

console.log('Video Memory AI — Extension Build\n');

// 1. Clean dist
console.log('1. Cleaning dist/...');
rmDirSync(DIST_DIR);

// 2. Copy source to chrome + firefox
console.log('2. Copying source files...');
copyDirSync(SRC_DIR, CHROME_DIR);
copyDirSync(SRC_DIR, FIREFOX_DIR);
console.log(`   Chrome:  ${CHROME_DIR}`);
console.log(`   Firefox: ${FIREFOX_DIR}`);

// 3. Patch Firefox manifest
console.log('3. Patching Firefox manifest...');
patchFirefoxManifest(path.join(FIREFOX_DIR, 'manifest.json'));

// 4. Create ZIP files
console.log('4. Creating ZIP files...');
const chromeZip = path.join(DIST_DIR, 'videomemory-chrome.zip');
const firefoxZip = path.join(DIST_DIR, 'videomemory-firefox.zip');

const chromeOk = createZip(CHROME_DIR, chromeZip);
const firefoxOk = createZip(FIREFOX_DIR, firefoxZip);

// 5. Summary
console.log('\nBuild complete!\n');
console.log('Output:');
console.log(`  dist/chrome/  — Chrome/Edge extension (load unpacked)`);
console.log(`  dist/firefox/ — Firefox extension (load in about:debugging)`);
if (chromeOk) console.log(`  ${path.basename(chromeZip)} — Chrome Web Store upload`);
if (firefoxOk) console.log(`  ${path.basename(firefoxZip)} — Firefox Add-ons upload`);

// List files
console.log('\nFiles per build:');
function listFiles(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      listFiles(path.join(dir, entry.name), prefix + entry.name + '/');
    } else {
      const size = fs.statSync(path.join(dir, entry.name)).size;
      const kb = (size / 1024).toFixed(1);
      console.log(`  ${prefix}${entry.name} (${kb} KB)`);
    }
  }
}
listFiles(CHROME_DIR);
