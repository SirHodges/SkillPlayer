# Development Log & Known Issues

## PDF Viewer Sidebar (2026-01-15)
**Issue**: The side navigation pane (thumbnails/bookmarks) in the PDF viewer opens automatically, reducing the reading area.
**Status**: Unresolved (Browser behavior overriding settings).

### FAILED Attempts
We attempted to force the sidebar to close using standard PDF URL parameters in `index.html`:

1.  **Standard Params**: Appended `#navpanes=0`.
    *   *Result*: Sidebar still opened.
2.  **Aggressive Params**: Appended `#toolbar=0&navpanes=0&pagemode=none&scrollbar=0`.
    *   *Result*: Sidebar still opened.
3.  **Cache Busting**: Added `?t=${Date.now()}` to force browser to reload params.
    *   *Result*: Sidebar still opened.

**Hypothesis**: The user's specific browser (likely recent Edge or Chrome) has a "Remember last state" feature or simply ignores `pagemode` parameters in its built-in PDF viewer implementation.
**Future Workaround**: Consider replacing the `<iframe>` native viewer with a JavaScript library like `pdf.js` for full control, though this increases complexity and file size significantly.
