defmodule RichardBurton.AuthorTest do
  @moduledoc """
  Tests for the Author schema
  """

  use RichardBurton.DataCase
  import Ecto.Changeset
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

  defp insert!(attrs) do
    attrs |> changeset() |> Repo.insert!()
  end

  defp get_authors(changeset = %Ecto.Changeset{}) do
    changeset
    |> get_change(:authors)
    |> Enum.map(&apply_changes/1)
  end

  defp get_fingerprint(changeset = %Ecto.Changeset{}) do
    get_change(changeset, :authors_fingerprint)
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

  describe "maybe_insert/1" do
    test "when there is no author with the provided name, inserts it" do
      author = Author.maybe_insert!(@valid_attrs)

      assert [author] == Author.all()
    end

    test "when there is a author with the provided name, returns the pre-existent one" do
      insert(@valid_attrs)
      assert [preexistent_author] = Author.all()

      author = Author.maybe_insert!(@valid_attrs)

      assert preexistent_author == author
      assert [author] == Author.all()
    end
  end

  describe "fingerprint/1" do
    test "given two different lists of authors, generates different fingerprints" do
      authors1 = [%Author{name: "Richard Burton"}, %Author{name: "Isabel Burton"}]
      authors2 = [%Author{name: "Richard Burton"}]

      refute Author.fingerprint(authors1) == Author.fingerprint(authors2)
    end

    test "given two lists of authors with the same names, generates the same fingerprints" do
      authors1 = [%Author{name: "Richard Burton"}, %Author{name: "Isabel Burton"}]
      authors2 = [%Author{name: "Richard Burton"}, %Author{name: "Isabel Burton"}]

      assert Author.fingerprint(authors1) == Author.fingerprint(authors2)
    end

    test "given two lists of authors with the same and different order, generates the same fingerprints" do
      authors1 = [%Author{name: "Isabel Burton"}, %Author{name: "Richard Burton"}]
      authors2 = [%Author{name: "Richard Burton"}, %Author{name: "Isabel Burton"}]

      assert Author.fingerprint(authors1) == Author.fingerprint(authors2)
    end

    test "given sets whose names concatenate the same, generates different fingerprints" do
      # Without a delimiter, ["AnnBob"] and ["Ann", "Bob"] both join to "AnnBob".
      one = [%Author{name: "AnnBob"}]
      two = [%Author{name: "Ann"}, %Author{name: "Bob"}]

      refute Author.fingerprint(one) == Author.fingerprint(two)
    end
  end

  defmodule WithManyAuthors do
    use Ecto.Schema
    import Ecto.Changeset

    schema "with_many_authors" do
      field(:authors_fingerprint, :string)
      has_many :authors, Author
    end

    def changeset(attrs) do
      %WithManyAuthors{} |> cast(attrs, []) |> cast_assoc(:authors)
    end
  end

  describe "link/1" do
    test "links existing authors to changeset" do
      attrs = %{
        "authors" => [
          %{"name" => "Richard Burton"},
          %{"name" => "Isabel Burton"}
        ]
      }

      authors = Enum.map(attrs["authors"], &insert!/1)

      changeset =
        attrs
        |> WithManyAuthors.changeset()
        |> Author.link()

      assert changeset.valid?
      assert authors == get_authors(changeset)
    end

    test "links non-existing authors to changeset, inserting them" do
      attrs = %{
        "authors" => [
          %{"name" => "Richard Burton"},
          %{"name" => "Isabel Burton"}
        ]
      }

      changeset =
        attrs
        |> WithManyAuthors.changeset()
        |> Author.link()

      assert changeset.valid?
      assert Author.all() == get_authors(changeset)
    end

    test "has no side effects when changeset is invalid" do
      changeset =
        %{"authors" => [%{}]}
        |> WithManyAuthors.changeset()
        |> Author.link()

      refute changeset.valid?
      assert Enum.empty?(Author.all())
    end
  end

  describe "link_fingerprint/1" do
    test "links fingerprint using author names to changeset" do
      attrs = %{
        "authors" => [
          %{"name" => "Richard Burton"},
          %{"name" => "Isabel Burton"}
        ]
      }

      changeset =
        attrs
        |> WithManyAuthors.changeset()
        |> Author.link_fingerprint()

      assert changeset.valid?
      assert Author.fingerprint(get_authors(changeset)) == get_fingerprint(changeset)
    end

    test "does not link fingerprint to invalid changeset" do
      changeset =
        %{"authors" => [%{}]}
        |> WithManyAuthors.changeset()
        |> Author.link_fingerprint()

      refute changeset.valid?
      assert is_nil(get_fingerprint(changeset))
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

      assert "Richard Burton, Isabel Burton" = Author.flatten(authors)
    end

    test "with a list of maps with atom keys, returns a list of maps with code key" do
      authors = [
        %{name: "Richard Burton"},
        %{name: "Isabel Burton"}
      ]

      assert "Richard Burton, Isabel Burton" = Author.flatten(authors)
    end

    test "with a list of Author structs, returns a list of maps with code key" do
      authors = [
        %Author{name: "Richard Burton"},
        %Author{name: "Isabel Burton"}
      ]

      assert "Richard Burton, Isabel Burton" = Author.flatten(authors)
    end
  end

  describe "nest/1" do
    test "with a comma separated string, returns a list of maps with code key" do
      authors = "Richard Burton, Isabel Burton"

      assert [%{"name" => "Richard Burton"}, %{"name" => "Isabel Burton"}] = Author.nest(authors)
    end
  end
end
