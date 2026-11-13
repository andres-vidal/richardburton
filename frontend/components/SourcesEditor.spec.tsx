import { fireEvent, render, screen, within } from "test/render";

import SourcesEditor from "./SourcesEditor";

/** Returns a value with `en` as the English list and `pt` as the Portuguese. */
function lists(en: string[], pt: string[] = []) {
  return { pt, en };
}

/** Returns queries within the panel of the tab named `name`. */
function panel(name: "English" | "Português") {
  return within(screen.getByRole("tabpanel", { name }));
}

/** Selects the tab of the sources in Portuguese. */
function selectPortuguese() {
  fireEvent.click(
    within(
      screen.getByRole("tablist", { name: "Language of the sources" }),
    ).getByRole("tab", { name: "Português" }),
  );
}

// The editor works on each language's whole list: adding, removing, moving and
// editing each pass the language and a new list to `onChange`. Its rows are
// plain inputs, so these specs drive every path directly. The reader reads
// English, so the English tab is selected at first.
describe("SourcesEditor", () => {
  test("renders one input per source of the selected language", () => {
    render(
      <SourcesEditor
        value={lists(["First source", "Second source"], ["Primeira fonte"])}
        onChange={vi.fn()}
      />,
    );

    expect(panel("English").getByDisplayValue("First source")).toBeTruthy();
    expect(panel("English").getByDisplayValue("Second source")).toBeTruthy();
    expect(
      panel("English").getByLabelText("Source 1").getAttribute("lang"),
    ).toBe("en");
  });

  test("lists the other language's own sources in its tab", () => {
    render(
      <SourcesEditor
        value={lists(["First source", "Second source"], ["Primeira fonte"])}
        onChange={vi.fn()}
      />,
    );

    selectPortuguese();

    expect(panel("Português").getAllByRole("textbox")).toHaveLength(1);
    expect(panel("Português").getByLabelText("Source 1")).toHaveProperty(
      "value",
      "Primeira fonte",
    );
    expect(
      panel("Português").getByLabelText("Source 1").getAttribute("lang"),
    ).toBe("pt");
  });

  test("shows an empty state and no rows for an empty list", () => {
    render(<SourcesEditor value={lists([])} onChange={vi.fn()} />);

    expect(panel("English").getByText("No sources yet.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("adding appends an empty source to the selected language's list only", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={lists(["A source"], ["Uma fonte"])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    selectPortuguese();
    fireEvent.click(
      panel("Português").getByRole("button", { name: "Add source" }),
    );

    expect(onChange).toHaveBeenNthCalledWith(1, "en", ["A source", ""]);
    expect(onChange).toHaveBeenNthCalledWith(2, "pt", ["Uma fonte", ""]);
  });

  test("editing a row passes its language's list with the edited text", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={lists(["A source"], ["Uma fonte"])}
        onChange={onChange}
      />,
    );

    fireEvent.change(panel("English").getByLabelText("Source 1"), {
      target: { value: "An edited source" },
    });

    expect(onChange).toHaveBeenCalledWith("en", ["An edited source"]);
  });

  test("removing drops that source from its language's list", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={lists(["First", "Second"], ["Primeira"])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove source 1" }));

    expect(onChange).toHaveBeenCalledWith("en", ["Second"]);
  });

  test("reorders with the move controls, which are bounded at the ends", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor value={lists(["First", "Second"])} onChange={onChange} />,
    );

    // The first row can't move up, the last can't move down.
    const up1 = screen.getByRole("button", { name: "Move source 1 up" });
    const down2 = screen.getByRole("button", { name: "Move source 2 down" });
    expect((up1 as HTMLButtonElement).disabled).toBe(true);
    expect((down2 as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Move source 2 up" }));

    expect(onChange).toHaveBeenCalledWith("en", ["Second", "First"]);
  });

  test("shows each language's error under its list, and marks its tab", () => {
    render(
      <SourcesEditor
        value={lists(["A source"], ["Uma fonte"])}
        onChange={vi.fn()}
        errors={{ pt: "This text is too long" }}
      />,
    );

    const tab = within(
      screen.getByRole("tablist", { name: "Language of the sources" }),
    ).getByRole("tab", { name: "Português" });
    expect(tab.getAttribute("data-invalid")).toBe("true");

    selectPortuguese();

    expect(panel("Português").getByText("This text is too long")).toBeTruthy();
  });
});
