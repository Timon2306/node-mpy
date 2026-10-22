// GitHub Release and Cross-Platform Update Service for Node-MPY

export const APP_CURRENT_VERSION = '1.1.1';
export const GITHUB_REPO = 'Timon2306/node-mpy';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTitle: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  matchingAsset: ReleaseAsset | null;
  allAssets: ReleaseAsset[];
  detectedPlatform: 'windows' | 'linux' | 'macos' | 'unknown';
}

/**
 * Detect the current operating system
 */
export function detectPlatform(): 'windows' | 'linux' | 'macos' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac') || ua.includes('darwin')) return 'macos';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'unknown';
}

/**
 * Compare two semver strings (e.g. "v1.0.1" vs "v1.0.0").
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map((x) => parseInt(x, 10) || 0);

  const p1 = parse(v1);
  const p2 = parse(v2);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Pick the best matching binary asset for the current OS from GitHub release assets
 */
function findMatchingAsset(
  assets: any[],
  platform: 'windows' | 'linux' | 'macos' | 'unknown'
): ReleaseAsset | null {
  if (!assets || assets.length === 0) return null;

  if (platform === 'windows') {
    // Prefer setup .exe or standalone .exe, strictly never .msi
    const exe = assets.find(
      (a: any) =>
        typeof a.name === 'string' &&
        a.name.toLowerCase().endsWith('.exe') &&
        !a.name.toLowerCase().endsWith('.msi')
    );
    if (exe) {
      return {
        name: exe.name,
        downloadUrl: exe.browser_download_url,
        sizeBytes: exe.size || 0,
      };
    }
  }

  if (platform === 'linux') {
    // Prefer .AppImage, then .deb
    const appImage = assets.find(
      (a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.appimage')
    );
    if (appImage) {
      return {
        name: appImage.name,
        downloadUrl: appImage.browser_download_url,
        sizeBytes: appImage.size || 0,
      };
    }
    const deb = assets.find(
      (a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.deb')
    );
    if (deb) {
      return {
        name: deb.name,
        downloadUrl: deb.browser_download_url,
        sizeBytes: deb.size || 0,
      };
    }
  }

  if (platform === 'macos') {
    // Prefer .dmg
    const dmg = assets.find(
      (a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.dmg')
    );
    if (dmg) {
      return {
        name: dmg.name,
        downloadUrl: dmg.browser_download_url,
        sizeBytes: dmg.size || 0,
      };
    }
  }

  // Fallback: pick the first non-msi asset
  const first = assets.find(
    (a: any) => typeof a.name === 'string' && !a.name.toLowerCase().endsWith('.msi')
  );
  if (first) {
    return {
      name: first.name,
      downloadUrl: first.browser_download_url,
      sizeBytes: first.size || 0,
    };
  }

  return null;
}

/**
 * Check GitHub Releases API for the latest version of Node-MPY
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = APP_CURRENT_VERSION;
  const platform = detectPlatform();

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (response.status === 404) {
    // No published releases yet
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseTitle: 'Текущий релиз',
      releaseNotes: 'У вас установлена последняя доступная версия.',
      publishedAt: new Date().toISOString(),
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
      matchingAsset: null,
      allAssets: [],
      detectedPlatform: platform,
    };
  }

  if (!response.ok) {
    throw new Error(`Ошибка ответа сервера GitHub (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  const rawTag = data.tag_name || data.name || currentVersion;
  const latestVersion = rawTag.replace(/^v/i, '');
  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;

  const rawAssets = Array.isArray(data.assets) ? data.assets : [];
  const matchingAsset = findMatchingAsset(rawAssets, platform);

  const allAssets: ReleaseAsset[] = rawAssets
    .filter((a: any) => !a.name?.toLowerCase().endsWith('.msi'))
    .map((a: any) => ({
      name: a.name,
      downloadUrl: a.browser_download_url,
      sizeBytes: a.size || 0,
    }));

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    releaseTitle: data.name || rawTag,
    releaseNotes: data.body || '',
    publishedAt: data.published_at || data.created_at || '',
    releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
    matchingAsset,
    allAssets,
    detectedPlatform: platform,
  };
}

/**
 * Open external URL in user's default browser (cross-platform)
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_browser_url', { url });
      return;
    }
  } catch (err) {
    console.warn('Tauri open_browser_url failed, falling back to window.open', err);
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
