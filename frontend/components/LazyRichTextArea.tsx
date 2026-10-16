"use client";

import dynamic from "next/dynamic";

/**
 * `RichTextArea`, with the same props, loaded the first time it renders and
 * never rendered on the server. A page that holds it does not download the
 * field's code until it shows the field. Until the code has loaded, an empty
 * box holds the field's place.
 *
 * The box is 247px tall, the height of the empty field with a one-line label
 * and a one-line hint: 38px for the label and the hint, an 8px gap, and 201px
 * for the toolbar and the 10rem text area in their border. The content under
 * the field stays where it is when the field replaces the box.
 */
const LazyRichTextArea = dynamic(() => import("./RichTextArea"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="h-61.75 bg-white rounded border border-gray-200"
    />
  ),
});

export default LazyRichTextArea;
