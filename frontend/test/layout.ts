import { expect } from "storybook/test";

/**
 * An email address with no space or hyphen to wrap at, longer than any row or
 * card that shows one is wide.
 */
export const LONG_EMAIL =
  "isabel.arundell.burton.and.richard.francis.burton.translators@humanitiesdepartment.universityofsaopaulo.example.edu";

/**
 * A web address with no space or hyphen to wrap at, longer than any row or
 * card that shows one is wide.
 */
export const LONG_URL =
  "https://archive.org/details/domcasmurrotranslatedbyhelencaldwellnoondaypressnewyorkfirstedition1953/page/n7/mode/2up";

/**
 * Checks that `element` fits inside `container`: its text does not run past
 * its own right edge, and its right edge is not past the container's.
 */
export async function expectToFit(element: Element, container: Element) {
  await expect(element.scrollWidth).toBeLessThanOrEqual(
    element.clientWidth + 1,
  );
  await expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(
    container.getBoundingClientRect().right + 1,
  );
}
