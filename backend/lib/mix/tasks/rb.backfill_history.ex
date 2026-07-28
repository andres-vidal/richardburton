defmodule Mix.Tasks.Rb.BackfillHistory do
  @shortdoc "Gives publications with no history a starting point"

  @moduledoc """
  Records a `created` entry for every publication whose history is empty.

  A change is described by comparing a record against the entry before it, so
  the first entry a record ever gets has nothing to compare against and reads as
  a bare "updated". Publications inserted through the app open their log with a
  `created` entry and never have this problem; ones loaded straight into the
  database — the original corpus, a restored dump — start with no log at all.

  This gives those a starting point: the record as it stands now, attributed to
  the system. Only publications with an empty log are touched, so a record whose
  first change is already recorded is left alone — its earlier state is gone and
  no baseline can honestly be invented for it.

  Safe to run more than once, and on a database that needs nothing.

      mix rb.backfill_history
  """

  use Mix.Task

  import Ecto.Query

  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
  alias RichardBurton.Repo

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    unlogged()
    |> Enum.map(&record_baseline/1)
    |> report()
  end

  defp unlogged do
    logged = from(h in History, select: h.publication_id, distinct: true)

    from(p in Publication, where: p.id not in subquery(logged), order_by: p.id)
    |> Repo.all()
    |> Publication.preload()
  end

  defp record_baseline(publication) do
    History.record(:created, publication, History.system_actor())
    publication
  end

  defp report([]), do: Mix.shell().info("Every publication already has a history.")

  defp report(publications),
    do: Mix.shell().info("Recorded a starting point for #{length(publications)} publications.")
end
