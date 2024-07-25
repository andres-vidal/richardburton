defmodule RichardBurton.Validation.Errors do
  def flatten_publication_errors(errors) do
    errors
    |> Map.replace_lazy(:countries, &error_to_string/1)
    |> Map.replace_lazy(:publishers, &error_to_string/1)
  end

  @doc """
  Return a string out of a error data structure.
  """
  def error_to_string(errors) when is_list(errors) do
    errors
    |> Enum.reject(fn
      %{} = error -> map_size(error) == 0
      _ -> true
    end)
    |> Enum.map(&error_to_string/1)
    |> hd()
  end

  def error_to_string(error) when is_map(error) do
    Map.values(error)
    |> Enum.join(", ")
  end

  def error_to_string(error), do: error
end
