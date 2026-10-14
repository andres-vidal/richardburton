defmodule Mix.Tasks.Rb.LoadData do
  @moduledoc """
  Inserts the publications in the `data.csv` file of the current directory, all
  or none, with `RichardBurton.Publication.insert_all/2`. When the file cannot
  be read, or a row is invalid or already stored, the task prints the error and
  inserts nothing.
  """
  use Mix.Task

  alias RichardBurton.Publication

  def run(_) do
    Mix.Task.run("app.start")

    with {:ok, publications} <-
           File.cwd!() |> Path.join(~c"data.csv") |> Publication.Codec.from_csv(),
         {:ok, _inserted} <- publications |> Publication.Codec.nest() |> Publication.insert_all() do
      :ok
    else
      {:error, error} -> IO.puts("Operation failed with error #{inspect(error)}")
    end
  end
end
