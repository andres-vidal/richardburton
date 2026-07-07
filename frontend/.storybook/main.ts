import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    "../components/**/*.mdx",
    "../components/**/*.stories.@(ts|tsx)",
    "../modules/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {
      // Don't let the next-image plugin claim `*.svg`; magical-svg (viteFinal)
      // renders them as React components instead, matching the app's @svgr.
      image: { excludeFiles: ["**/*.svg"] },
    },
  },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  viteFinal: async (viteConfig) => {
    // Resolve the app's absolute imports (tsconfig baseUrl/paths) and render
    // `assets/*.svg` as React components (magical-svg, like vitest.config).
    // next-image is told to skip `.svg` via the framework options above, so the
    // two don't collide.
    const { default: tsconfigPaths } = await import("vite-tsconfig-paths");
    const { default: svgr } = await import("vite-plugin-svgr");
    viteConfig.plugins = viteConfig.plugins ?? [];
    viteConfig.plugins.push(
      tsconfigPaths(),
      // Same as the app's @svgr: default export is a plain function component.
      svgr({ include: "**/*.svg", svgrOptions: { exportType: "default" } }),
    );
    return viteConfig;
  },
};

export default config;
