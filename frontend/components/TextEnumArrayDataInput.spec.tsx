import { fireEvent, render, screen } from "test/render";

import { messages } from "test/messages";
import TextEnumArrayDataInput from "./TextEnumArrayDataInput";

// The enum-array cell editor (countries) stores codes such as ["BR", "US"] but
// shows each as the country's name, and emits the codes on change. These specs
// cover rendering and pill removal.
describe("TextEnumArrayDataInput", () => {
  const props = {
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
