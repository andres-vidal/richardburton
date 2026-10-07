defmodule RichardBurton.AuthorTest do
  @moduledoc """
  Tests for the Author schema
  """

  use RichardBurton.DataCase
  doctest RichardBurton.Author

  alias RichardBurton.Author
  alias RichardBurton.Validation

  @valid_attrs %{"name" => "J. M. Pereira da Silva"}

  @authors [
    %{"name" => "Machado de Assis"},
    %{"name" => "Richard Burton"},
    %{"name" => "Richard A. Mazzara"},
    %{"name" => "Isabel Burton"},
    %{"name" => "Clarice Lispector"}
  ]

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

  describe "search/2 when second argument is :prefix" do
    setup [:search_fixture]

    test "retrieves authors by full name" do
      term = "Machado de Assis"

      for %Author{name: name} <- Author.search(term, :prefix) do
        assert name == term
      end
    end

    test "retrieves authors by prefix" do
      term = "Richa"

      for %Author{name: name} <- Author.search(term, :prefix) do
        assert name in ["Richard Burton", "Richard A. Mazzara"]
      end
    end
  end

  describe "search/2 when second argument is :fuzzy" do
    setup [:search_fixture]

    test "retrieves authors by full name" do
      term = "Machado de Assis"

      for %Author{name: name} <- Author.search(term, :fuzzy) do
        assert name == term
      end
    end

    test "retrieves authors by similarity" do
      for %Author{name: name} <- Author.search("Machada de Assis", :fuzzy) do
        assert name == "Machado de Assis"
      end

      for %Author{name: name} <- Author.search("Richord", :fuzzy) do
        assert name in ["Richard Burton", "Richard A. Mazzara"]
      end

      for %Author{name: name} <- Author.search("Clarissa", :fuzzy) do
        assert name in ["Clarice Lispector"]
      end
    end
  end

  describe "search/1" do
    setup [:search_fixture]

    test "searches by prefix first" do
      for %Author{name: name} <- Author.search("Richard B") do
        assert name == "Richard Burton"
      end
    end

    test "searches by similarity if prefix search renders no results" do
      term = "Rochard B"

      assert [] == Author.search(term, :prefix)

      for %Author{name: name} <- Author.search(term) do
        assert name in ["Richard Burton", "Richard A. Mazzara"]
      end
    end
  end

  describe "flatten/1" do
    test "with a list of maps with string keys, returns a list of maps with code key" do
      authors = [
        %{"name" => "Richard Burton"},
        %{"name" => "Isabel Burton"}
      ]

      assert ["Richard Burton", "Isabel Burton"] = Author.flatten(authors)
    end

    test "with a list of maps with atom keys, returns a list of maps with code key" do
      authors = [
        %{name: "Richard Burton"},
        %{name: "Isabel Burton"}
      ]

      assert ["Richard Burton", "Isabel Burton"] = Author.flatten(authors)
    end

    test "with a list of Author structs, returns a list of maps with code key" do
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
