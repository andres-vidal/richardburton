defmodule RichardBurton.Repo do
  @moduledoc """
  The Ecto repository, extended with `insert_in_chunks/3`, which inserts a
  list longer than one statement can hold.
  """

  use Ecto.Repo,
    otp_app: :richard_burton,
    adapter: Ecto.Adapters.Postgres

  # The most parameters Postgres takes in one statement.
  @max_parameters 65_535

  @doc """
  Inserts `entries` with `insert_all/3`, as many per statement as fit within
  Postgres's limit of 65,535 parameters, and returns the rows the statements
  returned, in the order of `entries`. It returns an empty list when `opts`
  has no `:returning`, and sends no statement when `entries` is empty.

  When `schema_or_source` is a schema, each entry gets the values the schema
  generates on insert, such as its timestamps, as `insert/2` gives them. Every
  entry must have the same keys.
  """
  def insert_in_chunks(schema_or_source, entries, opts \\ [])

  def insert_in_chunks(_schema_or_source, [], _opts), do: []

  def insert_in_chunks(schema_or_source, entries, opts) do
    entries = with_generated(schema_or_source, entries)

    entries
    |> Enum.chunk_every(div(@max_parameters, map_size(hd(entries))))
    |> Enum.flat_map(fn chunk ->
      {_count, returned} = insert_all(schema_or_source, chunk, opts)
      returned || []
    end)
  end

  # Returns `entries` with the values `schema` generates on insert added to
  # each, one value per field for the whole list. A table name generates
  # nothing.
  defp with_generated(schema, entries) when is_atom(schema) do
    generated =
      schema.__schema__(:autogenerate)
      |> Enum.flat_map(fn {fields, {module, function, args}} ->
        value = apply(module, function, args)
        Enum.map(fields, &{&1, value})
      end)
      |> Map.new()

    Enum.map(entries, &Map.merge(generated, &1))
  end

  defp with_generated(_source, entries), do: entries
end
