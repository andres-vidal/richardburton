defmodule RichardBurton.Vocabulary do
  @moduledoc """
  Lists, checks and renames the names that publications are built from:
  authors, who are translators or original authors, and publishers.

  These names are typed by hand, so one name can be stored under two
  spellings, such as "Penguin books" and "Penguin Books", or "Alfred A.Knopf"
  and "Alfred A. Knopf". Each spelling is a separate record, and each
  publication links to only one of them.

  A *kind* is `"authors"` or `"publishers"`, the word the routes use for each
  schema.

  ## Renaming and folding

  `rename/4` is the only function that changes a name. There is no separate
  merge. Names are unique within a kind, so a rename has one of two outcomes:

    * `:renamed` means the new name is free, and the record takes it.
    * `:merged` means another record, the *keeper*, already has the new name.
      The renamed record is *folded* into the keeper: its links move to the
      keeper and the record is deleted.

  A fold cannot be undone, so `rename/4` folds only when its `folding?`
  argument is true.

  ## Recomputing fingerprints

  A publication's composite key includes fingerprints built from these names.
  A publisher's name is part of `publishers_fingerprint`. An author's name is
  part of the `authors_fingerprint` of the original and translated books, and
  those are part of the publication's `translated_book_fingerprint`.
  `rename/4` recomputes every fingerprint built from the renamed name, in the
  same transaction as the rename. When this gives a book the same identity as
  another book, the two books are folded into one.

  ## Renames that would duplicate a publication

  A rename can give two publications the same title, year and fingerprints.
  This happens when one publication was entered twice and the two copies
  differ only in the spelling of a name. The composite key is a unique index,
  so the database cannot store both.

  In that case `rename/4` rolls back and returns
  `{:error, {:would_collide, publications}}`, listing the two publications. It
  does not merge them. Merging publications is done by
  `RichardBurton.Publication.merge/3`, which takes the publication to keep and
  can be undone.

  ## Checking names before they are entered

  `resemblances/2` compares names that are not stored yet with the stored
  names. A name is *held* when a record has exactly that name. A name
  *resembles* a stored name when the two differ but their trigram similarity,
  with accents removed, is above 0.7. A name that is neither held nor
  resembles a stored name is new.
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

  # The trigram similarity above which two names are treated as possible
  # spellings of one name.
  #
  # The value comes from measuring pairs of names in the database. Publishers
  # that only share a word score about 0.6, for example "Duke University Press"
  # and "Texas University Press", or "Arc Publications" and "Host
  # Publications". Misspellings score above 0.7 once accents are removed.
  # "Clifford E. Landers" and "Clifford Landers" score 0.89. A change of case,
  # or a dropped space after punctuation as in "Alfred A.Knopf", scores 1.0.
  @resemblance_threshold 0.7

  # Builds a query condition that is true when the two names, with accents
  # removed, have a trigram similarity above the threshold.
  #
  # The `%` operator reads the threshold from `pg_trgm.similarity_threshold`,
  # which `in_threshold/1` sets. Accents are removed because the same name is
  # often entered with and without them. "Adelia Prado" and "Adélia Prado" are
  # one person, but on the raw strings that pair scores lower than two
  # unrelated publishers.
  defmacrop alike(left, right) do
    quote do: fragment("unaccent(?) % unaccent(?)", unquote(left), unquote(right))
  end

  @doc """
  Returns the kinds of name, as the words the routes use.
  """
  def kinds, do: Map.keys(@kinds)

  @doc """
  Returns every name of the given kind, sorted by name, as
  `%{id:, name:, publications:, resembles:}`.

  `publications` counts the publications that credit the name and are not
  deleted. `resembles` lists the ids of the other names of this kind that the
  name resembles. Each of those ids is also in the returned list.

  Returns `{:error, :no_such_kind}` when the kind is unknown.
  """
  def all(kind) do
    with {:ok, schema} <- kind_of(kind) do
      schema |> counts() |> Repo.all() |> with_likenesses(schema)
    end
  end

  defp counts(Author), do: author_counts()
  defp counts(Publisher), do: publisher_counts()

  # Adds `resembles` to each entry: the ids of the other stored names that the
  # entry's name resembles. The self-join returns each pair once from each
  # side, so both names in a pair list each other.
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

  # Builds the query that counts, for each author, the publications that are
  # not deleted and credit the author as translator or as original author. It
  # uses `union` rather than `union_all`, so an author who is both translator
  # and original author of one publication counts it once.
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
  Compares the given names with the stored names of the given kind.

  Returns `{:ok, entries}`, with one `%{name:, held:, resembles:}` per name.
  `held` is true when a stored name matches exactly. `resembles` lists the
  stored names that resemble it, as `%{id:, name:, publications:}`, with the
  most used first.

  The names are trimmed, blank names are dropped, and a repeated name appears
  once. Returns `{:error, :no_such_kind}` when the kind is unknown.
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

  # Returns a map from each asked name to the stored names it resembles, with
  # their publication counts, most used first. An asked name that resembles
  # nothing is not in the map.
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

  # Runs `query` in a transaction that sets `pg_trgm.similarity_threshold` to
  # `@resemblance_threshold`, and returns its result. The `true` argument to
  # `set_config` limits the setting to this transaction. Without it, the
  # setting would stay on the pooled connection and apply to later queries.
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
  Renames the name with the given id. When another name of the same kind
  already has the new name, folds this one into it.

  The new name is trimmed. Returns `{:ok, :renamed}` when the record takes the
  new name, and `{:ok, :merged}` when it is folded. After either, it calls
  `Refresher.refresh/0`.

  A fold happens only when `folding?` is true. When it is false and the name is
  taken, nothing is written and the result is `{:error, {:would_fold, keeper}}`,
  where `keeper` is `%{id:, name:, publications:}`. A rename onto a free name
  needs no flag, because renaming back undoes it.

  The other errors are `{:error, {:would_collide, publications}}` (see the
  module doc), `{:error, :blank}`, `{:error, :not_found}` and
  `{:error, :no_such_kind}`.
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

  # Returns :ok when the rename may go ahead. When `folding?` is false and
  # another record already has the new name, returns `:would_fold` as an error
  # with that record and its publication count.
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

  # Gives the record the new name and returns :renamed when the name is free or
  # is already the record's own. When another record has the name, moves the
  # record's links to that keeper, deletes the record and returns :merged.
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

  # Returns the join tables that reference a name of this schema, each with its
  # foreign key column.
  defp joins(Author),
    do: [{"translated_book_authors", "author_id"}, {"original_book_authors", "author_id"}]

  defp joins(Publisher), do: [{"publication_publishers", "publisher_id"}]

  # Moves a join table's rows from the name id `from` to the name id `to`. It
  # first deletes the rows that would become duplicates, where one book or
  # publication already links to both names, so each links to `to` once.
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

  # Recomputes every fingerprint built from the new name.
  #
  # It looks the record up by the new name instead of using `record`. After a
  # fold, the name belongs to the keeper, whose links now include the ones moved
  # from `record`.
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

  # Settles the original books the author wrote, then the translated books the
  # author translated, then recomputes the fingerprints of the author's
  # publications.
  #
  # Books have unique identities built from their authors' names. When the new
  # fingerprint gives a book the same identity as another book, the two are
  # folded into one. Original books go first because a translated book's
  # identity includes its original book's fingerprint, and translated books go
  # before publications for the same reason.
  defp recompute_for_author(author) do
    # Reads the publication ids before any book is folded, because folding
    # deletes books and their author links.
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

  # Reloads the original book and recomputes its `authors_fingerprint`. When
  # another original book has the same title and fingerprint, moves this book's
  # translations to it and deletes this one. Otherwise stores the fingerprint.
  # In both cases it then updates `original_book_fingerprint` on the translated
  # books. Does nothing when the book no longer exists.
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

  # Deletes the author links of a book that is about to be deleted. The links
  # reference the book, so the database refuses to delete it while they exist.
  defp unlink(table, column, id) do
    Repo.query!("DELETE FROM #{table} WHERE #{column} = $1", [id])
  end

  # Writes the original book's fingerprint into `original_book_fingerprint` on
  # every translated book of it.
  defp retitle_translations(original_book) do
    Repo.update_all(
      from(tb in TranslatedBook, where: tb.original_book_id == ^original_book.id),
      set: [original_book_fingerprint: OriginalBook.fingerprint(original_book)]
    )
  end

  # Reloads the translated book and recomputes its `authors_fingerprint`. When
  # another translated book has the same authors and original book
  # fingerprints, moves this book's publications to it and deletes this one.
  # Otherwise stores the fingerprint. Does nothing when the book no longer
  # exists.
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

  # Recomputes and stores the publication's `publishers_fingerprint` and
  # `translated_book_fingerprint`.
  #
  # When `clashing/3` finds another publication with the same title, year and
  # fingerprints, it rolls back the whole rename with
  # `{:would_collide, [publication, other]}`, each as `%{id:, title:, year:}`.
  defp refingerprint(publication) do
    publication =
      Repo.preload(publication, [:publishers, translated_book: [:authors, :original_book]])

    publishers = Publisher.fingerprint(publication.publishers)
    translated = TranslatedBook.fingerprint(publication.translated_book)

    # Checks for a clash before writing, instead of catching the unique index
    # error. A failed statement aborts the transaction, and after that the
    # clashing publication could not be read.
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

  # Returns the other publication, not deleted, that has the same title and
  # year as this one and the given publishers and translated book
  # fingerprints, or nil.
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
