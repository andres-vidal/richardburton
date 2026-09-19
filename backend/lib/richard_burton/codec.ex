defmodule RichardBurton.Codec do
  alias RichardBurton.Util

  @moduledoc """
  Utilities for serialization and deserialization
  """

  @doc ~S"""
    Flattens a nested map, post-processing the resulting `{key, value}` pairs with the given `post` function.
    Lists are not traversed.
    Keys on nested maps are regenerated prepending the key of their parent map.

    Returns the flattened map with string keys.

    ## Examples

        iex> RichardBurton.Codec.flatten(%{})
        %{}

        iex> RichardBurton.Codec.flatten(%{a: 1, b: 2, c: 3})
        %{"a" => 1, "b" => 2, "c" => 3}

        iex> RichardBurton.Codec.flatten(%{a: [1, 2, %{a: 1}]})
        %{"a" => [1, 2, %{a: 1}]}

        iex> RichardBurton.Codec.flatten(%{a: 1, b: %{a: 1, b: 2, c: 3}})
        %{"a" => 1, "b_a" => 1, "b_b" => 2, "b_c" => 3}

        iex> RichardBurton.Codec.flatten(%{a: 1, b: [2, 3, %{a: 1, b: 2}], c: %{a: 1, b: 2, c: 3}})
        %{ "a" => 1, "b" => [2, 3, %{a: 1, b: 2}], "c_a" => 1, "c_b"=> 2, "c_c"=> 3}
  """

  def flatten(map) when is_map(map) do
    map
    |> Util.stringify_keys()
    |> Enum.reduce([], &do_flatten/2)
    |> Map.new()
  end

  # Walks a nested map depth-first, joining the keys on the path to each leaf.
  defp do_flatten({key, value}, acc) when not is_map(value) do
    [{key, value} | acc]
  end

  defp do_flatten({key, map}, acc) when is_map(map) do
    flatten(map)
    |> Enum.map(fn {inner_key, v} -> {"#{key}_#{inner_key}", v} end)
    |> Enum.concat(acc)
  end

  @doc ~S"""
    Automatically nests a flat map.
    Keys are grouped by their Longest Common Prefix (LCP) to define nesting points.
    LCP is calculated considering atomic words separated by underscore:

      `aBC` and `aDE do not have a common prefix
      `a_BC` and `a_DE` have "a" as common prefix
      `a_b_BC` and `a_b_DE` have "a_b" as common prefix

    Returns the nested map with string keys.

    ## Examples

        iex> RichardBurton.Codec.nest(%{})
        %{}

        iex> RichardBurton.Codec.nest(%{a: 1, b: 2, c: 3})
        %{"a" => 1, "b" => 2, "c" => 3}

        iex> RichardBurton.Codec.nest(%{a: 1, b_a: 1, b_b: 2, b_c: 3})
        %{"a" => 1, "b" => %{"a" => 1, "b" => 2, "c" => 3}}

        iex> RichardBurton.Codec.nest(%{a: 1, b_a: 1, b_b: 2, b_c_c: 3})
        %{"a" => 1, "b" => %{"a" => 1, "b" => 2, "c_c" => 3}}

        iex> RichardBurton.Codec.nest(%{a: 1, b_a: 1, b_b: 2, b_c_c_c: 3})
        %{"a" => 1, "b" => %{"a" => 1, "b" => 2, "c_c_c" => 3}}

        iex> RichardBurton.Codec.nest(%{a: 1, b_a: 1, b_b: 2, b_c_c: 3, b_c_d: 4})
        %{"a" => 1, "b" => %{"a" => 1, "b" => 2, "c" => %{"c" => 3, "d" => 4}}}
  """
  def nest(map) do
    map
    |> Util.stringify_keys()
    |> Enum.map(fn {k, v} -> {String.split(k, "_"), v} end)
    |> Enum.reduce(%{}, fn {path, v}, acc -> put_path(acc, path, v) end)
    |> Map.new(&coalesce_keys/1)
  end

  # Writes a value at a path, creating the maps along it that do not exist yet.
  defp put_path(map, [key], value) when is_map(map) do
    Map.put(map, key, value)
  end

  defp put_path(map, [key | rest], value) when is_map(map) do
    Map.put(map, key, put_path(map[key] || %{}, rest, value))
  end

  defp put_path(not_map, _, _) when not is_map(not_map), do: not_map

  # Collapses a branch with a single child into one joined key, so a path that
  # never branches reads as one name rather than a chain.
  defp coalesce_keys({key, map}) when is_map(map) do
    case(coalesce_keys(map)) do
      {inner_key, v} -> {"#{key}_#{inner_key}", v}
      v -> {key, v}
    end
  end

  defp coalesce_keys({key, value}), do: {key, value}

  defp coalesce_keys(map) when is_map(map) do
    case Map.to_list(map) do
      [{k, m}] when is_map(m) -> coalesce_keys({k, m})
      [{k, v}] -> {k, v}
      _ -> Map.new(map, &coalesce_keys/1)
    end
  end
end
