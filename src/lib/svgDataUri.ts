// The one SVG -> data: URI encoder, shared by the favicon (favicon.ts) and the
// separator masks (IconGrid at build time), so both produce byte-identical
// URIs from the same template strings.
export function svgDataUri(svg: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// A CSS url() for `mask-image`, embedding the SVG so it costs no network
// request. Masks use only the alpha channel, so the color-agnostic template
// works as-is (no hex substitution). The double quotes are load-bearing:
// encodeURIComponent leaves ' unescaped but encodes ", so only url("…") is safe
// in both Astro-rendered style attributes and style.setProperty.
export function maskUrl(svg: string): string {
  return `url("${svgDataUri(svg)}")`;
}
