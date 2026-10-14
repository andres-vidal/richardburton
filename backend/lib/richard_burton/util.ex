defmodule RichardBurton.Util do
  @moduledoc """
  Functions on maps and keyword lists that no single context owns.
  """

  @doc """
  Merges `map2` into `map1`. A key whose value is a map in both is merged the
  same way, and any other key takes the value in `map2`.

  ## Examples

      iex> RichardBurton.Util.deep_merge_maps(%{a: %{b: 1, c: 2}, d: 3}, %{a: %{c: 4}, d: 5})
      %{a: %{b: 1, c: 4}, d: 5}
  """
  def deep_merge_maps(map1, map2) do
    Map.merge(map1, map2, &deep_merge_resolve/3)
  end

  # Two maps merge recursively; any other pair of values takes the right one.
  defp deep_merge_resolve(_, left = %{}, right = %{}) do
    deep_merge_maps(left, right)
  end

  defp deep_merge_resolve(_, _, right) do
    right
  end

  @doc ~S"""
  Returns a map, a struct, a key-value tuple or a list of them with each atom
  key turned into a string. A struct becomes a plain map. Each element of a
  list is converted, but the values of a map or a tuple are not.

  ## Examples

      iex> RichardBurton.Util.stringify_keys(%{})
      %{}

      iex> RichardBurton.Util.stringify_keys(%{"key" => "value"})
      %{"key" => "value"}

      iex> RichardBurton.Util.stringify_keys({"key", "value"})
      {"key", "value"}

      iex> RichardBurton.Util.stringify_keys([])
      []

      iex> RichardBurton.Util.stringify_keys({:key, "value"})
      {"key", "value"}

      iex> RichardBurton.Util.stringify_keys({:key, :value})
      {"key", :value}

      iex> RichardBurton.Util.stringify_keys([key1: "value", key2: 1234])
      [{"key1", "value"}, {"key2", 1234}]

      iex> RichardBurton.Util.stringify_keys([key: :value])
      [{"key", :value}]

      iex> RichardBurton.Util.stringify_keys([{:key1, "value"}, {:key2, 1234}])
      [{"key1", "value"}, {"key2", 1234}]

      iex> RichardBurton.Util.stringify_keys([{:key1, "value"}, {"key2", 1234}])
      [{"key1", "value"}, {"key2", 1234}]

      iex> RichardBurton.Util.stringify_keys(%{key1: "value", key2: 1234})
      %{"key1" => "value", "key2" => 1234}

      iex> RichardBurton.Util.stringify_keys(%{key: :value})
      %{"key" => :value}

      iex> RichardBurton.Util.stringify_keys(%{:key1 => "value", "key2" => 1234})
      %{"key1" => "value", "key2" => 1234}

      iex> RichardBurton.Util.stringify_keys([{:key1, "value"}, %{key2: 1234}])
      [{"key1", "value"}, %{"key2" => 1234}]

      iex> RichardBurton.Util.stringify_keys(%{key: {:key, "value"}})
      %{"key" => {:key, "value"}}
  """
  def stringify_keys(s) when is_struct(s), do: stringify_keys(Map.from_struct(s))
  def stringify_keys(l) when is_list(l), do: Enum.map(l, &stringify_keys/1)
  def stringify_keys(m) when is_map(m), do: Map.new(m, &stringify_keys/1)
  def stringify_keys({key, value}) when is_atom(key), do: {Atom.to_string(key), value}
  def stringify_keys({key, value}) when is_binary(key), do: {key, value}
end
