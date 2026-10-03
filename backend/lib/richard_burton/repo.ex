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
  Returns the stored row whose `column` has the changeset's value, and inserts
  the changeset when there is none.

  Another transaction can insert the same value between the lookup and the
  insert. The insert then waits for that transaction to finish, and once it has
  committed, this returns the row it stored rather than raising on the unique
  index.

  `column` must have a unique index of its own, which the insert names as its
  conflict target, and the changeset must have no associations.
  """
  def find_or_insert!(changeset = %Ecto.Changeset{data: %schema{}}, column) do
    value = Ecto.Changeset.get_field(changeset, column)

    get_by(schema, [{column, value}]) || insert_unless_taken!(changeset, column, value)
  end

  # Inserts `changeset`, or returns the row another transaction stored with the
  # same `value` after the lookup. `ON CONFLICT DO NOTHING` inserts nothing in
  # that case and returns a struct without an id, so the row is read back.
  defp insert_unless_taken!(changeset = %Ecto.Changeset{data: %schema{}}, column, value) do
    case insert!(changeset, on_conflict: :nothing, conflict_target: column) do
      %{id: nil} -> get_by!(schema, [{column, value}])
      inserted -> inserted
    end
  end

  @doc """
  Returns the stored row whose `unique_key` fields equal the changeset's, and
  inserts the changeset when there is none.
  """
  def maybe_insert!(changeset = %Ecto.Changeset{data: %schema{}}, unique_key) do
    values = Enum.map(unique_key, &{&1, Ecto.Changeset.get_field(changeset, &1)})

    get_by(schema, values) || insert!(changeset)
  end

  @doc """
  Returns the stored row whose id `find` returns for the changeset, and inserts
  the changeset when `find` returns nil.

  `find` is for a key the row's own columns cannot be compared on, such as a
  composite key with a fingerprint. After an insert, `fields` are read back with
  `refresh/2`, because the database writes the fingerprints after the row's
  links are saved.
  """
  def maybe_insert!(changeset = %Ecto.Changeset{data: %schema{}}, find, fields) do
    case find.(changeset) do
      nil -> changeset |> insert!() |> refresh(fields)
      id -> get!(schema, id)
    end
  end
end
