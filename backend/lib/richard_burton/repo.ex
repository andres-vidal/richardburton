defmodule RichardBurton.Repo do
  @moduledoc """
  The Ecto repository, extended with the helpers the schemas share: linking a
  row by its unique key rather than duplicating it, and reading back columns
  the database writes.
  """

  use Ecto.Repo,
    otp_app: :richard_burton,
    adapter: Ecto.Adapters.Postgres

  import Ecto.Query, only: [from: 2]

  @doc """
  Returns `struct` with `fields` read back from its row.

  It is for columns the database writes after the statement that saved the
  row, such as the fingerprints, which triggers write once the row's links are
  saved. The struct a write returns still holds the old values of those columns.
  """
  def refresh(struct = %schema{id: id}, fields) do
    from(r in schema, where: r.id == ^id, select: map(r, ^fields))
    |> one!()
    |> then(&Map.merge(struct, &1))
  end

  @doc """
  Returns the stored row whose `unique_key` fields equal the changeset's, and
  inserts the changeset when there is none.
  """
  def maybe_insert!(changeset = %Ecto.Changeset{data: %schema{}}, unique_key) do
    values = Enum.map(unique_key, &{&1, Ecto.Changeset.get_field(changeset, &1)})

    get_by(schema, values) || insert!(changeset)
  end
end
