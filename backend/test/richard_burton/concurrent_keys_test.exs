defmodule RichardBurton.ConcurrentKeysTest do
  @moduledoc """
  Tests for two writes that race over a composite key, raced with
  `RichardBurton.RaceCase`: the same publication or book written twice at once,
  or two edits and restores that would give two publications the same key.

  The names each race uses (authors, publishers and countries) are stored
  beforehand, so that the race is over a composite key and not over a name.
  """

  use RichardBurton.RaceCase

  alias RichardBurton.Publication
  alias RichardBurton.Util

  @dom_casmurro %{
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

  # Inserts `@dom_casmurro` with `attrs` merged in, and commits it.
  defp stored(attrs \\ %{}) do
    {:ok, publication} = unboxed(fn -> Publication.insert(dom_casmurro(attrs)) end)
    publication
  end

  defp dom_casmurro(attrs), do: Util.deep_merge_maps(@dom_casmurro, attrs)

  # Returns the number of stored publications matching `where`, deleted ones
  # left out.
  defp count_live(where) do
    unboxed(fn ->
      Repo.one(
        from(p in Publication, where: ^where, where: is_nil(p.deleted_at), select: count())
      )
    end)
  end

  defp count_rows(table) do
    unboxed(fn -> Repo.query!("SELECT count(*) FROM #{table}").rows end)
  end

  test "the same publication of a stored book, inserted twice at once, is stored once" do
    stored(%{"year" => 1960})

    insert = fn -> Publication.insert(@dom_casmurro) end

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(insert, insert)

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
  end

  test "the same publication of a new book, inserted twice at once, is stored once" do
    # The names are stored with another of Machado's books, so the race is over
    # the new original book and the publication.
    stored(%{
      "title" => "Philosopher or Dog?",
      "translated_book" => %{"original_book" => %{"title" => "Quincas Borba"}}
    })

    insert = fn -> Publication.insert(@dom_casmurro) end

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(insert, insert)

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]
  end

  test "two translations of a new book inserted at once store the book once, and the second succeeds when retried" do
    # Both translators are stored, with another book, so the race is over the
    # new original book that both translations share.
    stored(%{
      "title" => "Philosopher or Dog?",
      "translated_book" => %{
        "authors" => [%{"name" => "Helen Caldwell"}, %{"name" => "John Gledson"}],
        "original_book" => %{"title" => "Quincas Borba"}
      }
    })

    by_gledson =
      dom_casmurro(%{"translated_book" => %{"authors" => [%{"name" => "John Gledson"}]}})

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(
               fn -> Publication.insert(@dom_casmurro) end,
               fn -> Publication.insert(by_gledson) end
             )

    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]

    assert {:ok, _} = unboxed(fn -> Publication.insert(by_gledson) end)
    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]
    assert count_rows("translated_books") == [[3]]
  end

  test "two imports that share a new book at once store the book once, and the second returns its first row with the book" do
    # Both translators are stored with Quincas Borba, so the race is over the
    # new original book, Dom Casmurro.
    quincas_borba = %{
      "title" => "Philosopher or Dog?",
      "translated_book" => %{
        "authors" => [%{"name" => "Helen Caldwell"}, %{"name" => "John Gledson"}],
        "original_book" => %{"title" => "Quincas Borba"}
      }
    }

    stored(quincas_borba)

    reprinted = dom_casmurro(Map.put(quincas_borba, "year", 1960))

    by_gledson =
      dom_casmurro(%{"translated_book" => %{"authors" => [%{"name" => "John Gledson"}]}})

    assert %{first: {:ok, _}, second: {:error, {^by_gledson, :conflict}}, waited: true} =
             race(
               fn -> Publication.insert_all([@dom_casmurro]) end,
               fn -> Publication.insert_all([reprinted, by_gledson]) end
             )

    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]
    assert count_live(title: "Philosopher or Dog?", year: 1960) == 0
  end

  test "two imports of the same publication at once store it once, and the second returns the row" do
    stored(%{"year" => 1960})

    assert %{first: {:ok, _}, second: {:error, {@dom_casmurro, :conflict}}, waited: true} =
             race(
               fn -> Publication.insert_all([@dom_casmurro]) end,
               fn -> Publication.insert_all([@dom_casmurro]) end
             )

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
  end

  test "two edits that would give two publications the same key at once leave the second unchanged" do
    a = stored(%{"year" => 1953})
    b = stored(%{"year" => 1954})

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(
               fn -> Publication.update(a.id, dom_casmurro(%{"year" => 1955})) end,
               fn -> Publication.update(b.id, dom_casmurro(%{"year" => 1955})) end
             )

    assert count_live(title: "Dom Casmurro", year: 1955) == 1
    assert count_live(title: "Dom Casmurro", year: 1954) == 1
  end

  test "restoring a publication while the same one is inserted again leaves it deleted" do
    deleted = stored()
    {:ok, _} = unboxed(fn -> Publication.delete(deleted.id) end)

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(
               fn -> Publication.insert(@dom_casmurro) end,
               fn -> Publication.restore(deleted.id) end
             )

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
    assert unboxed(fn -> Repo.get!(Publication, deleted.id).deleted_at end)
  end
end
