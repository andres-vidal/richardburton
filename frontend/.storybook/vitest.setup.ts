import { MotionGlobalConfig } from "framer-motion";

// Test-only (this file is a vitest setupFile, not loaded by interactive
// Storybook): framer-motion springs don't advance in the headless browser, so
// entrance animations stay stuck at their initial state (e.g. opacity 0) and
// trip color-contrast/visibility checks on content that is actually visible.
// Render motion components at their final state so assertions see the truth;
// interactive Storybook keeps its animations.
MotionGlobalConfig.skipAnimations = true;
