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
  alias RichardBurton.Validation

  @doc """
  A short-lived token for this person to open a live connection with.

  The session cookie is httpOnly, so the page cannot read it to hand over as a
  connect parameter. This is minted behind the same authentication the rest of
  these endpoints ask for, and a client asks again each time it connects, since
  a token is spent on one connection rather than held for the session.
  """
  def socket_token(conn, _params) do
    json(conn, %{token: RichardBurtonWeb.DocumentSocket.sign(conn.assigns.subject_id)})
  end

  @doc """
  A page of the documents on offer, and how many there are in all.

  The total is what tells a reader there is more to ask for, since a page that
  happens to come back full says nothing either way.
  """
  def index(conn, params) do
    limit = integer_param(params["limit"])
    offset = integer_param(params["offset"]) || 0

    archived = params["archived"] == "true"

    json(conn, %{
      entries: Document.all(limit: limit, offset: offset, archived: archived),
      total: Document.count(archived: archived)
    })
  end

  def create(conn, params) do
    case Document.create(params) do
      {:ok, document} ->
        conn |> put_status(:created) |> json(document)

      {:error, changeset} ->
        conn |> put_status(:bad_request) |> json(%{errors: Validation.get_errors(changeset)})
    end
  end

  def show(conn, %{"id" => id}) do
    with_document(conn, id, &json(conn, &1))
  end

  @doc "Give a document a different name."
  def update(conn, %{"id" => id, "name" => name}) do
    with_document(conn, id, fn document ->
      case Document.rename(document, name) do
        {:ok, renamed} ->
          json(conn, renamed)

        {:error, changeset} ->
          conn |> put_status(:bad_request) |> json(%{errors: Validation.get_errors(changeset)})
      end
    end)
  end

  def update(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: :name_required})
  end

  @doc """
  Take a document off the list, keeping what it holds.

  Archiving rather than deleting: the rows are a record of what was prepared.
  """
  def archive(conn, %{"id" => id}) do
    with_document(conn, id, fn document ->
      {:ok, archived} = Document.archive(document)
      json(conn, archived)
    end)
  end

  @doc "Put an archived document back on the list."
  def unarchive(conn, %{"id" => id}) do
    with_document(conn, id, fn document ->
      {:ok, restored} = Document.unarchive(document)
      json(conn, restored)
    end)
  end

  @doc """
  Everything needed to rebuild the content, with the id of the last update it
  includes.

  A client applies them and is then holding the same content as everyone else
  who has read it. It keeps the id, which is what it names when it later writes
  a compaction, so that whatever was appended in the meantime is not replaced.
  """
  def updates(conn, %{"id" => id}) do
    with_document(conn, id, fn document ->
      {updates, through} = Document.updates(document)

      json(conn, %{entries: Enum.map(updates, &Base.encode64/1), through: through})
    end)
  end

  @doc "Append one change, with the row count the client counted while making it."
  def append(conn, params = %{"id" => id, "update" => update}) do
    with_document(conn, id, fn document ->
      with_decoded(conn, update, fn bytes ->
        {:ok, _} = Document.append(document, bytes, params["rows"])
        send_resp(conn, :no_content, "")
      end)
    end)
  end

  @doc """
  Write one merged update in place of every update up to `through`.

  Only a client can merge them, since only a client reads the content. `through`
  is the point the merge reaches, and anything appended past it is left where it
  is — see `RichardBurton.Document.compact/3`.
  """
  def compact(conn, %{"id" => id, "update" => update, "through" => through}) do
    with {:ok, bound} <- bounded(through),
         {:ok, bytes} <- decoded(update) do
      with_document(conn, id, fn document ->
        {:ok, _} = Document.compact(document, bytes, bound)
        send_resp(conn, :no_content, "")
      end)
    else
      {:error, reason} -> conn |> put_status(:bad_request) |> json(%{error: reason})
    end
  end

  def compact(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: :invalid_through})
  end

  # Runs `found` with the document, or answers 404.
  defp with_document(conn, id, found) do
    case Document.find(id) do
      {:ok, document} -> found.(document)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: :not_found})
    end
  end

  # Runs `held` with the decoded bytes, or refuses what is not base64.
  defp with_decoded(conn, update, held) do
    case decoded(update) do
      {:ok, bytes} -> held.(bytes)
      {:error, reason} -> conn |> put_status(:bad_request) |> json(%{error: reason})
    end
  end

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
