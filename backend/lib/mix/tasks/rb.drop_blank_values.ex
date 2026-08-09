defmodule Mix.Tasks.Rb.DropBlankValues do
  @shortdoc "Removes blank entries from publications' multi-valued attributes"

  @moduledoc """
  Drops the blank values some publications carry among their countries,
  publishers, translators or original authors.

  They come from a separator with nothing beside it — a cell reading
  "Howard Fertig, " named one publisher and then an empty one, and the joined
  form the reader saw put it back together as "Howard Fertig, " and looked
  right. Nothing can write one now: a blank name fails validation, and the CSV
  reader drops empty entries. This clears what was written before that.

  Only the index carries them. Casting a publication drops blank entries on the
  way through, so the record's own snapshot never held one — which is why this
  writes no history entry: by the log's reckoning nothing about the publication
  changed, and what is being removed is a value the domain never counted.

  The repair goes through the ordinary update path all the same, so the
  fingerprints are recomputed and the index is refreshed from the associations
  as they now stand.

      mix rb.drop_blank_values
  """

  use Mix.Task

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.History
  alias RichardBurton.Repo

  @multivalued [:countries, :publishers, :authors, :original_authors]

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    case Enum.map(carrying_a_blank(), &repair/1) do
      [] ->
        Mix.shell().info("No publication carries a blank value.")

      results ->
        Enum.each(results, &report/1)
        # The update path refreshes the index only when the record itself
        # changed, and by its reckoning none of these did — so the signal that
        # takes the blanks out of the index has to come from here.
        Publication.Index.Refresher.refresh()
        Mix.shell().info("#{length(results)} publications visited.")
    end
  end

  # Only expressible now that the attributes are arrays: before, a blank value
  # was a comma with nothing after it, indistinguishable from the separator.
  defp carrying_a_blank do
    Enum.reduce(@multivalued, from(p in FlatPublication, select: p.id), fn field, query ->
      or_where(query, [p], fragment("? = ANY(?)", "", field(p, ^field)))
    end)
    |> Repo.all()
  end

  defp repair(id) do
    attrs =
      id
      |> Publication.find()
      |> History.snapshot()
      |> Map.drop([:id, :source_match])
      |> without_blanks()
      |> Codec.nest()

    {id, Publication.update(id, attrs, History.system_actor())}
  end

  defp without_blanks(snapshot) do
    Enum.reduce(@multivalued, snapshot, fn field, snapshot ->
      Map.update!(snapshot, field, &Enum.reject(&1, fn value -> String.trim(value) == "" end))
    end)
  end

  defp report({id, {:ok, _}}), do: Mix.shell().info("##{id}: blank values dropped")

  defp report({id, {:error, reason}}),
    do: Mix.shell().error("##{id}: left as it was — #{inspect(reason)}")
end
