defmodule RichardBurton.Repo do
  @moduledoc """
  The Ecto repository, extended with the upsert helpers the schemas share for
  linking a row by its unique key rather than duplicating it.
  """

  use Ecto.Repo,
    otp_app: :richard_burton,
    adapter: Ecto.Adapters.Postgres

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
