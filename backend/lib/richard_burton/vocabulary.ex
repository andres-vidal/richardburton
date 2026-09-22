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

  ## Catching a misspelling before it is one

  `resemblances/2` answers the same question from the other end: given names
  that are about to be entered, which of them are close to a name already here
  without being it. A name is *held* when the vocabulary already has it exactly,
  and *resembles* another when trigram similarity puts them over the threshold
  while the two strings differ.

  Held is the good outcome and resembling is the doubtful one. A name that is
  neither is simply new, which is how a vocabulary grows.
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

  # How alike two names must be for one to be worth raising as a possible
  # misspelling of the other.
  #
  # Chosen against the database rather than in the abstract, because the two
  # populations overlap on raw trigram distance. Houses that merely share a word
  # sit around 0.6 — "Duke University Press" against "Texas University Press",
  # "Arc Publications" against "Host Publications". Misspellings sit above 0.7
  # once accents are out of the way: "Clifford E. Landers" against "Clifford
  # Landers" is 0.89, and every dropped space or swapped case is 1.0.
  @resemblance_threshold 0.7

  # Whether two names are near enough to be the same name spelt twice.
  #
  # `%` is `similarity(a, b) > threshold`, reading the threshold from the setting
  # `in_threshold/1` puts in place. It compares the unaccented names because an
  # accent is one of the ways a name gets entered twice: "Adelia Prado" beside
  # "Adélia Prado" is one person, and on the raw strings that pair scores lower
  # than two unrelated presses do.
  defmacrop alike(left, right) do
    quote do: fragment("unaccent(?) % unaccent(?)", unquote(left), unquote(right))
  end

  @doc """
  The kinds of name that can be managed, by the word the routes use.
  """
  def kinds, do: Map.keys(@kinds)

  @doc """
  Every name of this kind, with how many publications it is on, alphabetically,
  and which of the others it resembles.

  The count is what tells a name worth keeping from a stray: of the three
  spellings of one publisher, the one with nineteen publications is the one the
  others should become.

  `resembles` holds ids rather than names, since the names they point at are in
  this same list.
  """
  def all(kind) do
    with {:ok, schema} <- kind_of(kind) do
      schema |> counts() |> Repo.all() |> with_likenesses(schema)
    end
  end

  defp counts(Author), do: author_counts()
  defp counts(Publisher), do: publisher_counts()

  # Which names are near which, over the vocabulary itself rather than against
  # names arriving from elsewhere. Every pair appears twice, once from each side,
  # so each name carries its own neighbours.
  defp with_likenesses(entries, schema) do
    near =
      in_threshold(fn ->
        Repo.all(
          from(a in schema,
            join: b in ^schema,
            on: alike(a.name, b.name) and a.id != b.id,
            select: %{id: a.id, other: b.id}
          )
        )
      end)
      |> Enum.group_by(& &1.id, & &1.other)

    Enum.map(entries, &Map.put(&1, :resembles, Map.get(near, &1.id, [])))
  end

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
  Which of these names the vocabulary already holds, and which look like
  misspellings of one it holds.

  Each name comes back as `%{name:, held:, resembles: [...]}`, where
  `resembles` lists the existing names near it, most used first — the count is
  what says which spelling the database has settled on.

  Names are trimmed, blanks dropped and repeats collapsed, so a caller can pass
  a column straight out of a spreadsheet.
  """
  def resemblances(kind, names) when is_list(names) do
    with {:ok, schema} <- kind_of(kind) do
      asked = names |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == "")) |> Enum.uniq()

      {:ok, answer(schema, asked)}
    end
  end

  defp answer(_schema, []), do: []

  defp answer(schema, asked) do
    held = held(schema, asked)
    near = near(schema, asked)

    Enum.map(asked, fn name ->
      %{
        name: name,
        held: MapSet.member?(held, name),
        resembles: Map.get(near, name, [])
      }
    end)
  end

  defp held(schema, asked) do
    from(v in schema, where: v.name in ^asked, select: v.name)
    |> Repo.all()
    |> MapSet.new()
  end

  # The names each asked-for name is near, keyed by the name that was asked.
  defp near(schema, asked) do
    rows = in_threshold(fn -> Repo.all(resembling(schema, asked)) end)
    counts = counts_of(schema, Enum.map(rows, & &1.id))

    rows
    |> Enum.group_by(& &1.asked, &Map.get(counts, &1.id))
    |> Map.new(fn {asked, found} ->
      {asked, found |> Enum.reject(&is_nil/1) |> Enum.sort_by(& &1.publications, :desc)}
    end)
  end

  defp resembling(schema, asked) do
    from(v in schema,
      join: a in fragment("SELECT * FROM unnest(?::text[]) AS a(name)", ^asked),
      on: alike(v.name, a.name) and v.name != a.name,
      select: %{asked: a.name, id: v.id}
    )
  end

  # Runs the query with the threshold `%` reads in place. `set_config` with
  # `true` scopes the setting to the transaction rather than to the connection,
  # which is pooled and would otherwise carry it to unrelated work.
  defp in_threshold(query) do
    {:ok, rows} =
      Repo.transaction(fn ->
        Repo.query!(
          "SELECT set_config('pg_trgm.similarity_threshold', $1, true)",
          [to_string(@resemblance_threshold)]
        )

        query.()
      end)

    rows
  end

  defp counts_of(Author, ids), do: by_id(author_counts(), ids)
  defp counts_of(Publisher, ids), do: by_id(publisher_counts(), ids)

  defp by_id(counts, ids) do
    from(c in subquery(counts), where: c.id in ^ids)
    |> Repo.all()
    |> Map.new(&{&1.id, &1})
  end

  @doc """
  Rename one, folding it into another where the name is already taken.

  Returns `{:ok, :renamed}` or `{:ok, :merged}`, so a caller can say which
  happened — they look the same from here and not to the person who asked.

  The two are not equally undoable, though, and a fold has to be asked for.
  Where the name is already held and `folding?` is false, nothing is written and
  `{:error, {:would_fold, keeper}}` says who holds it and how many publications
  are on them. Correcting a spelling onto a free name needs no such permission:
  renaming back undoes it.

  Asked here rather than by whoever is calling, because only the database knows
  whether the name is free at the moment it is written.
  """
  def rename(kind, id, name, folding? \\ false) when is_binary(name) do
    with {:ok, schema} <- kind_of(kind),
         {:ok, name} <- named(name),
         {:ok, record} <- fetch(schema, id),
         :ok <- permitted(schema, record, name, folding?) do
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

  # Whether this rename is the one that was asked for. A rename that would fold
  # needs saying so; one that would not is allowed through.
  defp permitted(_schema, _record, _name, true), do: :ok

  defp permitted(schema, record, name, false) do
    case Repo.get_by(schema, name: name) do
      nil -> :ok
      %{id: same} when same == record.id -> :ok
      keeper -> {:error, {:would_fold, counted(schema, keeper)}}
    end
  end

  defp counted(schema, record) do
    counts = counts_of(schema, [record.id])

    Map.get(counts, record.id, %{id: record.id, name: record.name, publications: 0})
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
