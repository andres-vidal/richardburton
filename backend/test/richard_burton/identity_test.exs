defmodule RichardBurton.IdentityTest do
  @moduledoc """
  Tests for the composite keys and the fingerprints they are built from, which
  the database computes and keeps up to date.
  """
  use RichardBurton.DataCase

  import Ecto.Query
  import RichardBurton.Identity, only: [fingerprint: 1]

  alias RichardBurton.Author
  alias RichardBurton.Identity
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.TranslatedBook

  @attrs %{
    "title" => "Dom Casmurro",
    "year" => 1953,
    "countries" => [%{"code" => "US"}],
    "publishers" => [%{"name" => "Noonday Press"}],
    "translated_book" => %{
      "authors" => [%{"name" => "Helen Caldwell"}],
      "original_book" => %{
        "title" => "Dom Casmurro",
        "authors" => [%{"name" => "Machado de Assis"}]
      }
    }
  }

  defp insert(attrs \\ %{}) do
    {:ok, publication} = Publication.insert(RichardBurton.Util.deep_merge_maps(@attrs, attrs))
    publication
  end

  # The fingerprint the database computes for `names`.
  defp fingerprint_of(names) do
    Repo.one(from(x in fragment("SELECT 1"), select: fingerprint(^names)))
  end

  defp stored(schema, id, field),
    do: Repo.one(from(r in schema, where: r.id == ^id, select: field(r, ^field)))

  describe "a fingerprint" do
    test "is the uppercase hex SHA-256 of the names, sorted and joined with NUL" do
      expected = :crypto.hash(:sha256, "Ann\0Bob") |> Base.encode16()

      assert fingerprint_of(["Bob", "Ann"]) == expected
    end

    test "is the same for the same names in another order" do
      assert fingerprint_of(["Isabel Burton", "Richard Burton"]) ==
               fingerprint_of(["Richard Burton", "Isabel Burton"])
    end

    test "differs for different names" do
      refute fingerprint_of(["Richard Burton"]) ==
               fingerprint_of(["Richard Burton", "Isabel Burton"])
    end

    test "differs for sets whose names concatenate the same" do
      refute fingerprint_of(["AnnBob"]) == fingerprint_of(["Ann", "Bob"])
    end

    test "of no names is the hash of nothing" do
      assert fingerprint_of([]) == :crypto.hash(:sha256, "") |> Base.encode16()
    end
  end

  describe "the stored fingerprints" do
    test "are written from a publication's links when it is inserted" do
      publication = insert(%{"publishers" => [%{"name" => "Noonday"}, %{"name" => "Knopf"}]})

      assert stored(Publication, publication.id, :publishers_fingerprint) ==
               fingerprint_of(["Knopf", "Noonday"])

      assert stored(Publication, publication.id, :countries_fingerprint) == fingerprint_of(["US"])

      assert stored(TranslatedBook, publication.translated_book_id, :authors_fingerprint) ==
               fingerprint_of(["Helen Caldwell"])
    end

    test "follow a link removed by an edit" do
      publication = insert(%{"publishers" => [%{"name" => "Noonday"}, %{"name" => "Knopf"}]})

      {:ok, _} =
        Publication.update(publication.id, %{@attrs | "publishers" => [%{"name" => "Knopf"}]})

      assert stored(Publication, publication.id, :publishers_fingerprint) ==
               fingerprint_of(["Knopf"])
    end

    test "follow a renamed publisher" do
      publication = insert()

      Repo.update_all(from(p in Publisher, where: p.name == "Noonday Press"),
        set: [name: "The Noonday Press"]
      )

      assert stored(Publication, publication.id, :publishers_fingerprint) ==
               fingerprint_of(["The Noonday Press"])
    end

    test "follow a renamed author, as translator and as original author" do
      publication = insert()
      translated = Repo.get!(TranslatedBook, publication.translated_book_id)

      for {from, to} <- [{"Helen Caldwell", "Helen M. Caldwell"}, {"Machado de Assis", "Machado"}] do
        Repo.update_all(from(a in Author, where: a.name == ^from), set: [name: to])
      end

      assert stored(TranslatedBook, translated.id, :authors_fingerprint) ==
               fingerprint_of(["Helen M. Caldwell"])

      assert stored(OriginalBook, translated.original_book_id, :authors_fingerprint) ==
               fingerprint_of(["Machado"])
    end

    test "follow a country whose code changes" do
      publication = insert()

      Repo.update_all(from(c in "countries", where: c.code == "US"), set: [code: "XU"])

      assert stored(Publication, publication.id, :countries_fingerprint) == fingerprint_of(["XU"])
    end
  end

  describe "the composite keys" do
    test "settle when no two rows share one" do
      insert()

      assert :ok = Identity.settle()
    end

    test "are refused for a second publication with the same key, when settled" do
      first = insert()

      # A copy written straight to the table, around `Publication.insert/2`.
      Repo.insert_all("publications", [
        %{
          title: first.title,
          year: first.year,
          translated_book_id: first.translated_book_id,
          inserted_at: NaiveDateTime.utc_now(:second),
          updated_at: NaiveDateTime.utc_now(:second)
        }
      ])

      [copy] = Repo.all(from(p in Publication, where: p.id != ^first.id, select: p.id))

      Repo.insert_all("publication_countries", [
        %{publication_id: copy, country_id: hd(Repo.preload(first, :countries).countries).id}
      ])

      Repo.insert_all("publication_publishers", [
        %{publication_id: copy, publisher_id: hd(Repo.preload(first, :publishers).publishers).id}
      ])

      assert {:error, :conflict} = Identity.settle()
    end

    test "let a publication pass through another's key while its links are written" do
      # The first has one publisher; the second has that one and another, so it
      # matches the first's key until its second publisher is linked.
      insert()

      assert {:ok, _} =
               Publication.insert(
                 RichardBurton.Util.deep_merge_maps(@attrs, %{
                   "publishers" => [%{"name" => "Noonday Press"}, %{"name" => "Knopf"}]
                 })
               )
    end

    test "ignore a deleted publication" do
      deleted = insert()
      {:ok, _} = Publication.delete(deleted.id)

      assert {:ok, _} = Publication.insert(@attrs)
    end
  end
end
