// Uppercase the first character, e.g. for showing a config color name ('rose')
// as a human label ('Rose'). Shared by every surface that titles a swatch.
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// True on Apple platforms, where keyboard shortcuts use ⌘ rather than Ctrl.
// Guarded for environments without a DOM (build, tests before jsdom is ready).
//
// navigator.platform is deprecated and frozen in modern Chromium (it reports a
// fixed value rather than the real platform), so the userAgent fallback is the
// branch that actually decides this today. It is tried first anyway because it is
// still accurate on the browsers that have not frozen it, and cheaper to match.
// The modern replacement, navigator.userAgentData.platform, is Chromium-only —
// which would leave Safari, the platform this most needs to detect, on the
// fallback regardless.
export function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}
