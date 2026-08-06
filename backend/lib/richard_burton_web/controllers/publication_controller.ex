defmodule RichardBurtonWeb.PublicationController do
  use RichardBurtonWeb, :controller

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.User

  # A later page of a search or listing already begun: the reader has scrolled,
  # and asks for the next stretch of the ordering the first response handed back.
  # The search and the words it matched on ride along so a row matched by its
  # references still says so, without the search being resolved again.
  #
  # The total was reported with the first page and does not change under the
  # reader; a later stretch is only the rows, so it does not pay to count again.
  def index(conn, params = %{"ids" => ids}) do
    entries =
      Publication.Index.details(
        parse_ids(ids),
        Map.get(params, "search"),
        parse_keywords(Map.get(params, "keywords"))
      )

    json(conn, %{entries: entries})
  end

  def index(conn, %{"unreferenced" => _}) do
    {:ok, results} = Publication.Index.without_references()
    conn |> put_total() |> json(%{entries: results})
  end

  # The first response to a query hands back the whole ordering — the ids of
  # every match, in the order they are to be read — the words it matched on, and
  # the first page of them in full. The reader scrolls the rest in by that frozen
  # ordering, so the paging cannot drift as the database changes underneath it.
  def index(conn, %{"search" => query}) do
    case Publication.Index.search_order(query) do
      :none ->
        conn |> put_total() |> json(first_page([], nil, []))

      {order, keywords} ->
        conn |> put_total() |> json(first_page(order, query, keywords))
    end
  end

  def index(conn, _params) do
    conn |> put_total() |> json(first_page(Publication.Index.all_order(), nil, []))
  end

  defp first_page(order, search, keywords) do
    per_page = Publication.Index.per_page()
    entries = Publication.Index.details(Enum.take(order, per_page), search, keywords)

    %{entries: entries, order: order, per_page: per_page, keywords: keywords}
  end

  defp put_total(conn) do
    put_resp_header(
      conn,
      Publication.Index.count_header(),
      Integer.to_string(Publication.Index.count())
    )
  end

  defp parse_ids(ids) when is_list(ids), do: Enum.flat_map(ids, &parse_id/1)
  defp parse_ids(_), do: []

  defp parse_id(id) do
    case Integer.parse(to_string(id)) do
      {id, ""} -> [id]
      _ -> []
    end
  end

  defp parse_keywords(keywords) when is_list(keywords), do: keywords
  defp parse_keywords(_), do: []

  # One publication, flat, the same shape the index lists — so a page that shows
  # a single record does not have to be handed one by a page that lists many.
  def show(conn, %{"id" => id}) do
    case Publication.find(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: :not_found})
      publication -> json(conn, Publication.Codec.flatten(publication))
    end
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
      |> Publication.insert_all(actor(conn))
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

  def update(conn, params = %{"id" => id}) do
    {status, body} =
      params
      |> Map.delete("id")
      |> Publication.Codec.nest()
      |> then(&Publication.update(id, &1, actor(conn)))
      |> case do
        {:ok, publication} ->
          {:ok, Publication.Codec.flatten(publication)}

        {:error, :not_found} ->
          {:not_found, %{error: :not_found}}

        {:error, :conflict} ->
          {:conflict, %{errors: :conflict}}

        {:error, errors} ->
          {:bad_request, %{errors: errors}}
      end

    conn |> put_status(status) |> json(body)
  end

  # The clusters of records that look like the same publication entered twice,
  # likeliest first — what the duplicate review steps through.
  def duplicates(conn, _params) do
    entries =
      Enum.map(
        Publication.Duplicates.clusters(),
        &%{publications: &1.publications, score: &1.score}
      )

    json(conn, %{entries: entries, threshold: Publication.Duplicates.threshold()})
  end

  # Remember that these are not the same record twice, so the review stops
  # asking. Naming fewer than two says nothing there is to remember.
  def distinguish(conn, %{"publications" => ids = [_, _ | _]}) do
    case Publication.Duplicates.tell_apart(ids, actor(conn)) do
      {:ok, _count} -> send_resp(conn, :no_content, "")
      {:error, reason} -> conn |> put_status(:bad_request) |> json(%{error: reason})
    end
  end

  def distinguish(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: :not_enough})
  end

  # Collapse publications into this one. The losers are named in the body, so
  # the address stays the surviving record's own.
  def merge(conn, %{"id" => id, "losers" => losers = [_ | _]}) do
    case Publication.merge(id, losers, actor(conn)) do
      {:ok, publication} ->
        json(conn, Publication.Codec.flatten(publication))

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: :not_found})

      {:error, :self} ->
        conn |> put_status(:bad_request) |> json(%{error: :self})

      # The merged record would be a publication that already exists.
      {:error, :conflict} ->
        conn |> put_status(:conflict) |> json(%{error: :conflict})

      {:error, errors} ->
        conn |> put_status(:bad_request) |> json(%{errors: errors})
    end
  end

  def merge(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: :losers_required})
  end

  def delete(conn, %{"id" => id}) do
    case Publication.delete(id, actor(conn)) do
      {:ok, _publication} ->
        send_resp(conn, :no_content, "")

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: :not_found})
    end
  end

  # A publication's mutation stream, newest first, for the admin history viewer.
  # Records created before the history log simply have no entries.
  def history(conn, %{"id" => id}) do
    json(conn, %{entries: id |> Publication.History.of() |> Enum.map(&serialize_history/1)})
  end

  # Every recorded change across the database, newest first — the admin feed.
  def history(conn, _params) do
    json(conn, %{entries: Publication.History.all() |> Enum.map(&serialize_history/1)})
  end

  # Undo one recorded change. The server decides whether the entry is still
  # reconcilable and what the compensating action is; the client only names the
  # entry. A version that is not a number cannot match a row, so it reads as a
  # miss rather than an error.
  def undo(conn, %{"id" => id, "version" => version}) do
    case Integer.parse(version) do
      {version, ""} ->
        case Publication.undo(id, version, actor(conn)) do
          {:ok, _publication} -> send_resp(conn, :no_content, "")
          {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: :not_found})
          {:error, :conflict} -> conn |> put_status(:conflict) |> json(%{error: :conflict})
          {:error, errors} -> conn |> put_status(:bad_request) |> json(%{errors: errors})
        end

      _ ->
        conn |> put_status(:not_found) |> json(%{error: :not_found})
    end
  end

  # The publications that are *currently* deleted — the trash's own state,
  # not the history of deletions (a record deleted, restored, and deleted
  # again is one tombstone but three entries in the log).
  def index_deleted(conn, _params) do
    entries =
      Enum.map(
        Publication.all_deleted(),
        &%{publication: Publication.Codec.flatten(&1), deleted_at: &1.deleted_at}
      )

    json(conn, %{entries: entries})
  end

  def restore(conn, %{"id" => id}) do
    case Publication.restore(id, actor(conn)) do
      {:ok, _publication} ->
        send_resp(conn, :no_content, "")

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: :not_found})

      # The same record was imported again while this one sat in the trash.
      {:error, :conflict} ->
        conn |> put_status(:conflict) |> json(%{error: :conflict})
    end
  end

  defp serialize_history(entry) do
    %{
      publication_id: entry.publication_id,
      version: entry.version,
      action: entry.action,
      actor: entry.actor,
      snapshot: entry.snapshot,
      diff: entry.diff,
      undoable: entry.undoable,
      # The records this entry took in, or gave back — what makes a merge one
      # thing in the log rather than a change to each of them.
      absorbed: entry.absorbed,
      timestamp: entry.inserted_at
    }
  end

  # Admin mutations are recorded in the publication history under the acting
  # user's email; subject_id is assigned by the authentication plug.
  defp actor(conn) do
    User.get(conn.assigns.subject_id).email
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

  def validate(conn, params = %{"id" => id}) do
    publication = Map.delete(params, "id")

    conn
    |> put_status(:ok)
    |> json(validate_publication(publication, id))
  end

  defp validate_publication(p, exclude_id \\ nil) do
    case FlatPublication.validate(p, exclude_id) do
      :ok -> %{publication: p, errors: nil}
      {:error, errors} -> %{publication: p, errors: errors}
    end
  end
end
