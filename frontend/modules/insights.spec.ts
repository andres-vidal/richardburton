import { describe, expect, it } from "vitest";
import { decadesBetween } from "./insights";

describe("decadesBetween", () => {
  it("lists every decade from the first year's to the last year's", () => {
    expect(decadesBetween(1953, 1987)).toEqual([1950, 1960, 1970, 1980]);
  });

  it("lists one decade when both years fall in it", () => {
    expect(decadesBetween(1960, 1969)).toEqual([1960]);
  });

  it("includes the decade of a last year that starts one", () => {
    expect(decadesBetween(1950, 1990)).toEqual([1950, 1960, 1970, 1980, 1990]);
  });

  it("lists nothing when the last year is in an earlier decade", () => {
    expect(decadesBetween(1990, 1950)).toEqual([]);
  });
});
