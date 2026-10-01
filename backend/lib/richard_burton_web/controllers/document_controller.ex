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
          limit: integer_param(params["limit"]),
          after: cursor,
          archived: params["archived"] == "true"
        )
      )
    end
  end

  def create(conn, params) do
    with {:ok, document} <- Document.create(params) do
      conn |> put_status(:created) |> json(document)
    end
  end

  def show(conn, %{"id" => id}) do
    with {:ok, document} <- Document.find(id), do: json(conn, document)
  end

  @doc """
  Renames a document. A request without `name` is a 400 with `name_required`.
  """
  def update(conn, %{"id" => id, "name" => name}) do
    with {:ok, document} <- Document.find(id),
         {:ok, renamed} <- Document.rename(document, name) do
      json(conn, renamed)
    end
  end

  def update(_conn, _params), do: {:error, :name_required}

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

  With `after`, only the updates written after that id are returned.
  """
  def updates(conn, params = %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, since} <- since(params["after"]) do
      {updates, through} = Document.updates(document, after: since)

      json(conn, %{entries: Enum.map(updates, &Base.encode64/1), through: through})
    end
  end

  @doc """
  Appends one base64 update to a document, with an optional `rows` count. A
  missing or invalid `rows` leaves the stored count unchanged.
  """
  def append(conn, params = %{"id" => id, "update" => update}) do
    with {:ok, document} <- Document.find(id),
         {:ok, bytes} <- decoded(update),
         {:ok, _} <- Document.append(document, bytes, integer_param(params["rows"])) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Replaces every update up to `through` with one merged update.

  The caller builds the merged update, because the server does not parse the
  content. `through` is the id returned by the read the merge was built from,
  and updates with a larger id are kept. See `RichardBurton.Document.compact/3`.
  """
  def compact(conn, %{"id" => id, "update" => update, "through" => through}) do
    with {:ok, document} <- Document.find(id),
         {:ok, bound} <- bounded(through),
         {:ok, bytes} <- decoded(update),
         {:ok, _} <- Document.compact(document, bytes, bound) do
      send_resp(conn, :no_content, "")
    end
  end

  def compact(_conn, _params), do: {:error, :invalid_through}

  # Decodes a base64 update, or returns `{:error, :invalid_update}`.
  defp decoded(update) do
    case Base.decode64(update) do
      {:ok, bytes} -> {:ok, bytes}
      :error -> {:error, :invalid_update}
    end
  end

  # Parses a compaction's `through` as a whole number, or returns
  # `{:error, :invalid_through}`.
  defp bounded(through) do
    case integer_param(through) do
      nil -> {:error, :invalid_through}
      bound -> {:ok, bound}
    end
  end

  # Parses the `after` cursor of the list into `{updated_at, id}`. Returns
  # `{:ok, nil}` when there is no cursor, and `{:error, :invalid_after}` when it
  # is malformed.
  defp cursor(nil), do: {:ok, nil}

  defp cursor(%{"updated_at" => updated_at, "id" => id}) when is_binary(updated_at) do
    with {:ok, updated_at} <- NaiveDateTime.from_iso8601(updated_at),
         id when is_integer(id) <- integer_param(id) do
      {:ok, {updated_at, id}}
    else
      _ -> {:error, :invalid_after}
    end
  end

  defp cursor(_), do: {:error, :invalid_after}

  # Parses the `after` id for a read of updates. Returns 0, which reads every
  # update, when none is given, and `{:error, :invalid_after}` when it is not a
  # whole number.
  defp since(nil), do: {:ok, 0}

  defp since(value) do
    case integer_param(value) do
      nil -> {:error, :invalid_after}
      id -> {:ok, id}
    end
  end

  # Returns a parameter as a non-negative integer, from an integer or a string
  # of digits. Returns nil for anything else.
  defp integer_param(value) when is_integer(value) and value >= 0, do: value

  defp integer_param(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, ""} when parsed >= 0 -> parsed
      _ -> nil
    end
  end

  defp integer_param(_value), do: nil
end
