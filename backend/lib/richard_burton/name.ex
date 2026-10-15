defmodule RichardBurton.Name do
  @moduledoc """
  Functions shared by the records that are found by a name, such as
  `RichardBurton.Author`, `RichardBurton.Publisher` and the titles of
  `RichardBurton.OriginalBook`.

  A name is searched in two passes. The **prefix** pass finds the names that
  start with the term, ignoring case. When it finds none, the **fuzzy** pass
  finds the names that share enough trigrams with the term to be a misspelling
  of it.
  """

  import Ecto.Query

  alias RichardBurton.Repo

  # How much of a name a misspelling has to share to still answer for it.
  @similarity 0.3

  @doc """
  Returns the rows of `schema` whose `name` starts with `term`, or, when none
  does, the rows whose `name` resembles it.
  """
  def search(schema, term) when is_binary(term) do
    case search(schema, term, :prefix) do
      [] -> search(schema, term, :fuzzy)
      rows -> rows
    end
  end

  @doc """
  Returns the rows of `schema` whose `name` matches `term` in one pass:
  `:prefix` or `:fuzzy`.
  """
  def search(schema, term, pass) when is_binary(term) and pass in [:prefix, :fuzzy] do
    condition =
      case pass do
        :prefix -> starts_with(:row, :name, term)
        :fuzzy -> similar_to(:row, :name, term)
      end

    from(r in schema, as: :row, where: ^condition) |> Repo.all()
  end

  @doc """
  Returns a condition that holds when `field` of the named binding `binding`
  starts with `term`, ignoring case.
  """
  def starts_with(binding, field, term) do
    dynamic(ilike(field(as(^binding), ^field), ^"#{term}%"))
  end

  @doc """
  Returns a condition that holds when `field` of the named binding `binding`
  is similar enough to `term` to be a misspelling of it.
  """
  def similar_to(binding, field, term) do
    dynamic(
      fragment("similarity((?), (?)) > ?", field(as(^binding), ^field), ^term, ^@similarity)
    )
  end

  @doc ~S"""
  Nests a flat publication's list of names into the maps a schema with a
  `name` field casts. A value that is not a list is returned unchanged, for the
  changeset to refuse.

  Splitting a written-down string into names is done by the CSV codec, before
  a value reaches here.

  ## Examples

    iex> RichardBurton.Name.nest(["Machado de Assis", "Clarice Lispector"])
    [%{"name" => "Machado de Assis"}, %{"name" => "Clarice Lispector"}]

    iex> RichardBurton.Name.nest("Machado de Assis")
    "Machado de Assis"
  """
  def nest(names) when is_list(names), do: Enum.map(names, &%{"name" => get_name(&1)})
  def nest(names), do: names

  @doc ~S"""
  Flattens records or maps with a name to the names they are, as `get_name/1`
  reads each one. A value that is not a list is returned unchanged.

  ## Examples

    iex> RichardBurton.Name.flatten([%{"name" => "Noonday Press"}, %{"name" => "Penguin"}])
    ["Noonday Press", "Penguin"]

    iex> RichardBurton.Name.flatten("Noonday Press")
    "Noonday Press"
  """
  def flatten(names) when is_list(names), do: Enum.map(names, &get_name/1)
  def flatten(names), do: names

  @doc """
  Returns the name of a record with a `name` field or of a map with a `:name`
  or `"name"` key, and nil for any other map. Any other value, such as a
  string, is returned unchanged, so a name that is not a string reaches the
  changeset and is refused there.
  """
  def get_name(%{name: name}), do: name
  def get_name(%{"name" => name}), do: name
  def get_name(value) when is_map(value), do: nil
  def get_name(value), do: value
end
