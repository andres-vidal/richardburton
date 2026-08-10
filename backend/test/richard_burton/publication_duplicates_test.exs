defmodule RichardBurton.Publication.DuplicatesTest do
  @moduledoc """
  Tests for the duplicate-candidate search
  """
  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Duplicates
  alias RichardBurton.Util

  @base %{
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

  defp insert(attrs) do
    {:ok, publication} = Publication.insert(Util.deep_merge_maps(@base, attrs))
    # Duplicates are read from the flattened publications, which are
    # materialized; a single insert doesn't signal the refresher, so stand in for
    # the caller that would.
    Publication.Index.Refresher.refresh()
    publication
  end

  # Another translator's rendering of the same book — the subject matter of this
  # database, not a mistake in it.
  defp by_another_translator(title, translator, year) do
    insert(%{
      "title" => title,
      "year" => year,
      "translated_book" => %{"authors" => [%{"name" => translator}]}
    })
  end

  # A wholly different work, by a different hand.
  defp another_work(title, original_title, author, year) do
    insert(%{
      "title" => title,
      "year" => year,
      "translated_book" => %{
        "authors" => [%{"name" => "Isabel Burton"}],
        "original_book" => %{"title" => original_title, "authors" => [%{"name" => author}]}
      }
    })
  end

  defp titles(clusters) do
    Enum.map(clusters, fn cluster -> Enum.map(cluster.publications, & &1.title) end)
  end

  describe "clusters/0" do
    test "unrelated works are nothing to review" do
      insert(%{})
      another_work("Iraçéma the Honey-Lips", "Iracema", "José de Alencar", 1886)

      assert [] == Duplicates.clusters()
    end

    test "two translations of one book are two publications, not a duplicate" do
      insert(%{})
      by_another_translator("Dom Casmurro", "John Gledson", 1997)

      # Same title, same original book, same author — and still not the same
      # record. Only the translator tells them apart, which is why it decides.
      assert [] == Duplicates.clusters()
    end

    test "records the composite key cannot see are put together" do
      # A typo in the title: two records, one publication.
      insert(%{})
      insert(%{"title" => "Dom Casmuro"})

      assert [["Dom Casmuro", "Dom Casmurro"]] = titles(Duplicates.clusters())
    end

    test "one translator's work retitled between printings is found by the book behind it" do
      insert(%{})
      insert(%{"title" => "The Confessions of a Jealous Man", "year" => 1997})

      assert [cluster] = Duplicates.clusters()
      assert 2 == length(cluster.publications)
    end

    test "records joined through a third are one question, because merging them is one act" do
      insert(%{})
      insert(%{"title" => "Dom Casmuro"})
      insert(%{"title" => "Dom Casmurr"})

      assert [cluster] = Duplicates.clusters()
      assert 3 == length(cluster.publications)
    end

    test "the likelier cluster is offered first" do
      # All but the same title — barely a difference at all.
      insert(%{})
      insert(%{"title" => "Dom Casmuro"})

      # The same translator's other book, retitled: alike enough to ask about,
      # but nowhere near as alike.
      another_work("Iraçéma the Honey-Lips", "Iracema", "José de Alencar", 1886)

      insert(%{
        "title" => "Iracema, the Honey-Lips: A Legend",
        "year" => 1887,
        "translated_book" => %{
          "authors" => [%{"name" => "Isabel Burton"}],
          "original_book" => %{
            "title" => "Iracema",
            "authors" => [%{"name" => "José de Alencar"}]
          }
        }
      })

      assert [closest, _further] = Duplicates.clusters()
      assert ["Dom Casmuro", "Dom Casmurro"] = Enum.map(closest.publications, & &1.title)
    end

    test "a record that has left the database is not offered" do
      insert(%{})
      twin = insert(%{"title" => "Dom Casmuro"})

      {:ok, _} = Publication.delete(twin.id)

      assert [] == Duplicates.clusters()
    end

    test "a pair ruled apart is no longer asked about" do
      one = insert(%{})
      other = insert(%{"title" => "Dom Casmuro"})

      assert [_] = Duplicates.clusters()

      {:ok, 1} = Duplicates.rule_apart([one.id, other.id], "admin@example.com")

      assert [] == Duplicates.clusters()
    end

    test "telling one pair apart can split a cluster rather than shrink it" do
      middle = insert(%{"title" => "Dom Casmuro"})
      left = insert(%{})
      right = insert(%{"title" => "Dom Casmur"})

      assert [%{publications: [_, _, _]}] = Duplicates.clusters()

      # The two ends are alike only through the middle; ruling out one edge
      # leaves the other pair to be asked about on its own.
      {:ok, _} = Duplicates.rule_apart([middle.id, left.id], "admin@example.com")
      {:ok, _} = Duplicates.rule_apart([left.id, right.id], "admin@example.com")

      assert [%{publications: remaining}] = Duplicates.clusters()
      assert [middle.id, right.id] == remaining |> Enum.map(& &1.id) |> Enum.sort()
    end
  end

  describe "rule_apart/2" do
    test "remembers every pair among the records it was given" do
      [a, b, c] = [
        insert(%{}),
        insert(%{"title" => "Dom Casmuro"}),
        insert(%{"title" => "Dom C"})
      ]

      assert {:ok, 3} = Duplicates.rule_apart([a.id, b.id, c.id], "admin@example.com")
    end

    test "saying the same thing twice remembers it once" do
      a = insert(%{})
      b = insert(%{"title" => "Dom Casmuro"})

      assert {:ok, 1} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      assert {:ok, 0} = Duplicates.rule_apart([b.id, a.id], "someone.else@example.com")
    end

    test "one record on its own is nothing to rule apart" do
      a = insert(%{})

      assert {:error, :not_enough} = Duplicates.rule_apart([a.id], "admin@example.com")
    end
  end

  describe "reconsider/1" do
    test "puts the pair back among the questions" do
      a = insert(%{})
      b = insert(%{"title" => "Dom Casmuro"})

      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      assert [] == Duplicates.clusters()

      assert {:ok, 1} = Duplicates.reconsider([a.id, b.id])
      assert [_] = Duplicates.clusters()
    end

    test "forgets every pair among the records, as ruling apart recorded them" do
      [a, b, c] = [
        insert(%{}),
        insert(%{"title" => "Dom Casmuro"}),
        insert(%{"title" => "Dom C"})
      ]

      {:ok, 3} = Duplicates.rule_apart([a.id, b.id, c.id], "admin@example.com")

      assert {:ok, 3} = Duplicates.reconsider([a.id, b.id, c.id])
    end

    test "taking back what was never decided is not an error" do
      a = insert(%{})
      b = insert(%{"title" => "Dom Casmuro"})

      assert {:ok, 0} = Duplicates.reconsider([a.id, b.id])
    end
  end

  describe "ruled_apart/0" do
    test "says which records were ruled apart, and by whom" do
      a = insert(%{})
      b = insert(%{"title" => "Dom Casmuro"})
      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")

      assert [%{publications: [_, _], actor: "admin@example.com"}] = Duplicates.ruled_apart()
    end

    test "leaves out a pair one of whose records is gone" do
      a = insert(%{})
      b = insert(%{"title" => "Dom Casmuro"})
      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")

      {:ok, _} = Publication.delete(b.id)
      Publication.Index.Refresher.refresh()

      # Nothing left to ask about, so nothing to offer taking back.
      assert [] == Duplicates.ruled_apart()
    end
  end

  describe "a merge and a distinction, which answer the same question" do
    test "merging forgets the distinction, so an un-merge asks again" do
      a = insert(%{})
      b = insert(%{"title" => "Dom Casmuro"})

      {:ok, _} = Duplicates.rule_apart([a.id, b.id], "admin@example.com")
      {:ok, _} = Publication.merge(a.id, [b.id], "admin@example.com")
      Publication.Index.Refresher.refresh()

      [merge | _] = Publication.History.of(a.id)
      {:ok, _} = Publication.undo(a.id, merge.version, "admin@example.com")
      Publication.Index.Refresher.refresh()

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
      insert(%{})

      insert(%{
        "title" => "Dom Casmuro",
        "translated_book" => %{
          "original_book" => %{
            "title" => "Quincas Borba",
            "authors" => [%{"name" => "Machado de Assis"}]
          }
        }
      })

      # Asking for near-identity finds nothing; loosening it finds the pair.
      Application.put_env(:richard_burton, :duplicate_threshold, 0.99)
      assert [] == Duplicates.clusters()

      Application.put_env(:richard_burton, :duplicate_threshold, 0.5)
      assert [_] = Duplicates.clusters()
    end
  end
end
