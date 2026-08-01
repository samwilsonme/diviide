// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { currentBookmark } from './bookmarkUrl';

// currentBookmark() is the live guard behind the favicon invariant: main.ts and
// favicon.ts ask it "is this page parked on a bookmark URL?" before any re-tint.
// parseBookmarkUrl has its own node-env spec; this covers the window.location
// wiring the guard actually runs through.
describe('currentBookmark', () => {
  it('reads the bookmark ref off the current location', () => {
    history.replaceState({}, '', '/separators/?icon=pipe&color=f43f5e');
    expect(currentBookmark()).toEqual({ icon: 'pipe', color: 'f43f5e' });
  });

  it('returns null on the live tool page (no query)', () => {
    history.replaceState({}, '', '/separators/');
    expect(currentBookmark()).toBeNull();
  });

  it('returns null on unrelated routes even with bookmark-shaped params', () => {
    history.replaceState({}, '', '/guides/faq/?icon=pipe&color=f43f5e');
    expect(currentBookmark()).toBeNull();
  });
});
