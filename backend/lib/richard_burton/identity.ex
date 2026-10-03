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

  The keys are checked when a transaction commits, because a row's links are
  written one by one after the row, and until the last one is written the row
  can match another row's key. `settle/0` checks them earlier, so that a write
  can report a conflict as its own result.
  """

  alias RichardBurton.Repo

  @keys ~w(original_books_composite_key translated_books_composite_key publications_composite_key)

  @doc """
  Returns the id of the stored original book titled `title` and written by
  `authors`, a list of names in any order, or nil when there is none.
  """
  def original_book_with_key(title, authors) do
    value("SELECT rb_original_book_with_key($1, $2)", [title, authors])
  end

  @doc """
  Returns the id of the stored translated book of the original book with the id
  `original_book_id` by `translators`, a list of names in any order, or nil
  when there is none.
  """
  def translated_book_with_key(original_book_id, translators) do
    value("SELECT rb_translated_book_with_key($1, $2)", [original_book_id, translators])
  end

  @doc """
  Returns the id of a stored publication that is not deleted and has the key of
  `publication`, or nil when there is none. The publication with the id
  `excluded` is left out, so an edit does not match the publication it edits.

  `publication` is a map with the flat fields `:title`, `:year`, `:countries`
  (codes), `:publishers`, `:authors` (the translators), `:original_title` and
  `:original_authors`.
  """
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
