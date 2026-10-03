defmodule RichardBurton.Repo do
  @moduledoc """
  The Ecto repository, extended with the helpers the schemas share for linking
  a row by its unique key rather than duplicating it.
  """

  use Ecto.Repo,
    otp_app: :richard_burton,
    adapter: Ecto.Adapters.Postgres

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

  def maybe_insert!(changeset, conflict_target) do
    unique_key = replace_unique_key_assocs_with_ids(conflict_target, changeset)
    unique_key_values = get_unique_key_values(conflict_target, changeset)
    unique_key_paired = Enum.zip(unique_key, unique_key_values)

    %queryable{} = changeset.data

    case get_by(queryable, unique_key_paired) do
      %^queryable{} = value ->
        value

      nil ->
        insert!(changeset)
    end
  end

  # A unique key naming an association is compared by the foreign key the row
  # actually holds, since the association itself is not a column.
  defp replace_unique_key_assocs_with_ids(unique_key, changeset) do
    Enum.map(unique_key, fn key ->
      case changeset.changes[key] do
        %Ecto.Changeset{} ->
          key
          |> Atom.to_string()
          |> Kernel.<>("_id")
          |> String.to_existing_atom()

        _ ->
          key
      end
    end)
  end

  def get_unique_key_values(unique_key, changeset) do
    Enum.map(unique_key, fn key ->
      case changeset.changes[key] do
        %Ecto.Changeset{} -> changeset.changes[key].data.id
        _ -> changeset.changes[key]
      end
    end)
  end
end
