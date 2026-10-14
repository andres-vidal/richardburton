/**
 * Writes the page's address without a navigation.
 *
 * `ADDRESS.replace` replaces the current history entry with `href` through
 * `window.history.replaceState`. Next.js updates `usePathname` and
 * `useSearchParams` to the new address, and does not request the page from the
 * server.
 *
 * The function is held in an object and read when it is called, so a story
 * can replace it with one that leaves the frame's own address alone.
 */
const ADDRESS = {
  replace(href: string): void {
    window.history.replaceState(null, "", href);
  },
};

export { ADDRESS };
