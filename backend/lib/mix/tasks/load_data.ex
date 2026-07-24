defmodule Mix.Tasks.Rb.LoadData do
  @moduledoc """
  Mix task to initialize the repo using a data.csv file in the project's root directory
  """
  use Mix.Task

  alias RichardBurton.Publication

  def run(_) do
    Mix.Task.run("app.start")

    File.cwd!()
    |> Path.join(~c"data.csv")
    |> Publication.Codec.from_csv()
    |> case do
      {:ok, publications} ->
        publications
        |> Publication.Codec.nest()
        |> Enum.each(&Publication.insert/1)

        # Single inserts don't signal the refresher (that's the callers' job,
        # once per logical operation) — this seed is one such operation.
        Publication.Index.Refresher.refresh()

      {:error, error} ->
        IO.puts("Operation failed with error #{error}")
    end
  end
end
