import { source } from "test/publication-fixtures";
import { fireEvent, render, screen, within } from "test/render";

import SourcesEditor from "./SourcesEditor";

// The editor works on the whole list: adding, removing, moving and editing
// each pass a new list to `onChange`. Its rows are plain inputs, so these
// specs drive every path directly. The reader reads English, so the English
// tab is selected at first.
describe("SourcesEditor", () => {
  test("renders one input per source, with its text in the selected language", () => {
    render(
      <SourcesEditor
        value={[
          source("Primeira fonte", "First source"),
          source(null, "Second source"),
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("First source")).toBeTruthy();
    expect(screen.getByDisplayValue("Second source")).toBeTruthy();
    expect(screen.queryByDisplayValue("Primeira fonte")).toBeNull();
  });

  test("shows a source's text in the other language as the placeholder of an empty one", () => {
    render(
      <SourcesEditor
        value={[source("Primeira fonte"), source(null, null)]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Source 1")).toHaveProperty(
      "placeholder",
      "Primeira fonte",
    );
    expect(screen.getByLabelText("Source 2")).toHaveProperty(
      "placeholder",
      "A citation, URL, or note",
    );
  });

  test("lists the same sources in the other tab, with their texts in its language", () => {
    render(
      <SourcesEditor
        value={[source("Primeira fonte", "First source")]}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      within(
        screen.getByRole("tablist", { name: "Language of the sources" }),
      ).getByRole("tab", { name: "Português" }),
    );

    expect(screen.getByLabelText("Source 1")).toHaveProperty(
      "value",
      "Primeira fonte",
    );
    expect(screen.getByLabelText("Source 1").getAttribute("lang")).toBe("pt");
  });

  test("shows an empty state and no rows for an empty list", () => {
    render(<SourcesEditor value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("No sources yet.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("adding appends a source with no text in either language", () => {
    const onChange = vi.fn();
    render(<SourcesEditor value={[source("Uma fonte")]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    expect(onChange).toHaveBeenCalledWith([
      source("Uma fonte"),
      source(null, null),
    ]);
  });

  test("editing a row sets its text in the selected language, and emptying it leaves none", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={[source("Uma fonte", "A source")]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Source 1"), {
      target: { value: "An edited source" },
    });
    fireEvent.change(screen.getByLabelText("Source 1"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, [
      source("Uma fonte", "An edited source"),
    ]);
    expect(onChange).toHaveBeenNthCalledWith(2, [source("Uma fonte", null)]);
  });

  test("removing drops that source in both languages", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={[source("Primeira", "First"), source("Segunda", "Second")]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove source 1" }));

    expect(onChange).toHaveBeenCalledWith([source("Segunda", "Second")]);
  });

  test("reorders with the move controls, which are bounded at the ends", () => {
    const onChange = vi.fn();
    render(
      <SourcesEditor
        value={[source("Primeira", "First"), source(null, "Second")]}
        onChange={onChange}
      />,
    );

    // The first row can't move up, the last can't move down.
    const up1 = screen.getByRole("button", { name: "Move source 1 up" });
    const down2 = screen.getByRole("button", { name: "Move source 2 down" });
    expect((up1 as HTMLButtonElement).disabled).toBe(true);
    expect((down2 as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Move source 2 up" }));

    expect(onChange).toHaveBeenCalledWith([
      source(null, "Second"),
      source("Primeira", "First"),
    ]);
  });

  test("shows an error under the list", () => {
    render(
      <SourcesEditor
        value={[source("Uma fonte")]}
        onChange={vi.fn()}
        error="These sources could not be paired"
      />,
    );

    expect(screen.getByText("These sources could not be paired")).toBeTruthy();
  });
});
