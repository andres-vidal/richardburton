defmodule RichardBurtonWeb.PublicationController do
  use RichardBurtonWeb, :controller

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication

  def index(conn, %{"search" => query}) do
    {:ok, results, keywords} = Publication.Index.search(query)

    conn
    |> put_resp_header("rb-total-count", Integer.to_string(Publication.Index.count()))
    |> json(%{entries: results, keywords: keywords})
  end

  def index(conn, _params) do
    {:ok, results} = Publication.Index.all()

    conn
    |> put_resp_header("rb-total-count", Integer.to_string(Publication.Index.count()))
    |> json(%{entries: results})
  end

  def export(conn, %{"search" => query, "select" => attributes}) do
    attributes = Enum.map(attributes, &String.to_existing_atom/1)
    {:ok, results, _} = Publication.Index.search(query, select: attributes)
    filename = "publications-#{query}-#{Enum.join(attributes, "-")}.csv"
    send_exported_csv(conn, results, filename)
  end

  def export(conn, %{"search" => query}) do
    {:ok, results, _} = Publication.Index.search(query, select: [])
    filename = "publications-#{query}.csv"
    send_exported_csv(conn, results, filename)
  end

  def export(conn, %{"select" => attributes}) do
    attributes = Enum.map(attributes, &String.to_existing_atom/1)
    {:ok, results} = Publication.Index.all(select: attributes)
    filename = "publications-#{Enum.join(attributes, "-")}.csv"
    send_exported_csv(conn, results, filename)
  end

  def export(conn, _params) do
    {:ok, results} = Publication.Index.all(select: [])
    filename = "publications.csv"
    send_exported_csv(conn, results, filename)
  end

  defp send_exported_csv(conn, data, filename) do
    content = Publication.Codec.to_csv(data)

    send_download(
      conn,
      {:binary, content},
      filename: filename,
      disposition: :attachment
    )
  end

  def create_all(conn, %{"_json" => entries}) do
    {status, response_body} =
      entries
      |> Publication.Codec.nest()
      |> Publication.insert_all()
      |> case do
        {:ok, publications} ->
          {:created, publications}

        {:error, {publication, :conflict}} ->
          {:conflict, publication}

        {:error, {publication, errors}} ->
          {:bad_request, %{publication: publication, errors: errors}}
      end

    conn |> put_status(status) |> json(Publication.Codec.flatten(response_body))
  end

  def validate(conn, %{"csv" => %Plug.Upload{path: path}}) do
    case Publication.Codec.from_csv(path) do
      {:ok, publications} ->
        result = Enum.map(publications, &validate_publication/1)

        conn
        |> put_status(:ok)
        |> json(result)

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(reason)
    end
  end

  def validate(conn, %{"_json" => publications}) do
    result = Enum.map(publications, &validate_publication/1)

    conn
    |> put_status(:ok)
    |> json(result)
  end

  defp validate_publication(p) do
    case FlatPublication.validate(p) do
      :ok -> %{publication: p, errors: nil}
      {:error, errors} -> %{publication: p, errors: errors}
    end
  end
end
