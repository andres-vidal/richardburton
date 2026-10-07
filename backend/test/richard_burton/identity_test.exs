defmodule RichardBurton.IdentityTest do
  @moduledoc """
  Tests for the composite keys, the fingerprints they are built from, and the
  lookups of a stored row by its key, which the database computes, keeps up to
  date and runs.
  """
  use RichardBurton.DataCase

  import Ecto.Query

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
    %{rows: [[fingerprint]]} = Repo.query!("SELECT rb_set_fingerprint($1)", [names])
    fingerprint
  end

  defp stored(schema, id, field),
    do: Repo.one(from(r in schema, where: r.id == ^id, select: field(r, ^field)))

  # Writes a copy of the publication `first` straight to the tables, around
  # `Publication.insert/2`, so the copy has the same key.
  defp insert_copy(first) do
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
  end

  # Each of these looks up a single key, through the lookup that takes many.
  defp books_with_key(title, authors, translators),
    do: hd(Identity.books_with_keys([{title, authors, translators}]))

  defp publication_with_key(publication, excluded \\ nil),
    do: hd(Identity.publications_with_keys([publication], excluded))

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
      insert_copy(insert())

      assert {:error, :conflict} = Identity.settle()
    end

    test "leave the transaction usable after a conflict" do
      insert_copy(insert())

      assert {:error, :conflict} = Identity.settle()
      assert Repo.aggregate(Publication, :count) == 2
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

  describe "books_with_keys/1" do
    test "finds the stored books by their titles and names, in any order" do
      {:ok, publication} =
        Publication.insert(
          RichardBurton.Util.deep_merge_maps(@attrs, %{
            "translated_book" => %{
              "authors" => [%{"name" => "Helen Caldwell"}, %{"name" => "John Gledson"}],
              "original_book" => %{
                "authors" => [%{"name" => "Machado de Assis"}, %{"name" => "José de Alencar"}]
              }
            }
          })
        )

      translated = Repo.get!(TranslatedBook, publication.translated_book_id)

      assert books_with_key(
               "Dom Casmurro",
               ["José de Alencar", "Machado de Assis"],
               ["John Gledson", "Helen Caldwell"]
             ) == {translated.original_book_id, translated.id}
    end

    test "finds the original book but not a translation by other translators" do
      publication = insert()
      translated = Repo.get!(TranslatedBook, publication.translated_book_id)

      assert books_with_key("Dom Casmurro", ["Machado de Assis"], ["John Gledson"]) ==
               {translated.original_book_id, nil}
    end

    test "finds neither book when only some of the authors match" do
      insert()

      assert books_with_key("Dom Casmurro", ["Machado de Assis", "Alencar"], ["Helen Caldwell"]) ==
               {nil, nil}
    end

    test "finds neither book for another title" do
      insert()

      assert books_with_key("Iracema", ["Machado de Assis"], ["Helen Caldwell"]) == {nil, nil}
    end

    test "answers each key in order" do
      publication = insert()
      translated = Repo.get!(TranslatedBook, publication.translated_book_id)

      assert Identity.books_with_keys([
               {"Iracema", ["José de Alencar"], ["Isabel Burton"]},
               {"Dom Casmurro", ["Machado de Assis"], ["Helen Caldwell"]}
             ]) == [{nil, nil}, {translated.original_book_id, translated.id}]
    end
  end

  describe "publications_with_keys/2" do
    @flat %{
      title: "Dom Casmurro",
      year: 1953,
      countries: ["US"],
      publishers: ["Noonday Press"],
      authors: ["Helen Caldwell"],
      original_title: "Dom Casmurro",
      original_authors: ["Machado de Assis"]
    }

    test "finds the stored publication with the key" do
      publication = insert()

      assert publication_with_key(@flat) == publication.id
    end

    test "answers each publication in order, with nil for a key no publication has" do
      publication = insert()

      assert Identity.publications_with_keys([%{@flat | year: 1960}, @flat]) ==
               [nil, publication.id]
    end

    test "matches publishers and countries in any order" do
      publication =
        insert(%{
          "countries" => [%{"code" => "US"}, %{"code" => "GB"}],
          "publishers" => [%{"name" => "Noonday Press"}, %{"name" => "Knopf"}]
        })

      assert publication_with_key(%{
               @flat
               | countries: ["GB", "US"],
                 publishers: ["Knopf", "Noonday Press"]
             }) == publication.id
    end

    test "leaves out the excluded publication" do
      publication = insert()

      assert publication_with_key(@flat, publication.id) == nil
    end

    test "leaves out a deleted publication" do
      publication = insert()
      {:ok, _} = Publication.delete(publication.id)

      assert publication_with_key(@flat) == nil
    end

    test "returns nil when any part of the key differs" do
      insert()

      for change <- [
            %{title: "Epitaph of a Small Winner"},
            %{year: 1960},
            %{countries: ["GB"]},
            %{publishers: ["Knopf"]},
            %{authors: ["John Gledson"]},
            %{original_title: "Memórias Póstumas de Brás Cubas"},
            %{original_authors: ["José de Alencar"]}
          ] do
        assert publication_with_key(Map.merge(@flat, change)) == nil, inspect(change)
      end
    end
  end
end
