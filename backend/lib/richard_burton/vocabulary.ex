defmodule RichardBurton.Vocabulary do
  @moduledoc """
  The names a publication is built from — its translators, its original authors,
  its publishers — and the one thing that can be done to them: rename.

  These accumulate misspellings and near-duplicates, because they are typed.
  "Penguin books" beside "Penguin Books", "Alfred A.Knopf" beside
  "Alfred A. Knopf": the same publisher, entered twice, and every publication
  under the wrong spelling is filed away from its fellows.

  ## Renaming is the only verb

  There is no separate merge. Renaming to a name nothing else holds corrects a
  spelling; renaming to one that is already taken folds the two together, since
  a vocabulary cannot hold the same name twice. One operation answers both, and
  a person deciding "these are the same" says so by writing the name they should
  share.

  ## Why this is not an update to one row

  A publication's identity is a composite key built partly from *fingerprints*
  of these names. Rename a publisher and every publication it is on has a stale
  `publishers_fingerprint`; rename an author and the fingerprints of the
  translated book, the original book and the publication all follow. So a rename
  recomputes the chain it disturbs, in the same transaction.

  ## When the rename would uncover a duplicate

  Correcting a spelling can give two publications one identity — which is the
  duplicate the misspelling was hiding. The composite key is a unique index, so
  the database will not hold both, and there is no version of this that quietly
  succeeds.

  The rename is refused, and says which publications clashed. Merging them is a
  separate act, with its own survivor to choose and its own undo, and doing it
  silently inside a spelling correction would be a fold nobody asked for.
  """

  import Ecto.Query

  alias RichardBurton.Author
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Index.Refresher
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  @kinds %{"authors" => Author, "publishers" => Publisher}

  @doc """
  The kinds of name that can be managed, by the word the routes use.
  """
  def kinds, do: Map.keys(@kinds)

  @doc """
  Every name of this kind, with how many publications it is on, alphabetically.

  The count is what tells a name worth keeping from a stray: of the three
  spellings of one publisher, the one with nineteen publications is the one the
  others should become.
  """
  def all("authors"), do: Repo.all(author_counts())
  def all("publishers"), do: Repo.all(publisher_counts())
  def all(_kind), do: {:error, :no_such_kind}

  # A name may be a translator on one publication and the original author of
  # another, so the two paths are gathered before being counted. `union` rather
  # than `union_all`: somebody who is both on one publication is one name on one
  # publication, not two.
  defp author_counts do
    pairs = union(as_translator(), ^as_original_author())

    from(a in Author,
      left_join: pair in subquery(pairs),
      on: pair.author_id == a.id,
      group_by: [a.id, a.name],
      order_by: [asc: a.name],
      select: %{id: a.id, name: a.name, publications: count(pair.publication_id)}
    )
  end

  defp as_translator do
    from(p in Publication,
      join: ta in "translated_book_authors",
      on: ta.translated_book_id == p.translated_book_id,
      where: is_nil(p.deleted_at),
      select: %{author_id: ta.author_id, publication_id: p.id}
    )
  end

  defp as_original_author do
    from(p in Publication,
      join: tb in TranslatedBook,
      on: tb.id == p.translated_book_id,
      join: oa in "original_book_authors",
      on: oa.original_book_id == tb.original_book_id,
      where: is_nil(p.deleted_at),
      select: %{author_id: oa.author_id, publication_id: p.id}
    )
  end

  defp publisher_counts do
    from(p in Publisher,
      left_join: pub in assoc(p, :publications),
      on: is_nil(pub.deleted_at),
      group_by: [p.id, p.name],
      order_by: [asc: p.name],
      select: %{id: p.id, name: p.name, publications: count(pub.id)}
    )
  end

  @doc """
  Rename one, folding it into another where the name is already taken.

  Returns `{:ok, :renamed}` or `{:ok, :merged}`, so a caller can say which
  happened — they look the same from here and not to the person who asked.
  """
  def rename(kind, id, name) when is_binary(name) do
    with {:ok, schema} <- kind_of(kind),
         {:ok, name} <- named(name),
         {:ok, record} <- fetch(schema, id) do
      Repo.transaction(fn ->
        outcome = write(schema, record, name)
        recompute(schema, record, name)

        outcome
      end)
      |> case do
        {:ok, outcome} ->
          Refresher.refresh()
          {:ok, outcome}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp kind_of(kind) do
    case Map.fetch(@kinds, kind) do
      {:ok, schema} -> {:ok, schema}
      :error -> {:error, :no_such_kind}
    end
  end

  defp named(name) do
    case String.trim(name) do
      "" -> {:error, :blank}
      trimmed -> {:ok, trimmed}
    end
  end

  defp fetch(schema, id) do
    case Repo.get(schema, id) do
      nil -> {:error, :not_found}
      record -> {:ok, record}
    end
  end

  # The name is free, so this one takes it; or it is held, so this one is folded
  # into whoever holds it.
  defp write(schema, record, name) do
    case Repo.get_by(schema, name: name) do
      nil ->
        record |> Ecto.Changeset.change(name: name) |> Repo.update!()
        :renamed

      %{id: same} when same == record.id ->
        :renamed

      keeper ->
        Enum.each(joins(schema), &repoint(&1, record.id, keeper.id))
        Repo.delete!(record)
        :merged
    end
  end

  # The tables that point at a name, and the column they point with.
  defp joins(Author),
    do: [{"translated_book_authors", "author_id"}, {"original_book_authors", "author_id"}]

  defp joins(Publisher), do: [{"publication_publishers", "publisher_id"}]

  # Every reference moves to the keeper, except where that would say the same
  # thing twice — a book already crediting both spellings credits the keeper
  # once, not twice.
  defp repoint({table, column}, from, to) do
    other = other_column(table, column)

    Repo.query!(
      """
      DELETE FROM #{table} losing
      USING #{table} kept
      WHERE losing.#{column} = $1
        AND kept.#{column} = $2
        AND kept.#{other} = losing.#{other}
      """,
      [from, to]
    )

    Repo.query!("UPDATE #{table} SET #{column} = $2 WHERE #{column} = $1", [from, to])
  end

  defp other_column("translated_book_authors", _), do: "translated_book_id"
  defp other_column("original_book_authors", _), do: "original_book_id"
  defp other_column("publication_publishers", _), do: "publication_id"

  # Everything whose fingerprint was built from the name that changed.
  #
  # Read back from the database rather than tracked through the write: after a
  # fold there is one name where there were two, and what points at it is a
  # question for the tables, not for this function's memory.
  defp recompute(Author, _record, name) do
    case Repo.get_by(Author, name: name) do
      nil -> :ok
      author -> recompute_for_author(author)
    end
  end

  defp recompute(Publisher, _record, name) do
    case Repo.get_by(Publisher, name: name) do
      nil -> :ok
      publisher -> publisher |> publications_of_publisher() |> Enum.each(&refingerprint/1)
    end
  end

  # A name is not only on publications: it is on the books between. Two
  # spellings of one translator make two translated books that were only ever
  # told apart by the spelling, and those have identities of their own.
  #
  # So the same rule runs down the chain — where recomputing gives a book an
  # identity another already holds, the two are one book and are folded. Each
  # level is settled before the one above it reads from it.
  defp recompute_for_author(author) do
    # Held before anything is folded, since a translated book may be deleted on
    # the way and take a publication's route to it with it.
    publications = publication_ids_of_author(author)

    author |> original_books_of() |> Enum.each(&settle_original_book/1)
    author |> translated_books_of() |> Enum.each(&settle_translated_book/1)

    publications
    |> Enum.map(&Repo.get(Publication, &1))
    |> Enum.reject(&is_nil/1)
    |> Enum.each(&refingerprint/1)
  end

  defp original_books_of(author) do
    Repo.all(
      from(ob in OriginalBook,
        join: oa in "original_book_authors",
        on: oa.original_book_id == ob.id,
        where: oa.author_id == ^author.id
      )
    )
  end

  defp translated_books_of(author) do
    Repo.all(
      from(tb in TranslatedBook,
        join: ta in "translated_book_authors",
        on: ta.translated_book_id == tb.id,
        where: ta.author_id == ^author.id
      )
    )
  end

  # The book under its corrected authors, or folded into the book that already
  # is it.
  defp settle_original_book(original_book) do
    case Repo.get(OriginalBook, original_book.id) do
      nil -> :ok
      held -> settle_original_book(held, Repo.preload(held, :authors))
    end
  end

  defp settle_original_book(original_book, loaded) do
    fingerprint = Author.fingerprint(loaded.authors)

    keeper =
      Repo.one(
        from(ob in OriginalBook,
          where:
            ob.id != ^original_book.id and ob.title == ^original_book.title and
              ob.authors_fingerprint == ^fingerprint,
          limit: 1
        )
      )

    if keeper do
      Repo.update_all(
        from(tb in TranslatedBook, where: tb.original_book_id == ^original_book.id),
        set: [original_book_id: keeper.id]
      )

      unlink("original_book_authors", "original_book_id", original_book.id)
      Repo.delete!(original_book)
      retitle_translations(keeper)
    else
      original_book
      |> Ecto.Changeset.change(authors_fingerprint: fingerprint)
      |> Repo.update!()
      |> retitle_translations()
    end
  end

  # What credited a book that is being folded away. The rows point at it, so
  # they go first or the delete is refused.
  defp unlink(table, column, id) do
    Repo.query!("DELETE FROM #{table} WHERE #{column} = $1", [id])
  end

  # The book's own fingerprint is part of every translation of it.
  defp retitle_translations(original_book) do
    Repo.update_all(
      from(tb in TranslatedBook, where: tb.original_book_id == ^original_book.id),
      set: [original_book_fingerprint: OriginalBook.fingerprint(original_book)]
    )
  end

  # The translation under its corrected translators, or folded into the
  # translation that already is it.
  defp settle_translated_book(translated_book) do
    case Repo.get(TranslatedBook, translated_book.id) do
      nil -> :ok
      held -> settle_translated_book(held, Repo.preload(held, :authors))
    end
  end

  defp settle_translated_book(translated_book, loaded) do
    fingerprint = Author.fingerprint(loaded.authors)

    keeper =
      Repo.one(
        from(tb in TranslatedBook,
          where:
            tb.id != ^translated_book.id and tb.authors_fingerprint == ^fingerprint and
              tb.original_book_fingerprint == ^translated_book.original_book_fingerprint,
          limit: 1
        )
      )

    if keeper do
      Repo.update_all(
        from(p in Publication, where: p.translated_book_id == ^translated_book.id),
        set: [translated_book_id: keeper.id]
      )

      unlink("translated_book_authors", "translated_book_id", translated_book.id)
      Repo.delete!(translated_book)
    else
      translated_book
      |> Ecto.Changeset.change(authors_fingerprint: fingerprint)
      |> Repo.update!()
    end
  end

  # The publication's own composite key, rebuilt from what it now holds.
  #
  # Where that key is already another publication's, the whole rename is rolled
  # back: the two are the same publication under two spellings, and folding them
  # is a separate decision.
  defp refingerprint(publication) do
    publication =
      Repo.preload(publication, [:publishers, translated_book: [:authors, :original_book]])

    publishers = Publisher.fingerprint(publication.publishers)
    translated = TranslatedBook.fingerprint(publication.translated_book)

    # Asked before it is written rather than caught after: a statement the
    # database refuses aborts the transaction, and nothing further could be read
    # from it to say what had clashed.
    case clashing(publication, publishers, translated) do
      nil ->
        publication
        |> Ecto.Changeset.change(
          publishers_fingerprint: publishers,
          translated_book_fingerprint: translated
        )
        |> Repo.update!()

      held ->
        Repo.rollback({:would_collide, [summarise(publication), held]})
    end
  end

  defp summarise(publication) do
    %{id: publication.id, title: publication.title, year: publication.year}
  end

  # Whoever already holds the identity this publication is moving to, if
  # anybody: the same publication under the spelling being corrected.
  defp clashing(publication, publishers, translated) do
    Repo.one(
      from(p in Publication,
        where:
          p.id != ^publication.id and p.title == ^publication.title and
            p.year == ^publication.year and p.publishers_fingerprint == ^publishers and
            p.translated_book_fingerprint == ^translated and is_nil(p.deleted_at),
        select: %{id: p.id, title: p.title, year: p.year}
      )
    )
  end

  defp publication_ids_of_author(author) do
    union(as_translator(), ^as_original_author())
    |> Repo.all()
    |> Enum.filter(&(&1.author_id == author.id))
    |> Enum.map(& &1.publication_id)
  end

  defp publications_of_publisher(publisher) do
    Repo.all(
      from(p in Publication,
        join: pp in "publication_publishers",
        on: pp.publication_id == p.id,
        where: pp.publisher_id == ^publisher.id
      )
    )
  end
end
