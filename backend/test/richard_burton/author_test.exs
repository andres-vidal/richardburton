defmodule RichardBurton.AuthorTest do
  @moduledoc """
  Tests for the Author schema, and for searching authors by name with
  `RichardBurton.Name.search/2`.
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Name
  alias RichardBurton.Validation

  @valid_attrs %{"name" => "J. M. Pereira da Silva"}

  @authors [
    %{"name" => "Machado de Assis"},
    %{"name" => "Richard Burton"},
    %{"name" => "Richard A. Mazzara"},
    %{"name" => "Isabel Burton"},
    %{"name" => "Clarice Lispector"}
  ]

  # Returns the sorted names of the authors `Name.search` finds for `term`, in
  # both passes or in the one `pass` names.
  defp found(term), do: Author |> Name.search(term) |> names()
  defp found(term, pass), do: Author |> Name.search(term, pass) |> names()

  defp names(authors), do: authors |> Enum.map(& &1.name) |> Enum.sort()

  def search_fixture(_) do
    @authors
    |> Enum.map(&Author.changeset(%Author{}, &1))
    |> Enum.each(&Repo.insert!/1)

    []
  end

  defp changeset(attrs) do
    Author.changeset(%Author{}, attrs)
  end

  defp insert(attrs) do
    attrs |> changeset() |> Repo.insert()
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(@valid_attrs).valid?
    end

    test "when name is blank, is invalid" do
      refute changeset(%{"name" => ""}).valid?
    end

    test "when name is nil is invalid" do
      refute changeset(%{"name" => nil}).valid?
    end

    test "when an author with the provided attributes exist, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end
  end

  describe "searching by prefix" do
    setup [:search_fixture]

    test "finds an author by full name" do
      assert found("Machado de Assis", :prefix) == ["Machado de Assis"]
    end

    test "finds every author whose name starts with the term" do
      assert found("Richa", :prefix) == ["Richard A. Mazzara", "Richard Burton"]
    end
  end

  describe "searching by similarity" do
    setup [:search_fixture]

    test "finds an author by full name" do
      assert found("Machado de Assis", :fuzzy) == ["Machado de Assis"]
    end

    test "finds an author by a misspelling of their name" do
      assert found("Machada de Assis", :fuzzy) == ["Machado de Assis"]
      assert found("Clarise Lispector", :fuzzy) == ["Clarice Lispector"]
      assert found("Isabel Burtin", :fuzzy) == ["Isabel Burton"]
    end
  end

  describe "searching in both passes" do
    setup [:search_fixture]

    test "searches by prefix first" do
      assert found("Richard B") == ["Richard Burton"]
    end

    test "searches by similarity when no name starts with the term" do
      assert found("Rochard Burton", :prefix) == []
      assert found("Rochard Burton") == ["Isabel Burton", "Richard Burton"]
    end
  end

  describe "flatten/1" do
    test "with a list of maps with string keys, returns their names" do
      authors = [
        %{"name" => "Richard Burton"},
        %{"name" => "Isabel Burton"}
      ]

      assert ["Richard Burton", "Isabel Burton"] = Author.flatten(authors)
    end

    test "with a list of maps with atom keys, returns their names" do
      authors = [
        %{name: "Richard Burton"},
        %{name: "Isabel Burton"}
      ]

      assert ["Richard Burton", "Isabel Burton"] = Author.flatten(authors)
    end

    test "with a list of Author structs, returns their names" do
      authors = [
        %Author{name: "Richard Burton"},
        %Author{name: "Isabel Burton"}
      ]

      assert ["Richard Burton", "Isabel Burton"] = Author.flatten(authors)
    end
  end

  describe "nest/1" do
    test "returns a list of maps with a name key" do
      authors = ["Richard Burton", "Isabel Burton"]

      assert [%{"name" => "Richard Burton"}, %{"name" => "Isabel Burton"}] = Author.nest(authors)
    end
  end
end
