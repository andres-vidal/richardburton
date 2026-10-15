/**
 * Markdown for the rich-text stories: samples of what `modules/rich-text`
 * reads and writes, and of what it leaves out.
 */

/**
 * Rich text in every format it supports: a paragraph with bold and italic
 * text, a line break and a link, then a bulleted list with a numbered list
 * nested in its first item.
 */
const EVERY_FORMAT =
  "A **bold** claim and an *italic* aside.\\\nA second line, with [the guide](https://example.com/guide).\n\n- Fruit\n  1. *Apples*\n  2. *Pears*\n- Bread";

/** A bare URL and a bare email address, which rich text reads as links. */
const BARE_LINKS =
  "Read https://example.com/guide, or write to help@example.org.";

/**
 * Markdown that rich text does not support: a heading, raw HTML, a link to a
 * script and an image.
 */
const UNSUPPORTED_MARKDOWN =
  "# A heading\n\n<img src=x onerror=alert(1)> and <b>tags</b>\n\n[a script](javascript:alert(1)) and ![a picture](https://example.com/p.png)";

export { BARE_LINKS, EVERY_FORMAT, UNSUPPORTED_MARKDOWN };
