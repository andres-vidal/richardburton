import { MotionGlobalConfig } from "framer-motion";

// Renders framer-motion components at their final state in the story tests.
// Its springs do not advance in the headless browser, so an entrance animation
// would stay at its first frame, such as opacity 0, and fail the visibility and
// colour-contrast checks. Interactive Storybook does not load this file and
// keeps its animations.
MotionGlobalConfig.skipAnimations = true;
