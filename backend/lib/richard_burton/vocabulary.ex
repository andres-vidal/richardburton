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

  ## Books that become one

  The composite keys of books and publications include fingerprints of these
  names, which the database recomputes when a name changes or a link moves
  (see `RichardBurton.Identity`). A publisher's name is part of a
  publication's key. An author's name is part of the key of each original
  book they wrote and each translated book they translated.

  When a rename gives a book the same key as an older book, `rename/4` folds
  the newer book into the older one, in the same transaction: the newer book's
  translations, or its publications, move to the older book, and the newer
  book is deleted. When two original books are folded and each has a
  translation by the same translators, those two translations are folded into
  one as well.

  ## Renames that would duplicate a publication

  A rename can give two publications the same composite key: the same title,
  year and translated book, and the same publishers and countries. This
  happens when one publication was entered twice and the two copies differ
  only in the spelling of a name. The composite key applies to the
  publications that are not deleted, so the database cannot store both.

  In that case `rename/4` rolls back and returns
  `{:error, {:would_collide, publications}}`, listing the two publications. It
  does not merge them. Merging publications is done by
  `RichardBurton.Publication.merge/3`, which takes the publication to keep and
  can be undone.

  Deleted publications follow the rename as well, so a restored publication
  matches its names. They are never reported as a collision, because the
  composite key does not cover them.

  ## Checking names before they are entered

  `resemblances/2` compares names that are not stored yet with the stored
  names. A name is *held* when a record has exactly that name. A name
  *resembles* a stored name when the two differ but their trigram similarity,
  with accents removed, is above 0.7. A name that is neither held nor
  resembles a stored name is new.

  Two publishers' names also resemble each other when one contains the other's
  words, as "Alfred A. Knopf" contains "Knopf". Authors' names do not, because
  one author record can hold two people, such as "William L. Grossman & Helen
  Caldwell", and each person's own name would then resemble it.
  """

  import Ecto.Query

  alias RichardBurton.Author
  alias RichardBurton.Identity
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

  # The `word_similarity` at or above which one publisher's name counts as
  # containing another's words. Containing every word scores 1.0. The
  # threshold is slightly lower so that a word that differs only in its ending
  # still counts: "Penguin Book" scores 0.92 against "Penguin Books".
  @contained 0.9

  # Builds a query condition on the `name` of a query's first two bindings,
  # true when the two names may be spellings of one name of the schema's kind.
  # For authors, the names, with accents removed, must have a trigram
  # similarity above the threshold. For publishers, it is also enough that
  # one name contains the other's words.
  #
  # The `%` operator reads the threshold from `pg_trgm.similarity_threshold`,
  # which `in_threshold/1` sets. Accents are removed because the same name is
  # often entered with and without them. "Adelia Prado" and "Adélia Prado" are
  # one person, but on the raw strings that pair scores lower than two
  # unrelated publishers.
  defp alike(Author) do
    dynamic([a, b], fragment("unaccent(?) % unaccent(?)", a.name, b.name))
  end

  defp alike(Publisher) do
    dynamic(
      [a, b],
      fragment(
        "(unaccent(?) % unaccent(?) OR greatest(word_similarity(unaccent(?), unaccent(?)), word_similarity(unaccent(?), unaccent(?))) >= ?)",
        a.name,
        b.name,
        a.name,
        b.name,
        b.name,
        a.name,
        @contained
      )
    )
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
            on: ^alike(schema),
            where: a.id != b.id,
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
      on: ^alike(schema),
      where: v.name != a.name,
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
        fold_books(schema, name)
        refuse_collision()
        settle!()

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

  # Folds the books the rename gave the same key as an older book. The
  # database has already recomputed every fingerprint built from the name.
  #
  # It looks the author up by the new name instead of using the renamed record.
  # After a fold, the name belongs to the keeper, whose links now include the
  # ones moved from the renamed record. A publisher's name is part of no book's
  # key, so there is nothing to fold for a publisher.
  defp fold_books(Author, name) do
    author = Repo.get_by!(Author, name: name)

    author |> original_books_of() |> Enum.each(&settle_original_book/1)
    author |> translated_books_of() |> Enum.each(&settle_translated_book/1)
  end

  defp fold_books(Publisher, _name), do: :ok

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

  # Folds the original book into an older book with the same key, when there is
  # one. Does nothing when the book has already been folded away.
  defp settle_original_book(book) do
    with %OriginalBook{} = held <- Repo.get(OriginalBook, book.id),
         %OriginalBook{} = keeper <- older_twin(held, [:title, :authors_fingerprint]) do
      fold_original_book(held, keeper)
    end
  end

  # Moves the translations of `book` to `keeper` and deletes `book`. A
  # translation by the same translators as one the keeper already has is folded
  # into the keeper's translation instead of moved, since the two are now the
  # same translated book.
  defp fold_original_book(book, keeper) do
    from(tb in TranslatedBook, where: tb.original_book_id == ^book.id)
    |> Repo.all()
    |> Enum.each(fn translation ->
      case Repo.get_by(TranslatedBook,
             original_book_id: keeper.id,
             authors_fingerprint: translation.authors_fingerprint
           ) do
        nil -> repoint_translation(translation, keeper)
        twin -> fold_translated_book(translation, twin)
      end
    end)

    unlink("original_book_authors", "original_book_id", book.id)
    Repo.delete!(book)
  end

  defp repoint_translation(translation, original_book) do
    Repo.update_all(
      from(tb in TranslatedBook, where: tb.id == ^translation.id),
      set: [original_book_id: original_book.id]
    )
  end

  # Folds the translated book into an older book with the same key, when there
  # is one. Does nothing when the book has already been folded away.
  defp settle_translated_book(book) do
    with %TranslatedBook{} = held <- Repo.get(TranslatedBook, book.id),
         %TranslatedBook{} = keeper <-
           older_twin(held, [:original_book_id, :authors_fingerprint]) do
      fold_translated_book(held, keeper)
    end
  end

  # Moves the publications of `book` to `keeper` and deletes `book`. Deleted
  # publications move too, so a restored publication names the book that kept.
  defp fold_translated_book(book, keeper) do
    Repo.update_all(
      from(p in Publication, where: p.translated_book_id == ^book.id),
      set: [translated_book_id: keeper.id]
    )

    unlink("translated_book_authors", "translated_book_id", book.id)
    Repo.delete!(book)
  end

  # Returns the oldest other row with the same values in `fields` as `row`, or
  # nil when `row` is the oldest such row or no other row has them.
  defp older_twin(row = %schema{}, fields) do
    same = Enum.map(fields, &{&1, Map.fetch!(row, &1)})

    from(r in schema, where: ^same, where: r.id < ^row.id, order_by: r.id, limit: 1)
    |> Repo.one()
  end

  # Deletes the author links of a book that is about to be deleted. The links
  # reference the book, so the database refuses to delete it while they exist.
  defp unlink(table, column, id) do
    Repo.query!("DELETE FROM #{table} WHERE #{column} = $1", [id])
  end

  # Rolls the rename back with `{:would_collide, [publication, other]}` when two
  # publications that are not deleted now share a composite key, each as
  # `%{id:, title:, year:}`. The keys are checked when the rename commits, so
  # any such pair is one the rename made.
  #
  # It looks for the pair before the keys are settled, because a failed check
  # aborts the transaction, and after that the pair could not be read.
  defp refuse_collision do
    pair =
      from(p in Publication,
        join: q in Publication,
        on:
          q.id > p.id and q.title == p.title and q.year == p.year and
            q.translated_book_id == p.translated_book_id and
            q.publishers_fingerprint == p.publishers_fingerprint and
            q.countries_fingerprint == p.countries_fingerprint,
        where: is_nil(p.deleted_at) and is_nil(q.deleted_at),
        limit: 1,
        select: [
          %{id: p.id, title: p.title, year: p.year},
          %{id: q.id, title: q.title, year: q.year}
        ]
      )
      |> Repo.one()

    if pair, do: Repo.rollback({:would_collide, pair})
  end

  # Checks the composite keys once the books are folded, and rolls the rename
  # back with `:conflict` when two books or publications still share one.
  defp settle! do
    with {:error, :conflict} <- Identity.settle(), do: Repo.rollback(:conflict)
  end
end
