defmodule RichardBurton.PublisherTest do
  @moduledoc """
  Tests for the Publisher schema, and for searching publishers by name with
  `RichardBurton.Name.search/2`.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Name
  alias RichardBurton.Publisher
  alias RichardBurton.Validation
  alias RichardBurton.Util

  @valid_attrs %{
    "name" => "Noonday Press"
  }

  @publishers [
    %{"name" => "Random House"},
    %{"name" => "Bantam Books"},
    %{"name" => "Dutton"},
    %{"name" => "UMass Dartmouth"},
    %{"name" => "University Press of Kentucky"}
  ]

  defp changeset(attrs = %{}) do
    Publisher.changeset(%Publisher{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
  end

  defp insert(attrs) do
    %Publisher{} |> Publisher.changeset(attrs) |> Repo.insert()
  end

  # Returns the sorted names of the publishers `Name.search` finds for `term`,
  # in both passes or in the one `pass` names.
  defp found(term), do: Publisher |> Name.search(term) |> names()
  defp found(term, pass), do: Publisher |> Name.search(term, pass) |> names()

  defp names(publishers), do: publishers |> Enum.map(& &1.name) |> Enum.sort()

  def search_fixture(_) do
    @publishers
    |> Enum.map(&Publisher.changeset(%Publisher{}, &1))
    |> Enum.each(&Repo.insert!/1)

    []
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(@valid_attrs).valid?
    end

    test "when name is blank, is invalid" do
      refute change_valid(%{"name" => ""}).valid?
    end

    test "when name is nil, is invalid" do
      refute change_valid(%{"name" => nil}).valid?
    end

    test "when name is a non-blank string, is valid" do
      assert change_valid(%{"name" => "Bickers & SonA"}).valid?
    end

    test "when a publisher with the provided attributes already exists, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end
  end

  describe "searching by prefix" do
    setup [:search_fixture]

    test "finds a publisher by full name" do
      assert found("University Press of Kentucky", :prefix) == ["University Press of Kentucky"]
    end

    test "finds every publisher whose name starts with the term" do
      assert found("U", :prefix) == ["UMass Dartmouth", "University Press of Kentucky"]
    end
  end

  describe "searching by similarity" do
    setup [:search_fixture]

    test "finds a publisher by full name" do
      assert found("University Press of Kentucky", :fuzzy) == ["University Press of Kentucky"]
    end

    test "finds a publisher by a misspelling of its name" do
      assert found("Universiti Press of Kentucky", :fuzzy) == ["University Press of Kentucky"]
      assert found("Random Hause", :fuzzy) == ["Random House"]
      assert found("Duton", :fuzzy) == ["Dutton"]
    end
  end

  describe "searching in both passes" do
    setup [:search_fixture]

    test "searches by prefix first" do
      assert found("Ran") == ["Random House"]
    end

    test "searches by similarity when no name starts with the term" do
      assert found("Randon House", :prefix) == []
      assert found("Randon House") == ["Random House"]
    end
  end

  describe "flatten/1" do
    test "with a list of maps with string keys, returns their names" do
      publishers = [
        %{"name" => "Noonday Press"},
        %{"name" => "Bickers & Son"}
      ]

      assert ["Noonday Press", "Bickers & Son"] = Publisher.flatten(publishers)
    end

    test "with a list of maps with atom keys, returns their names" do
      publishers = [
        %{name: "Noonday Press"},
        %{name: "Bickers & Son"}
      ]

      assert ["Noonday Press", "Bickers & Son"] = Publisher.flatten(publishers)
    end

    test "with a list of Publisher structs, returns their names" do
      publishers = [
        %Publisher{name: "Noonday Press"},
        %Publisher{name: "Bickers & Son"}
      ]

      assert ["Noonday Press", "Bickers & Son"] = Publisher.flatten(publishers)
    end
  end

  describe "nest/1" do
    test "returns a list of maps with a name key" do
      publishers = ["Noonday Press", "Bickers & Son"]

      assert [%{"name" => "Noonday Press"}, %{"name" => "Bickers & Son"}] =
               Publisher.nest(publishers)
    end
  end
end
