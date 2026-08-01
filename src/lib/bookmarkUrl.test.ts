import { describe, it, expect } from 'vitest';
import { bookmarkUrl, parseBookmarkUrl, TOOL_PATH } from './bookmarkUrl';

describe('bookmarkUrl', () => {
  it('builds a /separators/?icon=…&color=… URL with a bare hex', () => {
    // Color travels as hex; the leading # is stripped for a tidy ?color=f43f5e.
    expect(bookmarkUrl('pipe', '#f43f5e')).toBe(`${TOOL_PATH}?icon=pipe&color=f43f5e`);
  });

  it('round-trips through parseBookmarkUrl', () => {
    const url = new URL(bookmarkUrl('lines-vertical', '#3b82f6'), 'https://divii.de');
    expect(parseBookmarkUrl(url.pathname, url.search)).toEqual({
      icon: 'lines-vertical',
      color: '3b82f6',
    });
  });

  it('percent-encodes and decodes query values', () => {
    const url = new URL(bookmarkUrl('my icon', 'hot pink'), 'https://divii.de');
    expect(url.search).toContain('icon=my%20icon');
    expect(parseBookmarkUrl(url.pathname, url.search)).toEqual({
      icon: 'my icon',
      color: 'hot pink',
    });
  });

  it('returns null for the bare live tool page (no query)', () => {
    // This is the guard the color re-tint relies on: the live /separators/ page
    // must NOT match, so it still re-tints the favicon normally.
    expect(parseBookmarkUrl('/separators/', '')).toBeNull();
    expect(parseBookmarkUrl('/separators', '')).toBeNull();
  });

  it('accepts the path with and without the trailing slash', () => {
    expect(parseBookmarkUrl('/separators', '?icon=pipe&color=rose')).toEqual({
      icon: 'pipe',
      color: 'rose',
    });
    expect(parseBookmarkUrl('/separators/', '?icon=pipe&color=rose')).toEqual({
      icon: 'pipe',
      color: 'rose',
    });
  });

  it('returns null for unrelated paths or missing params', () => {
    expect(parseBookmarkUrl('/guides/faq', '?icon=pipe&color=rose')).toBeNull();
    expect(parseBookmarkUrl('/separators/', '?icon=pipe')).toBeNull();
    expect(parseBookmarkUrl('/separators/', '?color=rose')).toBeNull();
    expect(parseBookmarkUrl('/separators/pipe/rose.html', '')).toBeNull();
  });
});
