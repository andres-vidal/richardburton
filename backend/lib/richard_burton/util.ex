defmodule RichardBurton.Util do
  @moduledoc """
  Utilities for general purpose
  """

  def deep_merge_maps(map1, map2) do
    Map.merge(map1, map2, &deep_merge_resolve/3)
  end

  defp deep_merge_resolve(_, left = %{}, right = %{}) do
    deep_merge_maps(left, right)
  end

  defp deep_merge_resolve(_, _, right) do
    right
  end

  def create_fingerprint(data) when is_binary(data) do
    data |> sha256() |> Base.encode16()
  end

  defp sha256(data) do
    :crypto.hash(:sha256, data)
  end

  @doc ~S"""
    Given an enumerable with atom keys, return the enumerable with string keys instead.
    Works for keyword lists, key-value tuples, maps and structs.
    When an ordinary list is given, it stringify the keys of its elements.
    Does not traverse structures other than ordinary lists.

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
