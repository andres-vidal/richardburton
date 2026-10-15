defmodule RichardBurtonWeb.Params do
  @moduledoc """
  Reads whole numbers out of request parameters. A parameter is a string when
  it comes from the path or the query string, and can be an integer when it
  comes from a JSON body, so each function takes either.

  A **whole number** here is a non-negative integer, or a string of decimal
  digits that holds one. Ids, versions and limits are all whole numbers.
  """

  @doc """
  Returns `value` as an integer when it is a whole number, and nil otherwise,
  including when it is nil.
  """
  @spec integer(term()) :: non_neg_integer() | nil
  def integer(value) when is_integer(value) and value >= 0, do: value

  def integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {integer, ""} when integer >= 0 -> integer
      _ -> nil
    end
  end

  def integer(_value), do: nil

  @doc """
  Returns `{:ok, integer}` for a path segment that names a stored row, such as
  an id or a history version, and `{:error, :not_found}` when it is not a whole
  number.

  A value that is not a whole number cannot name a stored row, so it is a 404
  rather than a 400.
  """
  @spec id(term()) :: {:ok, non_neg_integer()} | {:error, :not_found}
  def id(value) do
    case integer(value) do
      nil -> {:error, :not_found}
      integer -> {:ok, integer}
    end
  end

  @doc """
  Returns the elements of `values` that are whole numbers, as integers and in
  their order, and leaves out the others. Returns an empty list when `values`
  is not a list.
  """
  @spec integers(term()) :: [non_neg_integer()]
  def integers(values) when is_list(values) do
    values |> Enum.map(&integer/1) |> Enum.reject(&is_nil/1)
  end

  def integers(_values), do: []
end
