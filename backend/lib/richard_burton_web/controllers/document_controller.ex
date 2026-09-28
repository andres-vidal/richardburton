defmodule RichardBurtonWeb.DocumentController do
  @moduledoc """
  The import-document endpoints: starting one, listing them, renaming and
  retiring one, and the updates a document's content is made of.

  The list is shared, so nothing here scopes it to who is asking. Updates go in
  and out as base64 in JSON, because that is what the rest of this API speaks.
  The server never parses one — see `RichardBurton.Document`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Document

  @doc """
  A short-lived token for this person to open a live connection with.

  The session cookie is httpOnly, so the page cannot read it to hand over as a
  connect parameter. This is minted behind the same authentication the rest of
  these endpoints ask for, and names the session it was minted under, which is
  what the socket asks about each time it is used.
  """
  def socket_token(conn, _params) do
    %{subject_id: subject_id, session_id: session_id} = conn.assigns

    json(conn, %{token: RichardBurtonWeb.DocumentSocket.sign(subject_id, session_id)})
  end

  @doc """
  A page of the documents on one side of the list, and whether more follow it.

  `after` is the cursor of the page before, given as the last document's
  `updated_at` and `id`. Without one, the first page is read.
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

  @doc "Give a document a different name."
  def update(conn, %{"id" => id, "name" => name}) do
    with {:ok, document} <- Document.find(id),
         {:ok, renamed} <- Document.rename(document, name) do
      json(conn, renamed)
    end
  end

  def update(_conn, _params), do: {:error, :name_required}

  @doc """
  Take a document off the list, keeping what it holds.

  Archiving rather than deleting: the rows are a record of what was prepared.
  """
  def archive(conn, %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, archived} <- Document.archive(document) do
      json(conn, archived)
    end
  end

  @doc "Put an archived document back on the list."
  def unarchive(conn, %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, restored} <- Document.unarchive(document) do
      json(conn, restored)
    end
  end

  @doc """
  Everything needed to rebuild the content, with the id of the last update it
  includes.

  A client applies them and is then holding the same content as everyone else
  who has read it. It keeps the id, which is what it names when it later writes
  a compaction, so that whatever was appended in the meantime is not replaced.

  `after` names an id the reader has already read through, and only what was
  written after it is returned.
  """
  def updates(conn, params = %{"id" => id}) do
    with {:ok, document} <- Document.find(id),
         {:ok, since} <- since(params["after"]) do
      {updates, through} = Document.updates(document, after: since)

      json(conn, %{entries: Enum.map(updates, &Base.encode64/1), through: through})
    end
  end

  @doc "Append one change, with the row count the client counted while making it."
  def append(conn, params = %{"id" => id, "update" => update}) do
    with {:ok, document} <- Document.find(id),
         {:ok, bytes} <- decoded(update),
         {:ok, _} <- Document.append(document, bytes, integer_param(params["rows"])) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Write one merged update in place of every update up to `through`.

  Only a client can merge them, since only a client reads the content. `through`
  is the point the merge reaches, and anything appended past it is left where it
  is — see `RichardBurton.Document.compact/3`.
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

  # The bytes an encoded update stands for, or why it is not one.
  defp decoded(update) do
    case Base.decode64(update) do
      {:ok, bytes} -> {:ok, bytes}
      :error -> {:error, :invalid_update}
    end
  end

  # The point a compaction claims to reach, or why it is not one.
  defp bounded(through) do
    case integer_param(through) do
      nil -> {:error, :invalid_through}
      bound -> {:ok, bound}
    end
  end

  # The cursor a page of the list starts after, or nothing for the first page.
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

  # The id a read of the updates starts after, which is none unless one is named.
  defp since(nil), do: {:ok, 0}

  defp since(value) do
    case integer_param(value) do
      nil -> {:error, :invalid_after}
      id -> {:ok, id}
    end
  end

  # A query value read as a whole number, or nothing where it is not one.
  defp integer_param(value) when is_integer(value) and value >= 0, do: value

  defp integer_param(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, ""} when parsed >= 0 -> parsed
      _ -> nil
    end
  end

  defp integer_param(_value), do: nil
end
