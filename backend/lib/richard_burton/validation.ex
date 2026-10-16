defmodule RichardBurton.Validation do
  @moduledoc """
  Validations shared by several schemas, and `get_errors/1`, which reduces a
  changeset's errors to the codes the API returns.

  An error **code** is an atom that names what is wrong with a field, such as
  `:required` or `:alpha2`, instead of a sentence.
  """

  alias RichardBurton.RichText

  # The most characters the text of a publication's notes may hold.
  @notes_max_length 10_000

  @doc """
  Adds a `:notes` error to `changeset` when the text of its notes is longer
  than 10,000 characters, as `RichardBurton.RichText.text_length/1` counts
  them. `get_errors/1` reports it as `:too_long`.
  """
  def validate_notes(changeset) do
    Ecto.Changeset.validate_change(changeset, :notes, fn :notes, notes ->
      if RichText.text_length(notes) > @notes_max_length do
        [
          notes:
            {"should be at most %{count} character(s)",
             validation: :length, kind: :max, count: @notes_max_length, type: :string}
        ]
      else
        []
      end
    end)
  end

  @doc """
  Rejects repeated entries in a cast association, comparing each child by
  `key`. Without this a publication carrying the same country, publisher or
  author twice reaches the join tables' unique indexes and raises there,
  turning a data-entry slip into a 500.

  Errors are reported under `field` unless `:as` names another key. Nested
  errors collapse to their innermost map (see `get_errors/1`), so an original
  book's `authors` would otherwise be reported under the same key as the
  translators. `:as` reports it under the key the flat publication uses.
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

  # A field of a nested changeset or of an already-loaded struct.
  defp get_child_value(child = %Ecto.Changeset{}, key), do: Ecto.Changeset.get_field(child, key)
  defp get_child_value(child, key), do: Map.get(child, key)

  @doc """
  Returns the errors of `changeset` as codes, in a map shaped like the
  changeset's fields.

  A field with several errors is reported by its first one. A branch whose
  only error is a unique-constraint violation becomes the single code
  `:conflict`, and a branch with a single nested map is replaced by that map,
  so the result names the innermost field that failed. An association with
  many children is a list with one map per child, empty for a valid child.

  The codes are `:required`, `:array` for a list field given something other
  than a list, the type of a field that could not be cast to it, such as
  `:integer`, `:alpha2`, `:duplicate`, `:conflict`, `:too_long` for a value
  longer than its field's maximum length, `:malformed` for a value whose
  shape its type refuses, such as rich text with an unknown node (see
  `RichardBurton.RichText`), and `:invalid` for any other failed validation.
  """
  def get_errors(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(&get_description/1)
    |> coalesce_errors()
    |> simplify_errors()
  end

  # The code for one Ecto error, from the options Ecto stores with it.
  defp get_description({_msg, opts}), do: opts |> Map.new() |> get_description()
  defp get_description(%{validation: :required}), do: :required
  # A multi-value attribute that did not arrive as a list failed at the
  # container, not at the element type, and says so under one name.
  defp get_description(%{validation: :cast, type: {:array, _element}}), do: :array
  defp get_description(%{validation: :cast, type: type}) when is_atom(type), do: type
  defp get_description(%{validation: :length, kind: :min, count: 1}), do: :required
  defp get_description(%{validation: :length, kind: :max}), do: :too_long
  defp get_description(%{validation: :assoc}), do: :required
  defp get_description(%{validation: :alpha2}), do: :alpha2
  defp get_description(%{validation: :duplicate}), do: :duplicate
  defp get_description(%{validation: :malformed}), do: :malformed
  defp get_description(%{constraint: :unique}), do: :conflict
  defp get_description(_opts), do: :invalid

  # Replaces a branch whose only error is `:conflict` with `:conflict`, and a
  # branch holding a single nested map with that map, from the root down.
  defp simplify_errors(node) when is_map(node) do
    case node |> Map.values() do
      [:conflict] -> :conflict
      [n] when is_map(n) -> simplify_errors(n)
      _ -> node
    end
  end

  # Reduces each field's list of codes to its first code, and keeps the
  # lists of child maps an association with many children has.
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
