import { fireEvent, render, screen } from "utils/testRender";

import { messages } from "utils/messages";
import TextEnumArrayDataInput from "./TextEnumArrayDataInput";

// The enum-array cell editor (countries) stores raw ids (e.g. "BR,US") but shows
// each as the country's name, and emits the raw ids re-joined on change. These
// specs drive the non-network paths — render and pill removal — so they never
// trigger the autocomplete network call.
describe("TextEnumArrayDataInput", () => {
  const props = {
    rowId: 1,
    colId: "countries",
    error: "",
    "aria-label": "Countries",
  } as const;

  const brLabel = messages.countryNames.BR;
  const usLabel = messages.countryNames.US;

  test("renders each id as its human label", () => {
    render(
      <TextEnumArrayDataInput
        {...props}
        value={["BR", "US"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(brLabel)).toBeTruthy();
    expect(screen.getByText(usLabel)).toBeTruthy();
  });

  test("removing a pill emits the ids that remain, not their labels", () => {
    const onChange = vi.fn();
    render(
      <TextEnumArrayDataInput
        {...props}
        value={["BR", "US"]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Remove ${brLabel}` }));

    expect(onChange).toHaveBeenCalledWith(["US"]);
  });
});
