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

  # Inserts the publication `publication_attrs/1` returns for `changes`, and
  # commits it.
  defp stored(changes \\ %{}), do: unboxed(fn -> publication_fixture(changes) end)

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
    stored(%{year: 1960})

    insert = fn -> Publication.insert(publication_attrs()) end

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(insert, insert)

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
  end

  test "the same publication of a new book, inserted twice at once, is stored once" do
    # The names are stored with another of Machado's books, so the race is over
    # the new original book and the publication.
    stored(%{title: "Philosopher or Dog?", original_title: "Quincas Borba"})

    insert = fn -> Publication.insert(publication_attrs()) end

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(insert, insert)

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]
  end

  test "two translations of a new book inserted at once store the book once, and both are stored" do
    # Both translators are stored, with another book, so the race is over the
    # new original book that both translations share.
    stored(%{
      title: "Philosopher or Dog?",
      authors: ["Helen Caldwell", "John Gledson"],
      original_title: "Quincas Borba"
    })

    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.insert(publication_attrs()) end,
               fn -> Publication.insert(publication_attrs(%{authors: ["John Gledson"]})) end
             )

    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]
    assert count_rows("translated_books") == [[3]]
  end

  test "two imports that share a new book at once store the book once, and both are stored" do
    # Both translators are stored with Quincas Borba, so the race is over the
    # new original book, Dom Casmurro.
    quincas_borba = %{
      title: "Philosopher or Dog?",
      authors: ["Helen Caldwell", "John Gledson"],
      original_title: "Quincas Borba"
    }

    stored(quincas_borba)

    reprinted = publication_attrs(Map.put(quincas_borba, :year, 1960))
    by_gledson = publication_attrs(%{authors: ["John Gledson"]})

    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.insert_all([publication_attrs()]) end,
               fn -> Publication.insert_all([reprinted, by_gledson]) end
             )

    assert count_rows("original_books WHERE title = 'Dom Casmurro'") == [[1]]
    assert count_live(title: "Philosopher or Dog?", year: 1960) == 1
    assert count_live(title: "Dom Casmurro", year: 1953) == 2
  end

  test "two imports of the same publication at once store it once, and the second returns the row" do
    stored(%{year: 1960})
    attrs = publication_attrs()

    assert %{first: {:ok, _}, second: {:error, {^attrs, :conflict}}, waited: true} =
             race(
               fn -> Publication.insert_all([attrs]) end,
               fn -> Publication.insert_all([attrs]) end
             )

    assert count_live(title: "Dom Casmurro", year: 1953) == 1
  end

  test "two edits that would give two publications the same key at once leave the second unchanged" do
    a = stored(%{year: 1953})
    b = stored(%{year: 1954})

    assert %{first: {:ok, _}, second: {:error, :conflict}, waited: true} =
             race(
               fn -> Publication.update(a.id, publication_attrs(%{year: 1955})) end,
               fn -> Publication.update(b.id, publication_attrs(%{year: 1955})) end
             )

    assert count_live(title: "Dom Casmurro", year: 1955) == 1
    assert count_live(title: "Dom Casmurro", year: 1954) == 1
  end

  test "restoring a publication while the same one is inserted again leaves it deleted, and names the other" do
    deleted = stored()
    {:ok, _} = unboxed(fn -> Publication.delete(deleted.id) end)

    assert %{first: {:ok, inserted}, second: {:error, {:conflict, twin}}, waited: true} =
             race(
               fn -> Publication.insert(publication_attrs()) end,
               fn -> Publication.restore(deleted.id) end
             )

    assert twin.id == inserted.id
    assert count_live(title: "Dom Casmurro", year: 1953) == 1
    assert unboxed(fn -> Repo.get!(Publication, deleted.id).deleted_at end)
  end
end
