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
  `LookUpCompositeKeysInTheDatabase`), and `original_book_with_key/2`,
  `translated_book_with_key/2` and `publication_with_key/2` call them.
  `publication_key/1` asks the database for the key of a publication that is
  not stored.

  The keys are checked when a transaction commits, because a row's links are
  written one by one after the row, and until the last one is written the row
  can match another row's key. `settle/0` checks them earlier, so that a write
  can report a conflict as its own result.
  """

  alias RichardBurton.Repo

  @keys ~w(original_books_composite_key translated_books_composite_key publications_composite_key)

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
  Returns the id of the stored original book titled `title` and written by
  `authors`, a list of names in any order, or nil when there is none.
  """
  @spec original_book_with_key(String.t(), [String.t()]) :: pos_integer() | nil
  def original_book_with_key(title, authors) do
    value("SELECT rb_original_book_with_key($1, $2)", [title, authors])
  end

  @doc """
  Returns the id of the stored translated book of the original book with the id
  `original_book_id` by `translators`, a list of names in any order, or nil
  when there is none.
  """
  @spec translated_book_with_key(pos_integer() | nil, [String.t()]) :: pos_integer() | nil
  def translated_book_with_key(original_book_id, translators) do
    value("SELECT rb_translated_book_with_key($1, $2)", [original_book_id, translators])
  end

  @doc """
  Returns the id of a stored publication that is not deleted and has the key of
  `publication`, or nil when there is none. The publication with the id
  `excluded` is left out, so an edit does not match the publication it edits.

  `publication` holds the fields in `t:key_fields/0`, where `:authors` are the
  translators.
  """
  @spec publication_with_key(key_fields(), pos_integer() | nil) :: pos_integer() | nil
  def publication_with_key(publication, excluded \\ nil) do
    value(
      "SELECT rb_publication_with_key($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        publication.title,
        publication.year,
        publication.countries,
        publication.publishers,
        publication.authors,
        publication.original_title,
        publication.original_authors,
        excluded
      ]
    )
  end

  @doc """
  Returns the composite key of `publication`, which holds the fields in
  `t:key_fields/0`, as the database compares it: the title, year and original
  title as they are, and the fingerprint of each list of names.

  Two publications have the same key exactly when the database would refuse to
  store both of them.
  """
  @spec publication_key(key_fields()) :: [term()]
  def publication_key(publication) do
    %{rows: [fingerprints]} =
      Repo.query!(
        "SELECT rb_set_fingerprint($1), rb_set_fingerprint($2), rb_set_fingerprint($3), rb_set_fingerprint($4)",
        [
          publication.countries,
          publication.publishers,
          publication.authors,
          publication.original_authors
        ]
      )

    [publication.title, publication.year, publication.original_title | fingerprints]
  end

  # Runs a query that returns one value, and returns that value.
  defp value(sql, params) do
    %{rows: [[value]]} = Repo.query!(sql, params)
    value
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
