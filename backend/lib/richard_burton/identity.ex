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
  `ComputeFingerprintsInTheDatabase`).

  The keys are checked when a transaction commits, because a row's links are
  written one by one after the row, and until the last one is written the row
  can match another row's key. `settle/0` checks them earlier, so that a write
  can report a conflict as its own result.
  """

  alias RichardBurton.Repo

  @keys ~w(original_books_composite_key translated_books_composite_key publications_composite_key)

  @doc """
  Builds a query expression for the fingerprint of `names`, a list of names or
  country codes, the way the database computes a stored one. Use it inside a
  query, with `names` pinned.
  """
  defmacro fingerprint(names) do
    quote do: fragment("rb_set_fingerprint(?::text[])", unquote(names))
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
