import { fireEvent, render, screen } from "@testing-library/react";

import SourcesEditor from "./SourcesEditor";

// The provenance editor works on the whole list: add/remove/reorder/edit each
// produce a fresh array through `onChange`. Rows are plain inputs (no network),
// so these specs drive every path directly.
describe("SourcesEditor", () => {
  test("renders one input per source", () => {
    render(
      <SourcesEditor
        value={["First source", "Second source"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("First source")).toBeTruthy();
    expect(screen.getByDisplayValue("Second source")).toBeTruthy();
  });

  test("shows an empty state and no rows for an empty list", () => {
    render(<SourcesEditor value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("No sources yet.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("adding appends a blank entry", () => {
    const onChange = vi.fn();
    render(<SourcesEditor value={["A source"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    expect(onChange).toHaveBeenCalledWith(["A source", ""]);
  });

  test("editing a row emits the updated list", () => {
    const onChange = vi.fn();
    render(<SourcesEditor value={["A source"]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Source 1"), {
      target: { value: "An edited source" },
    });

    expect(onChange).toHaveBeenCalledWith(["An edited source"]);
  });

  test("removing drops that entry", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={["First source", "Second source"]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove source 1" }));

    expect(onChange).toHaveBeenCalledWith(["Second source"]);
  });

  test("reorders with the move controls, which are bounded at the ends", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={["First source", "Second source"]}
        onChange={onChange}
      />,
    );

    // The first row can't move up, the last can't move down.
    const up1 = screen.getByRole("button", { name: "Move source 1 up" });
    const down2 = screen.getByRole("button", { name: "Move source 2 down" });
    expect((up1 as HTMLButtonElement).disabled).toBe(true);
    expect((down2 as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Move source 2 up" }));

    expect(onChange).toHaveBeenCalledWith(["Second source", "First source"]);
  });
});
