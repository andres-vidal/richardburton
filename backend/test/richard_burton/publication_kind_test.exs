defmodule RichardBurton.Publication.KindTest do
  @moduledoc """
  Tests `RichardBurton.Publication.Kind`: the kind of each publication of a
  query, and the kind of one publication with the publications it follows.
  """

  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Kind

  # The corpus holds three publications of Dom Casmurro: Helen Caldwell's
  # translation of 1953, the same translation published again in 1966, and
  # John Gledson's translation of 1997.
  setup do
    publications = seed_index(insights_corpus())

    [
      caldwell: edition(publications, "Helen Caldwell", 1953),
      reissue: edition(publications, "Helen Caldwell", 1966),
      gledson: edition(publications, "John Gledson", 1997)
    ]
  end

  # Returns the publication of `publications` translated by `translator` in
  # `year`.
  defp edition(publications, translator, year) do
    Enum.find(publications, fn publication ->
      publication.year == year and
        Enum.any?(publication.translated_book.authors, &(&1.name == translator))
    end)
  end

  # Returns the kind of the publication `id` and the ids of the publications it
  # follows, read with `Kind.of/1`.
  defp kind_of(id) do
    %{kind: kind, follows: follows} = id |> Publication.find() |> Kind.of()
    {kind, Enum.map(follows, & &1.id)}
  end

  # Returns a map from the id of each publication of `source` to its kind and
  # the ids of the publications it follows, read with `Kind.ranked/1`.
  defp ranked(source) do
    source |> Kind.ranked() |> Repo.all() |> Map.new(&{&1.id, {&1.kind, &1.follows}})
  end

  describe "all/0" do
    test "lists the kinds in the order the module doc defines them" do
      assert Kind.all() == ["first_translation", "retranslation", "reissue"]
    end
  end

  describe "ranked/1" do
    test "tells each publication of the index its kind and the publication it follows",
         meta do
      ranked = ranked(FlatPublication)

      assert map_size(ranked) == 7
      assert ranked[meta.caldwell.id] == {"first_translation", []}
      assert ranked[meta.reissue.id] == {"reissue", [meta.caldwell.id]}
      assert ranked[meta.gledson.id] == {"retranslation", [meta.caldwell.id]}

      # The other works have one publication each.
      assert ranked
             |> Map.drop([meta.caldwell.id, meta.reissue.id, meta.gledson.id])
             |> Map.values()
             |> Enum.all?(&(&1 == {"first_translation", []}))
    end

    test "compares the publications of the source with each other only", meta do
      ranked = ranked(from(fp in FlatPublication, where: fp.year > 1960))

      assert ranked[meta.caldwell.id] == nil
      assert ranked[meta.reissue.id] == {"first_translation", []}
      assert ranked[meta.gledson.id] == {"retranslation", [meta.reissue.id]}
    end

    test "counts every publication of a translation's first year as a first edition", meta do
      # Caldwell's translation is also published in London in 1953. It is
      # entered last, and is a first edition all the same.
      london = publication_fixture(%{countries: ["GB"], publishers: ["Peter Owen"]})
      ranked = ranked(FlatPublication)
      first_editions = Enum.sort([meta.caldwell.id, london.id])

      assert ranked[meta.caldwell.id] == {"first_translation", []}
      assert ranked[london.id] == {"first_translation", []}
      assert ranked[meta.reissue.id] == {"reissue", first_editions}
      assert ranked[meta.gledson.id] == {"retranslation", first_editions}
    end

    test "counts every translation of a work's first year as a first translation", meta do
      # A second translation of Dom Casmurro is published in 1953, the year of
      # Caldwell's.
      scott = publication_fixture(%{authors: ["R. L. Scott-Buccleuch"], countries: ["GB"]})
      ranked = ranked(FlatPublication)

      assert ranked[meta.caldwell.id] == {"first_translation", []}
      assert ranked[scott.id] == {"first_translation", []}
      assert ranked[meta.reissue.id] == {"reissue", [meta.caldwell.id]}

      assert ranked[meta.gledson.id] ==
               {"retranslation", Enum.sort([meta.caldwell.id, scott.id])}
    end

    test "makes a publication a reissue only when its translation appeared in an earlier year",
         meta do
      # Gledson's translation is published again in 1997, and once more in
      # 1998.
      again = publication_fixture(%{year: 1997, authors: ["John Gledson"], countries: ["US"]})
      later = publication_fixture(%{year: 1998, authors: ["John Gledson"]})
      ranked = ranked(FlatPublication)
      first_editions = Enum.sort([meta.gledson.id, again.id])

      assert ranked[meta.gledson.id] == {"retranslation", [meta.caldwell.id]}
      assert ranked[again.id] == {"retranslation", [meta.caldwell.id]}
      assert ranked[later.id] == {"reissue", first_editions}
    end
  end

  describe "of/1" do
    test "names the work's first publication for a retranslation", meta do
      assert %{kind: "retranslation", follows: [follows]} =
               meta.gledson.id |> Publication.find() |> Kind.of()

      assert follows.id == meta.caldwell.id
      assert follows.title == "Dom Casmurro"
      assert follows.year == 1953
      assert [%{name: "Helen Caldwell"}] = follows.translated_book.authors
    end

    test "names the first publication of the translation for a reissue", meta do
      assert kind_of(meta.reissue.id) == {"reissue", [meta.caldwell.id]}
    end

    test "names every first edition of the translation, in id order, for a reissue", meta do
      london = publication_fixture(%{countries: ["GB"], publishers: ["Peter Owen"]})

      assert %{kind: "reissue", follows: [first, second]} =
               meta.reissue.id |> Publication.find() |> Kind.of()

      assert [first.id, second.id] == [meta.caldwell.id, london.id]
      assert [%{name: "Noonday Press"}] = first.publishers
      assert [%{name: "Peter Owen"}] = second.publishers
    end

    test "names none for a first translation", meta do
      assert kind_of(meta.caldwell.id) == {"first_translation", []}
    end

    test "leaves out deleted publications, so the next one becomes the first", meta do
      {:ok, _} = Publication.delete(meta.caldwell.id)

      assert kind_of(meta.reissue.id) == {"first_translation", []}
      assert kind_of(meta.gledson.id) == {"retranslation", [meta.reissue.id]}
    end

    test "leaves out a record a merge absorbed", meta do
      # A record of Caldwell's translation entered with the wrong year is the
      # earliest publication of the work until it is merged into the right one.
      misdated = publication_fixture(%{year: 1952})

      assert kind_of(misdated.id) == {"first_translation", []}
      assert kind_of(meta.caldwell.id) == {"reissue", [misdated.id]}
      assert kind_of(meta.gledson.id) == {"retranslation", [misdated.id]}

      {:ok, _} = Publication.merge(meta.caldwell.id, [misdated.id])

      assert kind_of(meta.caldwell.id) == {"first_translation", []}
      assert kind_of(meta.gledson.id) == {"retranslation", [meta.caldwell.id]}
    end
  end
end
