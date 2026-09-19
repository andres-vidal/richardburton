defmodule RichardBurton.Validation do
  @moduledoc """
  Utilities for data validation
  """

  alias RichardBurton.Repo

  def validate(changeset, link_assocs) do
    case validate_transaction(changeset, link_assocs) do
      {:error, :ok} -> :ok
      {:error, errors} -> {:error, errors}
    end
  end

  defp validate_transaction(changeset = %{valid?: true}, link_assocs) do
    Repo.transaction(fn ->
      case Repo.insert(link_assocs.(changeset)) do
        {:ok, _changeset} -> Repo.rollback(:ok)
        {:error, changeset} -> Repo.rollback(get_errors(changeset))
      end
    end)
  end

  defp validate_transaction(changeset = %{valid?: false}, _link_assocs) do
    {:error, get_errors(changeset)}
  end

  @doc """
  Rejects repeated entries in a cast association, comparing each child by
  `key`. Without this a publication carrying the same country, publisher or
  author twice reaches the join tables' unique indexes and raises there,
  turning a data-entry slip into a 500.

  Errors are reported under `field` unless `:as` names another key. Nested
  errors collapse to their innermost map, so an original book's `authors`
  would otherwise arrive indistinguishable from the translators' — `:as` puts
  it under the flat name the client knows it by.
  """
  def validate_no_duplicates(changeset, field, key, opts \\ []) do
    values =
      changeset
      |> Ecto.Changeset.get_field(field, [])
      |> Enum.map(&get_child_value(&1, key))

    if length(Enum.uniq(values)) == length(values) do
      changeset
    else
      Ecto.Changeset.add_error(
        changeset,
        Keyword.get(opts, :as, field),
        "has duplicates",
        validation: :duplicate
      )
    end
  end

  defp get_child_value(child = %Ecto.Changeset{}, key), do: Ecto.Changeset.get_field(child, key)
  defp get_child_value(child, key), do: Map.get(child, key)

  def get_errors(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(&get_description/1)
    |> coalesce_errors
    |> simplify_errors
  end

  defp get_description({_msg, opts}), do: opts |> Map.new() |> get_description()
  defp get_description(%{validation: :required}), do: :required
  # A multi-value attribute that did not arrive as a list failed at the
  # container, not at the element type, and says so under one name.
  defp get_description(%{validation: :cast, type: {:array, _element}}), do: :array
  defp get_description(%{validation: :cast, type: type}), do: type
  defp get_description(%{validation: :length, kind: :min, count: 1}), do: :required
  defp get_description(%{validation: :assoc}), do: :required
  defp get_description(%{validation: :alpha2}), do: :alpha2
  defp get_description(%{validation: :duplicate}), do: :duplicate
  defp get_description(%{validation: :email}), do: :invalid
  defp get_description(%{constraint: :unique}), do: :conflict

  defp simplify_errors(node) when is_map(node) do
    case node |> Map.values() do
      [:conflict] -> :conflict
      [n] when is_map(n) -> simplify_errors(n)
      _ -> node
    end
  end

  defp simplify_errors(atom) when is_atom(atom) do
    atom
  end

  defp coalesce_errors(node) when is_map(node) do
    node |> Enum.map(&coalesce_errors/1) |> Map.new()
  end

  defp coalesce_errors({key, value}) when is_atom(key) and (is_map(value) or is_list(value)) do
    {key, coalesce_errors(value)}
  end

  defp coalesce_errors(elements) when is_list(elements) do
    case List.first(elements) do
      node when is_map(node) -> Enum.map(elements, &coalesce_errors/1)
      error when is_atom(error) -> error
    end
  end
end
