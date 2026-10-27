defmodule RichardBurton.Publication.History.Snapshot do
  @moduledoc """
  An Ecto type for the snapshot a `RichardBurton.Publication.History` entry
  stores: a map of a publication's flat fields, as
  `RichardBurton.Publication.History.snapshot/1` builds it.

  Loading a snapshot reads it in the current flat shape, with the notes under
  `"notes_pt"` and `"notes_en"` and the sources as flat sources (see
  `RichardBurton.Source`). The log is append-only and is never rewritten, so
  it also holds snapshots in a **one-language shape**, which loading converts:

    * The notes are under `"notes"`. They load as `"notes_pt"`.
    * Each source is a string. It loads as a flat source with that text in
      Portuguese (see `RichardBurton.Source.flat/1`).

  A snapshot in the current shape loads as it is stored. Casting and dumping
  leave a snapshot as it is.

  ## Examples

      iex> {:ok, snapshot} =
      ...>   RichardBurton.Publication.History.Snapshot.load(%{
      ...>     "title" => "Dom Casmurro",
      ...>     "notes" => nil,
      ...>     "sources" => ["Caldwell, Helen. Introduction, 1953."]
      ...>   })
      iex> snapshot
      %{
        "title" => "Dom Casmurro",
        "notes_pt" => nil,
        "sources" => [%{"pt" => "Caldwell, Helen. Introduction, 1953.", "en" => nil}]
      }
  """
  use Ecto.Type

  alias RichardBurton.Source

  @impl true
  def type, do: :map

  # Loads a snapshot held inside another field's map, such as the `others` of
  # an entry, with `load/1` too.
  @impl true
  def embed_as(_format), do: :dump

  @impl true
  def cast(snapshot) when is_map(snapshot), do: {:ok, snapshot}
  def cast(_snapshot), do: :error

  @impl true
  def load(snapshot) when is_map(snapshot), do: {:ok, current(snapshot)}
  def load(_snapshot), do: :error

  @impl true
  def dump(snapshot) when is_map(snapshot), do: {:ok, snapshot}
  def dump(_snapshot), do: :error

  # Returns a stored snapshot in the current shape, as the module doc
  # describes.
  defp current(snapshot) do
    snapshot
    |> with_notes_in_portuguese()
    |> with_flat_sources()
  end

  # Moves the notes of a snapshot stored with one language of notes under
  # `"notes_pt"`. A snapshot without `"notes"` is returned unchanged.
  defp with_notes_in_portuguese(snapshot = %{"notes" => notes}) do
    snapshot |> Map.delete("notes") |> Map.put_new("notes_pt", notes)
  end

  defp with_notes_in_portuguese(snapshot), do: snapshot

  # Returns a snapshot with its list of sources read as flat sources. A
  # snapshot without a list of sources is returned unchanged.
  defp with_flat_sources(snapshot = %{"sources" => sources}) when is_list(sources),
    do: %{snapshot | "sources" => Source.flatten(sources)}

  defp with_flat_sources(snapshot), do: snapshot
end
