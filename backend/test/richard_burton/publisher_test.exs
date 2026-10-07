defmodule RichardBurton.PublisherTest do
  @moduledoc """
  Tests for the Publisher schema
  """
  use RichardBurton.DataCase
  doctest RichardBurton.Publisher

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

  describe "search/2 when second argument is :prefix" do
    setup [:search_fixture]

    test "retrieves publishers by full name" do
      term = "University Press of Kentucky"

      for %Publisher{name: name} <- Publisher.search(term, :prefix) do
        assert name == term
      end
    end

    test "retrieves publishers by prefix" do
      term = "U"

      for %Publisher{name: name} <- Publisher.search(term, :prefix) do
        assert name in ["UMass Dartmouth", "University Press of Kentucky"]
      end
    end
  end

  describe "search/2 when second argument is :fuzzy" do
    setup [:search_fixture]

    test "retrieves publishers by full name" do
      term = "University Press of Kentucky"

      for %Publisher{name: name} <- Publisher.search(term, :fuzzy) do
        assert name == term
      end
    end

    test "retrieves publishers by similarity" do
      for %Publisher{name: name} <- Publisher.search("Universiti Press of Kentucky", :fuzzy) do
        assert name == "University Press of Kentucky"
      end

      for %Publisher{name: name} <- Publisher.search("Tan", :fuzzy) do
        assert name in ["Random House", "Bantam Books"]
      end

      for %Publisher{name: name} <- Publisher.search("Dutan", :fuzzy) do
        assert name in ["Dutton"]
      end
    end
  end

  describe "search/1" do
    setup [:search_fixture]

    test "searches by prefix first" do
      for %Publisher{name: name} <- Publisher.search("Ran") do
        assert name == "Random House"
      end
    end

    test "searches by similarity if prefix search renders no results" do
      term = "Rant"

      assert [] == Publisher.search(term, :prefix)

      for %Publisher{name: name} <- Publisher.search(term) do
        assert name in ["Random House", "Bantam Books"]
      end
    end
  end

  describe "flatten/1" do
    test "with a list of maps with string keys, returns a list of maps with name key" do
      publishers = [
        %{"name" => "Noonday Press"},
        %{"name" => "Bickers & Son"}
      ]

      assert ["Noonday Press", "Bickers & Son"] = Publisher.flatten(publishers)
    end

    test "with a list of maps with atom keys, returns a list of maps with name key" do
      publishers = [
        %{name: "Noonday Press"},
        %{name: "Bickers & Son"}
      ]

      assert ["Noonday Press", "Bickers & Son"] = Publisher.flatten(publishers)
    end

    test "with a list of Publisher structs, returns a list of maps with name key" do
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
