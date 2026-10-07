defmodule RichardBurton.Repo do
  @moduledoc """
  The Ecto repository, extended with `insert_in_chunks/3`, which inserts a
  list longer than one statement can hold.
  """

  use Ecto.Repo,
    otp_app: :richard_burton,
    adapter: Ecto.Adapters.Postgres

  # The most entries `insert_in_chunks/3` puts in one statement.
  @chunk_size 5_000

  @doc """
  Inserts `entries` with `insert_all/3`, one statement for every 5,000 entries,
  and returns the rows the statements returned, in the order of `entries`. It
  returns an empty list when `opts` has no `:returning`, and sends no statement
  when `entries` is empty.

  Postgres takes at most 65,535 parameters in a statement, so a single
  `insert_all/3` of a long list fails. A statement of 5,000 entries stays under
  the limit with up to 13 columns.
  """
  def insert_in_chunks(schema_or_source, entries, opts \\ []) do
    entries
    |> Enum.chunk_every(@chunk_size)
    |> Enum.flat_map(fn chunk ->
      {_count, returned} = insert_all(schema_or_source, chunk, opts)
      returned || []
    end)
  end
end
