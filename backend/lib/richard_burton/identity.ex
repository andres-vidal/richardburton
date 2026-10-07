defmodule RichardBurton.Identity do
  @moduledoc """
  The composite keys that stop an original book, a translated book or a
  publication from being stored twice. The database computes and enforces
  them, and this module is how the application asks it.

  A *fingerprint* is a hash of a set of names. The keys are:

    * an original book: its title, and the fingerprint of its authors' names;
    * a translated book: the original book it translates, and the fingerprint
      of its translators' names;
    * a publication that is not deleted: its title, year and translated book,
      and the fingerprints of its publishers' names and its country codes.

  The database computes a fingerprint with `rb_set_fingerprint`, from the names
  sorted, so the same names in another order give the same fingerprint. Each
  stored fingerprint is kept up to date by triggers when a link is added or
  removed, or a linked name changes (see the migration
  `ComputeFingerprintsInTheDatabase`). The database also has functions that
  find the stored row with a key (see the migration
  `LookUpCompositeKeysInTheDatabase`), and `books_with_keys/1` and
  `publications_with_keys/2` call them for many keys at once.

  The keys are checked when a transaction commits, because a row's links are
  written one by one after the row, and until the last one is written the row
  can match another row's key. `settle/0` checks them earlier, so that a write
  can report a conflict as its own result.
  """

  alias RichardBurton.Repo

  @keys ~w(original_books_composite_key translated_books_composite_key publications_composite_key)

  # The fields of `t:key_fields/0` that a key is built from.
  @key_fields [
    :title,
    :year,
    :countries,
    :publishers,
    :authors,
    :original_title,
    :original_authors
  ]

  @typedoc """
  The fields of a flat publication that its composite key is built from. Names
  and country codes are lists, in any order. Other fields are allowed and
  ignored.
  """
  @type key_fields :: %{
          required(:title) => String.t(),
          required(:year) => integer(),
          required(:countries) => [String.t()],
          required(:publishers) => [String.t()],
          required(:authors) => [String.t()],
          required(:original_title) => String.t(),
          required(:original_authors) => [String.t()],
          optional(atom()) => any()
        }

  @doc """
  Returns, for each of `publications`, the id of a stored publication that is
  not deleted and has its key, or nil when there is none. The ids come in the
  order of `publications`, from one query. The publication with the id
  `excluded` is left out, so an edit does not match the publication it edits.

  Each of `publications` holds the fields in `t:key_fields/0`, where `:authors`
  are the translators.
  """
  @spec publications_with_keys([key_fields()], pos_integer() | nil) :: [pos_integer() | nil]
  def publications_with_keys(publications, excluded \\ nil)

  def publications_with_keys([], _excluded), do: []

  def publications_with_keys(publications, excluded) do
    values(
      """
      SELECT rb_publication_with_key(
        k->>'title',
        (k->>'year')::integer,
        ARRAY(SELECT jsonb_array_elements_text(k->'countries')),
        ARRAY(SELECT jsonb_array_elements_text(k->'publishers')),
        ARRAY(SELECT jsonb_array_elements_text(k->'authors')),
        k->>'original_title',
        ARRAY(SELECT jsonb_array_elements_text(k->'original_authors')),
        $2
      )
      FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS t(k, i)
      ORDER BY i
      """,
      [Enum.map(publications, &Map.take(&1, @key_fields)), excluded]
    )
  end

  @doc """
  Returns, for each `{title, authors, translators}` in `keys`, the ids of the
  stored original book with that title and those authors, and of its stored
  translated book by those translators, as a pair. Either id is nil when there
  is no such book, and the translated book's is nil whenever the original
  book's is. Names are lists in any order. The pairs come in the order of
  `keys`, from one query.
  """
  @spec books_with_keys([{String.t(), [String.t()], [String.t()]}]) ::
          [{pos_integer() | nil, pos_integer() | nil}]
  def books_with_keys(keys) do
    """
    SELECT original.id, rb_translated_book_with_key(
      original.id,
      ARRAY(SELECT jsonb_array_elements_text(k->'translators'))
    )
    FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS t(k, i),
    LATERAL (
      SELECT rb_original_book_with_key(
        k->>'title',
        ARRAY(SELECT jsonb_array_elements_text(k->'authors'))
      ) AS id
    ) original
    ORDER BY i
    """
    |> Repo.query!([
      Enum.map(keys, fn {title, authors, translators} ->
        %{title: title, authors: authors, translators: translators}
      end)
    ])
    |> Map.fetch!(:rows)
    |> Enum.map(&List.to_tuple/1)
  end

  @doc """
  Returns the ids among `ids` of the publications that have the same key as
  another publication that is not deleted, or whose translated or original
  book has the same key as another book.

  Of two publications in `ids` with the same key, only the one with the higher
  id is returned. A publication outside `ids` counts whatever its id.
  """
  @spec publications_in_conflict([pos_integer()]) :: [pos_integer()]
  def publications_in_conflict(ids) do
    values(
      """
      SELECT p.id
      FROM publications p
      JOIN translated_books tb ON tb.id = p.translated_book_id
      JOIN original_books ob ON ob.id = tb.original_book_id
      WHERE p.id = ANY($1)
        AND p.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1
            FROM publications other
            WHERE (other.id < p.id OR other.id <> ALL($1))
              AND other.deleted_at IS NULL
              AND other.title = p.title
              AND other.year = p.year
              AND other.translated_book_id = p.translated_book_id
              AND other.publishers_fingerprint = p.publishers_fingerprint
              AND other.countries_fingerprint = p.countries_fingerprint
          )
          OR EXISTS (
            SELECT 1
            FROM translated_books other
            WHERE other.id <> tb.id
              AND other.original_book_id = tb.original_book_id
              AND other.authors_fingerprint = tb.authors_fingerprint
          )
          OR EXISTS (
            SELECT 1
            FROM original_books other
            WHERE other.id <> ob.id
              AND other.title = ob.title
              AND other.authors_fingerprint = ob.authors_fingerprint
          )
        )
      """,
      [ids]
    )
  end

  # Runs a query that returns one column, and returns its values in order.
  defp values(sql, params) do
    sql |> Repo.query!(params) |> Map.fetch!(:rows) |> Enum.map(fn [value] -> value end)
  end

  @doc """
  Checks the composite keys now, inside the current transaction.

  Returns `:ok`, or `{:error, :conflict}` when a row has the same key as
  another. After a conflict the transaction can only be rolled back. The keys
  are deferred again afterwards, so the next write in the same transaction can
  pass through states that match another key, as the first could.
  """
  @spec settle() :: :ok | {:error, :conflict}
  def settle do
    Repo.query!("SET CONSTRAINTS ALL IMMEDIATE")
    Repo.query!("SET CONSTRAINTS ALL DEFERRED")
    :ok
  rescue
    error in Postgrex.Error ->
      if error.postgres[:constraint] in @keys,
        do: {:error, :conflict},
        else: reraise(error, __STACKTRACE__)
  end
end
