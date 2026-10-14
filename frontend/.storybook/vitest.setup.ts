import { MotionGlobalConfig } from "framer-motion";
import { configure } from "storybook/test";

// Renders framer-motion components at their final state in the story tests.
// Its springs do not advance in the headless browser, so an entrance animation
// would stay at its first frame, such as opacity 0, and fail the visibility and
// colour-contrast checks. Interactive Storybook does not load this file and
// keeps its animations.
MotionGlobalConfig.skipAnimations = true;

// Gives `waitFor` and the `findBy` queries five seconds before they fail,
// instead of one. The story tests run several hundred stories at once, and
// under that load a change can take more than a second to reach the page.
configure({ asyncUtilTimeout: 5000 });
