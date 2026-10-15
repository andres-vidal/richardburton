defmodule RichardBurtonWeb.DocumentController do
  @moduledoc """
  The import-document endpoints: creating, listing, renaming, archiving and
  unarchiving documents, and reading, appending and compacting their updates.

  The list is shared, so no endpoint scopes it to the person asking. Updates
  are sent and returned as base64 strings in JSON, like the rest of this API.
  The server does not parse them. See `RichardBurton.Document`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Document
  alias RichardBurtonWeb.DocumentChannel

  @doc """
  Returns a page of documents and whether more follow it, as
  `RichardBurton.Document.page/1` does. With `archived=true` the page holds
  archived documents instead of unarchived ones. `limit` sets the page size.

  `after` is the cursor: the `updated_at` and `id` of the last document on the
  previous page. Without it, the first page is returned. A malformed cursor is
  a 400 with `invalid_after`.
  """
  def index(conn, params) do
    with {:ok, cursor} <- cursor(params["after"]) do
      json(
        conn,
        Document.page(
          limit: Params.integer(params["limit"]),
          after: cursor,
          archived: params["archived"] == "true"
        )
      )
    end
  end

  @doc """
  Creates a document from `name` and an optional `rows`. Invalid fields are a
  400 with `errors` by field.
  """
  def create(conn, params) do
    with {:ok, document} <- Document.create(params) do
      conn |> put_status(:created) |> json(document)
    end
  end

  @doc "Returns a document, archived or not."
  def show(conn, %{"id" => id}) do
    with {:ok, document} <- Document.find(id), do: json(conn, document)
  end

  @doc """
  Renames a document to `name`. A missing, blank or too long name is a 400
  with `errors` by field.
  """
  def update(conn, params = %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, renamed} <- Document.rename(document, params) do
      json(conn, renamed)
    end
  end

  @doc """
  Archives a document, which takes it off the list and keeps its content.

  This action serves `DELETE /documents/:id` but does not delete anything,
  because the rows are a record of what was prepared.
  """
  def archive(conn, %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, archived} <- Document.archive(document) do
      json(conn, archived)
    end
  end

  @doc "Unarchives a document, which puts it back on the list."
  def unarchive(conn, %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, restored} <- Document.unarchive(document) do
      json(conn, restored)
    end
  end

  @doc """
  Returns the document's updates as base64 `entries`, and `through`, the id of
  the last update returned.

  Applying the entries rebuilds the document's content. A compaction built
  from these entries sends `through` back, so that it keeps any update
  appended after this read.

  With `after`, only the updates written after that id are returned. An
  `after` that is not a whole number is a 400 with `invalid_after`.
  """
  def updates(conn, params = %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, since} <- whole_number(params["after"] || 0, :invalid_after) do
      {updates, through} = Document.updates(document, after: since)

      json(conn, %{entries: Enum.map(updates, &Base.encode64/1), through: through})
    end
  end

  @doc """
  Appends one base64 update to a document, with an optional `rows` count. A
  missing or invalid `rows` leaves the stored count unchanged. An `update`
  that is missing or not base64 is a 400 with `invalid_update`.

  With `relay` set to true, the update is also broadcast as an `update` message
  to the connections on the document's channel, as if a connection had sent it.
  A connection relays its own edits, so `relay` is for an update from a writer
  that is not connected to the document.
  """
  def append(conn, params = %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, bytes} <- decoded(params["update"]),
         {:ok, _} <- Document.append(document, bytes, Params.integer(params["rows"])),
         :ok <- relay(document, params["update"], params["relay"]) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Replaces every update up to `through` with one merged update.

  The caller builds the merged update, because the server does not parse the
  content. `through` is the id returned by the read the merge was built from,
  and updates with a larger id are kept. See `RichardBurton.Document.compact/3`.
  A `through` that is missing or not a whole number is a 400 with
  `invalid_through`, and an `update` that is missing or not base64 one with
  `invalid_update`.
  """
  def compact(conn, params = %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, through} <- whole_number(params["through"], :invalid_through),
         {:ok, bytes} <- decoded(params["update"]),
         {:ok, _} <- Document.compact(document, bytes, through) do
      send_resp(conn, :no_content, "")
    end
  end

  # Relays `update` to the connections on `document` when the request asked for
  # it with `relay` set to true, and does nothing otherwise. Returns `:ok`.
  defp relay(document, update, true), do: DocumentChannel.relay!(document.id, update)
  defp relay(_document, _update, _relay), do: :ok

  # Decodes a base64 update, or returns `{:error, :invalid_update}` for
  # anything that is not a base64 string.
  defp decoded(update) when is_binary(update) do
    case Base.decode64(update) do
      {:ok, bytes} -> {:ok, bytes}
      :error -> {:error, :invalid_update}
    end
  end

  defp decoded(_update), do: {:error, :invalid_update}

  # Parses the `after` cursor of the list into `{updated_at, id}`. Returns
  # `{:ok, nil}` when there is no cursor, and `{:error, :invalid_after}` when it
  # is malformed.
  defp cursor(nil), do: {:ok, nil}

  defp cursor(%{"updated_at" => updated_at, "id" => id}) when is_binary(updated_at) do
    with {:ok, updated_at} <- NaiveDateTime.from_iso8601(updated_at),
         {:ok, id} <- whole_number(id, :invalid_after) do
      {:ok, {updated_at, id}}
    else
      _ -> {:error, :invalid_after}
    end
  end

  defp cursor(_), do: {:error, :invalid_after}

  # Returns `{:ok, n}` for a whole number, as `RichardBurtonWeb.Params.integer/1`
  # reads it, and `{:error, reason}` for anything else.
  defp whole_number(value, reason) do
    case Params.integer(value) do
      nil -> {:error, reason}
      n -> {:ok, n}
    end
  end
end
