defmodule Mix.Tasks.Rb.LoadData do
  @shortdoc "Inserts the publications in data.csv"

  @moduledoc """
  Inserts the publications in the `data.csv` file of the current directory, all
  or none, with `RichardBurton.Publication.insert_all/2`. When the file cannot
  be read, or a row is invalid or already stored, the task prints the error and
  inserts nothing.

      mix rb.load_data
  """
  use Mix.Task

  alias RichardBurton.Publication

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    with {:ok, publications} <- Publication.Codec.from_csv("data.csv"),
         {:ok, inserted} <- publications |> Publication.Codec.nest() |> Publication.insert_all() do
      Mix.shell().info("Inserted #{length(inserted)} publications.")
    else
      {:error, error} -> Mix.shell().error("Nothing was inserted: #{inspect(error)}")
    end
  end
end
