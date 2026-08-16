export interface UpdateInfo {
  version: string;
  buildNumber: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl?: string;
  htmlUrl?: string;
  mandatory?: boolean;
}

export interface ReleaseItem {
  version: string;
  name: string;
  releaseDate: string;
  releaseNotes: string;
  htmlUrl: string;
  downloadUrl?: string;
  isPrerelease?: boolean;
}

/**
 * Compares two semver strings like "0.9.0" vs "0.8.6".
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = v1.replace(/^v/, '').split('.').map(Number);
  const p2 = v2.replace(/^v/, '').split('.').map(Number);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function fetchGitHubReleases(): Promise<{ latest: UpdateInfo | null; history: ReleaseItem[] }> {
  try {
    const res = await fetch('https://api.github.com/repos/prathambahekar/okane/releases', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return { latest: null, history: [] };
        }

        const history: ReleaseItem[] = data.map((rel: {
          tag_name?: string;
          name?: string;
          published_at?: string;
          body?: string;
          html_url?: string;
          prerelease?: boolean;
          assets?: Array<{ browser_download_url?: string }>;
          zipball_url?: string;
        }) => ({
          version: rel.tag_name?.replace(/^v/, '') || '0.0.0',
          name: rel.name || rel.tag_name || 'Release',
          releaseDate: rel.published_at ? rel.published_at.split('T')[0] : 'Unknown',
          releaseNotes: rel.body || 'No release notes provided.',
          htmlUrl: rel.html_url || 'https://github.com/prathambahekar/okane/releases',
          downloadUrl: rel.assets?.[0]?.browser_download_url || rel.zipball_url || rel.html_url,
          isPrerelease: Boolean(rel.prerelease),
        }));

        // Sort history semver descending so the highest version is always at the top
        history.sort((a, b) => compareVersions(b.version, a.version));

        const topRelease = history[0];
        const latestVersionStr = topRelease ? topRelease.version : CURRENT_APP_VERSION;

        const latest: UpdateInfo = {
          version: latestVersionStr,
          buildNumber: '108',
          releaseDate: topRelease ? topRelease.releaseDate : 'Today',
          releaseNotes: topRelease ? topRelease.releaseNotes : `Okane v${latestVersionStr} release on GitHub`,
          downloadUrl: topRelease?.downloadUrl,
          htmlUrl: topRelease?.htmlUrl,
        };

        return { latest, history };
      }
    }
  } catch (err) {
    console.warn('GitHub API releases fetch failed or rate-limited:', err);
  }

  // Fallback to local latest-version.json and curated history
  const localLatest = await fetchRemoteVersion();
  const fallbackHistory: ReleaseItem[] = [
    ...(localLatest ? [{
      version: localLatest.version,
      name: `Okane v${localLatest.version}`,
      releaseDate: localLatest.releaseDate,
      releaseNotes: localLatest.releaseNotes,
      htmlUrl: 'https://github.com/prathambahekar/okane/releases',
      downloadUrl: localLatest.downloadUrl,
    }] : []),
    {
      version: '0.9.0',
      name: 'Okane v0.9.0',
      releaseDate: '2026-08-16',
      releaseNotes: 'App version 0.9.0 release.',
      htmlUrl: 'https://github.com/prathambahekar/okane/releases/tag/v0.9.0',
    },
    {
      version: '0.8.2',
      name: 'Okane v0.8.2',
      releaseDate: '2026-08-05',
      releaseNotes: 'Performance optimizations, offline-first transaction indexing, and auto-update support.',
      htmlUrl: 'https://github.com/prathambahekar/okane/releases/tag/v0.8.2',
    },
    {
      version: '0.8.1',
      name: 'Okane v0.8.1',
      releaseDate: '2026-08-04',
      releaseNotes: 'Bug fixes and UI refinements.',
      htmlUrl: 'https://github.com/prathambahekar/okane/releases/tag/v0.8.1',
    },
    {
      version: '0.8.0',
      name: 'Okane v0.8.0',
      releaseDate: '2026-08-04',
      releaseNotes: 'Beta release with recurring autopay rules and contact balance settlements.',
      htmlUrl: 'https://github.com/prathambahekar/okane/releases/tag/v0.8.0',
    }
  ];

  return {
    latest: localLatest,
    history: fallbackHistory,
  };
}

export async function fetchRemoteVersion(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch('/latest-version.json?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        return data as UpdateInfo;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch remote version:', err);
  }
  return null;
}

export const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.9.0';

export function getStoredInstalledVersion(): string {
  const stored = localStorage.getItem('installed_app_version');
  if (!stored || compareVersions(CURRENT_APP_VERSION, stored) > 0) {
    localStorage.setItem('installed_app_version', CURRENT_APP_VERSION);
    return CURRENT_APP_VERSION;
  }
  return stored;
}

export function setStoredInstalledVersion(version: string): void {
  localStorage.setItem('installed_app_version', version);
}

