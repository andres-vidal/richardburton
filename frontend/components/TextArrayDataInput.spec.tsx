import { fireEvent, render, screen } from "@testing-library/react";

import TextArrayDataInput from "./TextArrayDataInput";

// The array cell editor (authors, publishers, …) adapts a comma-separated string
// to and from the pill-based Multicombobox: it splits `value` into one pill per
// item and joins the pills back on change. Typing runs the network autocomplete,
// so these specs drive the non-network paths — render and pill removal.
describe("TextArrayDataInput", () => {
  const props = {
    rowId: 1,
    colId: "authors",
    error: "",
    "aria-label": "Authors",
  } as const;

  test("renders one pill per comma-separated value", () => {
    render(
      <TextArrayDataInput
        {...props}
        value="Helen Caldwell,Benjamin Moser"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Helen Caldwell")).toBeTruthy();
    expect(screen.getByText("Benjamin Moser")).toBeTruthy();
  });

  test("renders no pills for an empty value", () => {
    render(<TextArrayDataInput {...props} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  test("removing a pill emits the remaining values re-joined", () => {
    const onChange = vi.fn();
    render(
      <TextArrayDataInput
        {...props}
        value="Helen Caldwell,Benjamin Moser"
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Helen Caldwell" }),
    );

    expect(onChange).toHaveBeenCalledWith("Benjamin Moser");
  });
});
