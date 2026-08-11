import { fireEvent, render, screen } from "@testing-library/react";

import TextArrayDataInput from "./TextArrayDataInput";

// The array cell editor (authors, publishers, …) hands the list of values to
// the pill-based Multicombobox, one pill each, and takes a list back. Typing
// runs the network autocomplete, so these specs drive the non-network paths —
// render, pill removal, and the quoting that lets a value hold a comma.
describe("TextArrayDataInput", () => {
  const props = {
    rowId: 1,
    colId: "authors",
    error: "",
    "aria-label": "Authors",
  } as const;

  test("renders one pill per value", () => {
    render(
      <TextArrayDataInput
        {...props}
        value={["Helen Caldwell", "Benjamin Moser"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Helen Caldwell")).toBeTruthy();
    expect(screen.getByText("Benjamin Moser")).toBeTruthy();
  });

  test("renders no pills for an empty value", () => {
    render(<TextArrayDataInput {...props} value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  test("removing a pill emits the values that remain", () => {
    const onChange = vi.fn();
    render(
      <TextArrayDataInput
        {...props}
        value={["Helen Caldwell", "Benjamin Moser"]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Helen Caldwell" }),
    );

    expect(onChange).toHaveBeenCalledWith(["Benjamin Moser"]);
  });
  test("a comma inside an open quote is a character, not the end of a value", () => {
    const onChange = vi.fn();
    render(<TextArrayDataInput {...props} value={[]} onChange={onChange} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: '"Cassel' } });
    fireEvent.keyDown(input, { key: "," });

    expect(onChange).not.toHaveBeenCalled();
  });

  test("a quoted value commits whole, without its quotes", () => {
    const onChange = vi.fn();
    render(<TextArrayDataInput {...props} value={[]} onChange={onChange} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: '"Cassel, McBride & Co."' } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["Cassel, McBride & Co."]);
  });
});
