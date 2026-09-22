defmodule RichardBurtonWeb.DocumentController do
  @moduledoc """
  The import-document endpoints: starting one, listing them, and the updates a
  document's content is made of.

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
  these endpoints ask for.
  """
  def socket_token(conn, _params) do
    json(conn, %{token: RichardBurtonWeb.DocumentSocket.sign(conn.assigns.subject_id)})
  end

  def index(conn, _params) do
    json(conn, %{entries: Document.all()})
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

  @doc """
  Everything needed to rebuild the content, oldest first.

  A client applies them in order and is then holding the same content as
  everyone else who has read it.
  """
  def updates(conn, %{"id" => id}) do
    with_document(conn, id, fn document ->
      json(conn, %{entries: Enum.map(Document.updates(document), &Base.encode64/1)})
    end)
  end

  @doc "Append one change, with the row count the client counted while making it."
  def append(conn, params = %{"id" => id, "update" => update}) do
    with_document(conn, id, fn document ->
      with_decoded(conn, update, fn bytes ->
        {:ok, _} = Document.append(document, bytes, params["rows"] || document.rows)
        send_resp(conn, :no_content, "")
      end)
    end)
  end

  @doc """
  Replace the document's updates with one merged update that means the same.

  Only a client can merge them, since only a client reads the content.
  """
  def compact(conn, %{"id" => id, "update" => update}) do
    with_document(conn, id, fn document ->
      with_decoded(conn, update, fn bytes ->
        {:ok, _} = Document.compact(document, bytes)
        send_resp(conn, :no_content, "")
      end)
    end)
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
    case Base.decode64(update) do
      {:ok, bytes} -> held.(bytes)
      :error -> conn |> put_status(:bad_request) |> json(%{error: :invalid_update})
    end
  end
end
