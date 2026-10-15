import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../components/**/*.mdx", "../components/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    // The next/image plugin leaves `*.svg` to vite-plugin-svgr, added in
    // `viteFinal`.
    options: { image: { excludeFiles: ["**/*.svg"] } },
  },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  // Resolves imports as the app's tsconfig paths say, and imports an SVG as a
  // React component, its default export, as the app's @svgr loader does.
  viteFinal: async (viteConfig) => {
    const { default: svgr } = await import("vite-plugin-svgr");
    viteConfig.resolve = { ...viteConfig.resolve, tsconfigPaths: true };
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      svgr({ include: "**/*.svg", svgrOptions: { exportType: "default" } }),
    ];
    return viteConfig;
  },
};

export default config;
