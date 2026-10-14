defmodule RichardBurton.Publication.DuplicatesTest do
  @moduledoc """
  Tests for the duplicate-candidate search
  """
  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Duplicates
  alias RichardBurton.Publication.History
  alias RichardBurton.Util

  # Inserts another translator's translation of the same book, which is the
  # subject matter of this database, not a mistake in it.
  defp by_another_translator(title, translator, year) do
    publication_fixture(%{title: title, year: year, authors: [translator]})
  end

  # Inserts a publication of another work, by another translator.
  defp another_work(title, original_title, author, year) do
    publication_fixture(%{
      title: title,
      year: year,
      authors: ["Isabel Burton"],
      original_title: original_title,
      original_authors: [author]
    })
  end

  # Returns a row: the flat publication `flat_publication_attrs/1` returns,
  # with string keys and no id, as validation takes it, and with `attrs`, given
  # with string keys, in place of its own fields.
  defp row(attrs), do: flat_publication_attrs() |> Util.stringify_keys() |> Map.merge(attrs)

  defp titles(clusters) do
    Enum.map(clusters, fn cluster -> Enum.map(cluster.publications, & &1.title) end)
  end

  describe "clusters/0" do
    test "unrelated works are nothing to review" do
      publication_fixture()
      another_work("Iraçéma the Honey-Lips", "Iracema", "José de Alencar", 1886)

      assert [] == Duplicates.clusters()
    end

    test "two translations of one book are two publications, not a duplicate" do
      publication_fixture()
      by_another_translator("Dom Casmurro", "John Gledson", 1997)

      # Same title, same original book, same author — and still not the same
      # record. Only the translator tells them apart, which is why it decides.
      assert [] == Duplicates.clusters()
    end

    test "records the composite key cannot see are put together" do
      # A typo in the title: two records, one publication.
      publication_fixture()
      publication_fixture(%{title: "Dom Casmuro"})

      assert [["Dom Casmuro", "Dom Casmurro"]] = titles(Duplicates.clusters())
    end

    test "records whose comments differ are put together all the same" do
      publication_fixture(%{comments: "Bought in 1953."})
      publication_fixture(%{title: "Dom Casmuro", comments: "A note of another kind."})

      assert [["Dom Casmuro", "Dom Casmurro"]] = titles(Duplicates.clusters())
    end

    test "one translator's work entered under another title is found by the book behind it" do
      publication_fixture()
      publication_fixture(%{title: "The Confessions of a Jealous Man"})

      assert [cluster] = Duplicates.clusters()
      assert 2 == length(cluster.publications)
    end

    # The year, the countries and the publishers rule a pair out when they
    # differ, because a printing of its own is another publication.
    test "another printing, with a year of its own, is not offered" do
      publication_fixture()
      publication_fixture(%{title: "The Confessions of a Jealous Man", year: 1997})

      assert [] == Duplicates.clusters()
    end

    test "records joined through a third are one question, because merging them is one act" do
      publication_fixture()
      publication_fixture(%{title: "Dom Casmuro"})
      publication_fixture(%{title: "Dom Casmurr"})

      assert [cluster] = Duplicates.clusters()
      assert 3 == length(cluster.publications)
    end

    test "the likelier cluster is offered first" do
      # All but the same title — barely a difference at all.
      publication_fixture()
      publication_fixture(%{title: "Dom Casmuro"})

      # The same translator's other book, retitled: alike enough to ask about,
      # but nowhere near as alike.
      another_work("Iraçéma the Honey-Lips", "Iracema", "José de Alencar", 1886)

      publication_fixture(%{
        title: "Iracema, the Honey-Lips: A Legend",
        year: 1886,
        authors: ["Isabel Burton"],
        original_title: "Iracema",
        original_authors: ["José de Alencar"]
      })

      assert [closest, _further] = Duplicates.clusters()
      assert ["Dom Casmuro", "Dom Casmurro"] = Enum.map(closest.publications, & &1.title)
    end

    test "a record that has left the database is not offered" do
      publication_fixture()
      twin = publication_fixture(%{title: "Dom Casmuro"})

      {:ok, _} = Publication.delete(twin.id)

      assert [] == Duplicates.clusters()
    end

    test "a pair ruled apart is no longer asked about" do
      one = publication_fixture()
      other = publication_fixture(%{title: "Dom Casmuro"})

      assert [_] = Duplicates.clusters()

      {:ok, 1} = Duplicates.rule_apart([one.id, other.id], "admin@example.com")

      assert [] == Duplicates.clusters()
    end

    test "telling one pair apart can split a cluster rather than shrink it" do
      middle = publication_fixture(%{title: "Dom Casmuro"})
      left = publication_fixture()
      right = publication_fixture(%{title: "Dom Casmur"})

      assert [%{publications: [_, _, _]}] = Duplicates.clusters()

      # The two ends are alike only through the middle; ruling out one edge
      # leaves the other pair to be asked about on its own.
      {:ok, _} = Duplicates.rule_apart([middle.id, left.id], "admin@example.com")
      {:ok, _} = Duplicates.rule_apart([left.id, right.id], "admin@example.com")

      assert [%{publications: remaining}] = Duplicates.clusters()
      assert [middle.id, right.id] == remaining |> Enum.map(& &1.id) |> Enum.sort()
    end

    test "finds any number of clusters with the same number of queries" do
      publication_fixture()
      publication_fixture(%{title: "Dom Casmuro"})
      {[_], one} = count_queries(&Duplicates.clusters/0)

      another_work("Iraçéma the Honey-Lips", "Iracema", "José de Alencar", 1886)
      another_work("Iracema, the Honey-Lips", "Iracema", "José de Alencar", 1886)
      {[_, _], two} = count_queries(&Duplicates.clusters/0)

      assert one == two
    end
  end

  describe "rule_apart/2" do
    test "remembers every pair among the records it was given" do
      [a, b, c] = [
        publication_fixture(),
        publication_fixture(%{title: "Dom Casmuro"}),
        publication_fixture(%{title: "Dom C"})
      ]

      assert {:ok, 3} = Duplicates.rule_apart([a.id, b.id, c.id], "admin@example.com")
    end

    test "saying the same thing twice remembers it once" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})

      assert {:ok, 1} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      assert {:ok, 0} = Duplicates.rule_apart([b.id, a.id], "someone.else@example.com")
    end

    test "one record on its own is nothing to rule apart" do
      a = publication_fixture()

      assert {:error, :not_enough} = Duplicates.rule_apart([a.id], "admin@example.com")
    end
  end

  describe "reconsider/2" do
    test "puts the pair back among the questions" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})

      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      assert [] == Duplicates.clusters()

      assert {:ok, 1} = Duplicates.reconsider([a.id, b.id], "admin@example.com")
      assert [_] = Duplicates.clusters()
    end

    test "forgets every pair among the records, as ruling apart recorded them" do
      [a, b, c] = [
        publication_fixture(),
        publication_fixture(%{title: "Dom Casmuro"}),
        publication_fixture(%{title: "Dom C"})
      ]

      {:ok, 3} = Duplicates.rule_apart([a.id, b.id, c.id], "admin@example.com")

      assert {:ok, 3} = Duplicates.reconsider([a.id, b.id, c.id], "admin@example.com")
    end

    test "taking back what was never decided is not an error" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})

      assert {:ok, 0} = Duplicates.reconsider([a.id, b.id], "admin@example.com")
    end
  end

  describe "decisions in the history" do
    # Returns the actions of a publication's history, newest first.
    defp actions(publication), do: publication.id |> History.of() |> Enum.map(& &1.action)

    # Returns the ids of the other publications that the latest entry of a
    # publication's history is about, in order.
    defp others(publication) do
      publication.id |> History.of() |> hd() |> History.other_records() |> Enum.map(& &1["id"])
    end

    test "ruling apart records it on each publication, naming the others, under who said so" do
      [a, b, c] = [
        publication_fixture(),
        publication_fixture(%{title: "Dom Casmuro"}),
        publication_fixture(%{title: "Dom C"})
      ]

      {:ok, 3} = Duplicates.rule_apart([a.id, b.id, c.id], "reviewer@example.com")

      for publication <- [a, b, c] do
        assert [%{action: "distinguished", actor: "reviewer@example.com", diff: nil} | _] =
                 History.of(publication.id)
      end

      assert others(a) == [b.id, c.id]
      assert others(b) == [a.id, c.id]
    end

    test "saying the same thing twice records it once" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})

      {:ok, 1} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      {:ok, 0} = Duplicates.rule_apart([b.id, a.id], "someone.else@example.com")

      assert actions(a) == ["distinguished", "created"]
    end

    test "taking a decision back records it on each publication, and taking back nothing records nothing" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})

      {:ok, 0} = Duplicates.reconsider([a.id, b.id], "admin@example.com")
      assert actions(a) == ["created"]

      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      {:ok, 1} = Duplicates.reconsider([a.id, b.id], "reviewer@example.com")

      assert [%{action: "reconsidered", actor: "reviewer@example.com"} | _] = History.of(b.id)
      assert actions(a) == ["reconsidered", "distinguished", "created"]
      assert others(a) == [b.id]
    end

    test "a decision is not undone from the history, and does not hold back the entry before it" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})
      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")

      [decision, created] = History.of(a.id)

      assert {decision.action, decision.undoable} == {"distinguished", false}
      assert {created.action, created.undoable} == {"created", true}
      assert Publication.undo(a.id, decision.version) == {:error, :conflict}

      # Undoing the import deletes the publication, as it did before the decision.
      assert {:ok, _} = Publication.undo(a.id, created.version)
      assert Publication.find(a.id) == nil
    end

    test "a merge clears the distinctions among the merged records without recording a decision" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})
      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")

      {:ok, _} = Publication.merge(a.id, [b.id], "admin@example.com")

      assert actions(a) == ["merged", "distinguished", "created"]
      assert Duplicates.ruled_apart() == []
    end
  end

  describe "ruled_apart/0" do
    test "says which records were ruled apart, and by whom" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})
      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")

      assert [%{publications: [_, _], actor: "admin@example.com"}] = Duplicates.ruled_apart()
    end

    test "leaves out a pair one of whose records is gone" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})
      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")

      {:ok, _} = Publication.delete(b.id)

      # Nothing left to ask about, so nothing to offer taking back.
      assert [] == Duplicates.ruled_apart()
    end

    test "lists the pairs newest first, each ordered by title, with two queries" do
      [a, b, c] = [
        publication_fixture(),
        publication_fixture(%{title: "Dom Casmuro"}),
        publication_fixture(%{title: "Dom C"})
      ]

      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "first@example.com")
      {:ok, _} = Duplicates.rule_apart([c.id, a.id], "second@example.com")

      assert {pairs, 2} = count_queries(&Duplicates.ruled_apart/0)

      assert Enum.map(pairs, &{&1.actor, Enum.map(&1.publications, fn p -> p.title end)}) == [
               {"second@example.com", ["Dom C", "Dom Casmurro"]},
               {"first@example.com", ["Dom Casmuro", "Dom Casmurro"]}
             ]
    end
  end

  describe "a merge and a distinction, which answer the same question" do
    test "merging forgets the distinction, so an un-merge asks again" do
      a = publication_fixture()
      b = publication_fixture(%{title: "Dom Casmuro"})

      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      {:ok, _} = Publication.merge(a.id, [b.id], "admin@example.com")

      [merge | _] = History.of(a.id)
      {:ok, _} = Publication.undo(a.id, merge.version, "admin@example.com")

      # Both are live again and still alike, so the question is live again too:
      # the merge was the later answer, and taking it back leaves none.
      assert [_] = Duplicates.clusters()
    end
  end

  describe "threshold/0" do
    test "is tunable without a code change" do
      original = Application.get_env(:richard_burton, :duplicate_threshold)

      # Put the key back the way it was found — set to nil is not the same as
      # unset, and the module's default only applies to the latter.
      on_exit(fn ->
        if original,
          do: Application.put_env(:richard_burton, :duplicate_threshold, original),
          else: Application.delete_env(:richard_burton, :duplicate_threshold)
      end)

      # Two of one translator's books, one titled almost like the other: alike
      # by their titles alone, which is what the threshold governs.
      publication_fixture()

      publication_fixture(%{title: "Dom Casmuro", original_title: "Quincas Borba"})

      # Asking for near-identity finds nothing; loosening it finds the pair.
      Application.put_env(:richard_burton, :duplicate_threshold, 0.99)
      assert [] == Duplicates.clusters()

      Application.put_env(:richard_burton, :duplicate_threshold, 0.5)
      assert [_] = Duplicates.clusters()
    end
  end

  describe "resemblances/1" do
    test "an empty list asks nothing of the database" do
      assert [] == Duplicates.resemblances([])
    end

    test "a row unlike anything stored is not reported" do
      publication_fixture()

      assert [] ==
               Duplicates.resemblances([
                 row(%{
                   "title" => "Iracema the Honey-Lips",
                   "authors" => ["Isabel Burton"],
                   "original_title" => "Iracema",
                   "original_authors" => ["Jose de Alencar"]
                 })
               ])
    end

    test "comments play no part in a resemblance or a repeat" do
      stored = publication_fixture(%{comments: "Bought in 1953."})

      assert [%{position: 0, stored: [found]}, %{position: 1, repeats: 0}] =
               Duplicates.resemblances([
                 row(%{"title" => "Dom Casmuro", "comments" => "Another note."}),
                 row(%{"title" => "Dom Casmuro", "comments" => "A third note."})
               ])

      assert found.id == stored.id
    end

    test "a row that all but spells a stored record is reported against it" do
      stored = publication_fixture()

      assert [%{position: 0, stored: [found], others: []}] =
               Duplicates.resemblances([row(%{"title" => "Dom Casmuro"})])

      assert found.id == stored.id
    end

    test "another translator is not a duplicate, here as anywhere" do
      publication_fixture()

      # The row has the same book and title as the stored record, but a
      # different translator. The rule requires similar translators, so
      # `resemblances/1` does not report it, as `clusters/0` would not.
      assert [] ==
               Duplicates.resemblances([row(%{"authors" => ["John Gledson"]})])
    end

    test "a row from another publisher is another edition, not a look-alike" do
      publication_fixture()

      assert [] ==
               Duplicates.resemblances([
                 row(%{"title" => "Dom Casmuro", "publishers" => ["Penguin Classics"]})
               ])
    end

    test "a row published in another country is another edition, not a look-alike" do
      publication_fixture()

      assert [] ==
               Duplicates.resemblances([row(%{"title" => "Dom Casmuro", "countries" => ["GB"]})])
    end

    test "a row published in another year is another edition, not a look-alike" do
      publication_fixture()

      assert [] == Duplicates.resemblances([row(%{"title" => "Dom Casmuro", "year" => "1997"})])
    end

    test "a row that shares one of its countries with a record still resembles it" do
      publication_fixture()

      assert [%{position: 0}] =
               Duplicates.resemblances([
                 row(%{"title" => "Dom Casmuro", "countries" => ["GB", "US"]})
               ])
    end

    test "a publisher written in full agrees with its short form" do
      publication_fixture(%{publishers: ["Alfred A. Knopf"]})

      assert [%{position: 0}] =
               Duplicates.resemblances([
                 row(%{"title" => "Dom Casmuro", "publishers" => ["Knopf"]})
               ])
    end

    # A field rules a look-alike out only when both sides have a value for it.
    test "a row that leaves the year, countries and publishers empty still resembles a record" do
      publication_fixture()

      assert [%{position: 0}] =
               Duplicates.resemblances([
                 row(%{
                   "title" => "Dom Casmuro",
                   "year" => "",
                   "countries" => [],
                   "publishers" => []
                 })
               ])
    end

    test "two rows can resemble each other with nothing stored at all" do
      assert [%{position: 0, others: [1], stored: []}, %{position: 1, others: [0], stored: []}] =
               Duplicates.resemblances([row(%{}), row(%{"title" => "Dom Casmuro"})])
    end

    test "a row is named by its position, so the ones with nothing to say are absent" do
      publication_fixture()

      assert [%{position: 1}] =
               Duplicates.resemblances([
                 row(%{
                   "title" => "Iracema the Honey-Lips",
                   "authors" => ["Isabel Burton"],
                   "original_title" => "Iracema",
                   "original_authors" => ["Jose de Alencar"]
                 }),
                 row(%{})
               ])
    end

    test "a differently titled row still resembles through the original book" do
      publication_fixture()

      # The titles differ, but the translators and the original book match, so
      # the rule still reports the row. This is how a retitled edition is found.
      assert [%{position: 0, stored: [_]}] =
               Duplicates.resemblances([
                 row(%{"title" => "The Fruits of Silence"})
               ])
    end

    test "a row with no translators resembles nothing" do
      publication_fixture()

      assert [] == Duplicates.resemblances([row(%{"authors" => []})])
    end

    test "a row with the same key as an earlier row repeats it" do
      assert [
               %{position: 0, others: [1], repeats: nil},
               %{position: 1, others: [0], repeats: 0}
             ] = Duplicates.resemblances([row(%{}), row(%{})])
    end

    test "every later row with a key repeats the first row with it, whatever the order of its lists" do
      two = %{"publishers" => ["Noonday Press", "Farrar"], "countries" => ["US", "GB"]}
      reordered = %{"publishers" => ["Farrar", "Noonday Press"], "countries" => ["UK", "US"]}

      entries =
        Duplicates.resemblances([
          row(two),
          row(%{"title" => "Dom Casmuro"}),
          row(reordered),
          row(two)
        ])

      assert [nil, nil, 0, 0] == Enum.map(entries, & &1.repeats)
    end

    test "a row that names its country agrees with a record that holds its code" do
      publication_fixture()

      assert [%{position: 0, stored: [_]}] =
               Duplicates.resemblances([
                 row(%{"title" => "Dom Casmuro", "countries" => ["United States"]})
               ])
    end

    test "a row is not a repeat of a stored record, which validation reports instead" do
      publication_fixture()

      assert [%{position: 0, repeats: nil, stored: [_]}] = Duplicates.resemblances([row(%{})])
    end

    test "rows missing a field of the key repeat nothing" do
      assert [%{repeats: nil}, %{repeats: nil}] =
               Duplicates.resemblances([row(%{"year" => ""}), row(%{"year" => ""})])
    end
  end
end
