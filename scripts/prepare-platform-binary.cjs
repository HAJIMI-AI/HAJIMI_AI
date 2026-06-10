/**
 * Prepares platform-specific Claude agent SDK native binaries for cross-compilation.
 *
 * The @anthropic-ai/claude-agent-sdk package ships native Claude Code binaries as
 * optional dependencies (one package per platform). npm only installs optional deps
 * matching the current platform. When cross-compiling (e.g. building a Windows
 * Electron app on macOS), those platform-native packages are missing and the
 * packaged app crashes with "Claude native binary not found".
 *
 * This script downloads platform-specific packages to a project-root cache
 * (.native-binaries/), then copies the required binaries into node_modules
 * before packaging. Before Windows packaging, unmatched architecture
 * directories are purged from node_modules to keep the output lean.
 *
 * Usage:
 *   node scripts/prepare-platform-binary.cjs --mac           # macOS arm64 + x64
 *   node scripts/prepare-platform-binary.cjs --mac-arm64     # macOS arm64 only
 *   node scripts/prepare-platform-binary.cjs --mac-x64       # macOS x64 only
 *   node scripts/prepare-platform-binary.cjs --win           # Windows x64 + arm64
 *   node scripts/prepare-platform-binary.cjs --win-x64       # Windows x64 only
 *   node scripts/prepare-platform-binary.cjs --win-arm64     # Windows arm64 only
 *   node scripts/prepare-platform-binary.cjs --linux         # Linux x64 + arm64
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SDK_DIR = path.join(ROOT, 'node_modules', '@anthropic-ai')
const CACHE_DIR = path.join(ROOT, '.native-binaries')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSdkVersion() {
  const pkgPath = path.join(SDK_DIR, 'claude-agent-sdk', 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

function packageName(platform, arch) {
  return `@anthropic-ai/claude-agent-sdk-${platform}-${arch}`
}

function cacheDirName(platform, arch) {
  return `${platform}-${arch}`
}

function nodeModulesDirName(platform, arch) {
  return `claude-agent-sdk-${platform}-${arch}`
}

function resolveTargets(target) {
  if (target === 'mac') {
    return [
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' }
    ]
  }
  if (target === 'mac-arm64') {
    return [{ platform: 'darwin', arch: 'arm64' }]
  }
  if (target === 'mac-x64') {
    return [{ platform: 'darwin', arch: 'x64' }]
  }
  if (target === 'win') {
    return [
      { platform: 'win32', arch: 'x64' },
      { platform: 'win32', arch: 'arm64' }
    ]
  }
  if (target === 'win-x64') {
    return [{ platform: 'win32', arch: 'x64' }]
  }
  if (target === 'win-arm64') {
    return [{ platform: 'win32', arch: 'arm64' }]
  }
  if (target === 'linux') {
    return [
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'arm64' }
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// Cache (project-root .native-binaries/)
// ---------------------------------------------------------------------------

/** Returns true when the binary for the given platform+arch is already cached. */
function isCached(platform, arch) {
  const dir = path.join(CACHE_DIR, cacheDirName(platform, arch))
  const binaryName = platform === 'win32' ? 'claude.exe' : 'claude'
  return fs.existsSync(path.join(dir, binaryName))
}

/** Downloads an npm package and extracts it into the project-root cache. */
function downloadToCache(platform, arch, version) {
  const name = packageName(platform, arch)
  const shortName = `anthropic-ai-claude-agent-sdk-${platform}-${arch}-${version}`
  const tarballName = `${shortName}.tgz`

  console.log(`📦 Downloading ${name}@${version}...`)

  fs.mkdirSync(CACHE_DIR, { recursive: true })

  const tarballPath = path.join(CACHE_DIR, tarballName)

  // Use npm pack to download the tarball (respects .npmrc registry config)
  execSync(`npm pack ${name}@${version}`, {
    cwd: CACHE_DIR,
    stdio: 'inherit',
    env: { ...process.env }
  })

  const destDir = path.join(CACHE_DIR, cacheDirName(platform, arch))

  // Remove existing dir (may be incomplete from a failed run)
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true })
  }

  fs.mkdirSync(destDir, { recursive: true })

  // Use system tar (available on macOS, Linux, and Git Bash on Windows)
  execSync(`tar -xzf "${tarballPath}" -C "${destDir}" --strip-components=1`, {
    stdio: 'inherit'
  })

  // Clean up tarball
  fs.unlinkSync(tarballPath)

  // Verify the binary exists
  const binaryName = platform === 'win32' ? 'claude.exe' : 'claude'
  const binaryPath = path.join(destDir, binaryName)
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary not found after extraction: ${binaryPath}`)
  }

  console.log(`✅ ${name} cached (${(fs.statSync(binaryPath).size / 1024 / 1024).toFixed(1)} MB)`)
}

// ---------------------------------------------------------------------------
// node_modules staging
// ---------------------------------------------------------------------------

/** Copies a cached platform binary into node_modules/@anthropic-ai/. */
function copyToNodeModules(platform, arch) {
  const src = path.join(CACHE_DIR, cacheDirName(platform, arch))
  const dest = path.join(SDK_DIR, nodeModulesDirName(platform, arch))

  // Wipe existing dir so we always get a clean copy
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true })
  }

  console.log(`📋 Copying ${platform}-${arch} → node_modules/@anthropic-ai/${nodeModulesDirName(platform, arch)}`)

  fs.cpSync(src, dest, { recursive: true })

  const binaryName = platform === 'win32' ? 'claude.exe' : 'claude'
  console.log(`   ✅ ${binaryName} ready`)
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2)
  let targets = []

  if (args.includes('--mac'))        targets.push(...resolveTargets('mac'))
  if (args.includes('--mac-arm64'))  targets.push(...resolveTargets('mac-arm64'))
  if (args.includes('--mac-x64'))    targets.push(...resolveTargets('mac-x64'))
  if (args.includes('--win'))        targets.push(...resolveTargets('win'))
  if (args.includes('--win-x64'))    targets.push(...resolveTargets('win-x64'))
  if (args.includes('--win-arm64'))  targets.push(...resolveTargets('win-arm64'))
  if (args.includes('--linux'))      targets.push(...resolveTargets('linux'))

  if (targets.length === 0) {
    console.error('Usage: node scripts/prepare-platform-binary.cjs --mac | --win | --linux | --mac-[arch] | --win-[arch]')
    process.exit(1)
  }

  const version = getSdkVersion()
  console.log(`🔧 Claude Agent SDK version: ${version}`)

  // ---- Phase 1: ensure binaries are cached in project root -----------------
  console.log('\n📦 Phase 1: Cache binaries in .native-binaries/')
  for (const { platform, arch } of targets) {
    if (isCached(platform, arch)) {
      console.log(`   ✅ ${packageName(platform, arch)} already cached, skipping download`)
    } else {
      try {
        downloadToCache(platform, arch, version)
      } catch (err) {
        console.error(`❌ Failed to download ${packageName(platform, arch)}: ${err.message}`)
        process.exit(1)
      }
    }
  }

  // ---- Phase 2: copy into node_modules ------------------------------------
  console.log('\n📋 Phase 2: Copy into node_modules/@anthropic-ai/')
  for (const { platform, arch } of targets) {
    copyToNodeModules(platform, arch)
  }

  // ---- Phase 3: purge all unmatched platform-arch dirs from node_modules ----
  console.log('\n🧹 Phase 3: Clean unmatched architectures from node_modules')

  // Build the set of directory names we want to keep
  const keepDirs = new Set(targets.map(t => nodeModulesDirName(t.platform, t.arch)))
  // The main SDK package (claude-agent-sdk) must never be removed
  keepDirs.add('claude-agent-sdk')

  // Scan node_modules/@anthropic-ai/ for any platform-binary directory and
  // remove those not in the keep set.  This covers all platforms — when
  // building for macOS only, leftover win32/linux dirs are removed too.
  const RE_BINARY_PKG = /^claude-agent-sdk-(darwin|win32|linux)-(x64|arm64)(-musl)?$/
  let entries = []
  try { entries = fs.readdirSync(SDK_DIR) } catch {}
  for (const name of entries) {
    // Safety: never remove the main sdk package or any non-platform dir
    if (name === 'claude-agent-sdk') continue
    if (!RE_BINARY_PKG.test(name)) continue
    if (keepDirs.has(name)) continue

    const dirPath = path.join(SDK_DIR, name)
    console.log(`🧹 Removing unmatched: node_modules/@anthropic-ai/${name}`)
    fs.rmSync(dirPath, { recursive: true, force: true })
  }

  console.log('\n🎉 Platform binary preparation complete')
}

main()
