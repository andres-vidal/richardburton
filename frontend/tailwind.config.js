const plugin = require("tailwindcss/plugin");

const scrollbar = require("tailwind-scrollbar");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      maxWidth: {
        cell: "19.5rem",
      },
      minHeight: {
        toolbar: "70%",
      },
      colors: {
        "gray-active": "#F8FAFB",
      },
    },
    fontFamily: {
      montserrat: ["Montserrat", "sans-serif"],
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      const error = `[data-error="true"]`;
      addVariant("selected", '&[data-selected="true"]');
      addVariant("focused", '&[data-focused="true"]');

      // The two stages of the column-collapse animation (PublicationIndexTable).
      addVariant("collapsing", '&[data-phase="collapsing"]');
      addVariant("settled", '&[data-phase="settled"]');

      addVariant("error", `&${error}`);
      addVariant("error-within", `&:has(${error})`);
      addVariant("peer-error", `:merge(.peer):is(${error}) ~ &`);

      addVariant("loading", '&[data-loading="true"]');
    }),
    scrollbar({ preferredStrategy: "pseudoelements" }),
  ],
};
