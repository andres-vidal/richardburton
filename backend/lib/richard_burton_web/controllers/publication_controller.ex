defmodule RichardBurtonWeb.PublicationController do
  @moduledoc """
  The publication endpoints: reading the index, searching and exporting it, and
  the admin writes — insert, update, merge, delete, restore and undo.

  Reads are paged by a frozen ordering rather than by offset. The first response
  to a query carries the whole ordering — every matching id, in reading order —
  plus the first page of rows; later pages are fetched by id against that
  ordering, so results cannot drift as the database changes underneath a reader.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.User

  # A later page of a search or listing that has already started: the reader has
  # scrolled, and is asking for the next stretch of the ordering the first
  # response returned. The search is sent along too, so each row can still show
  # what matched it.
  #
  # The total was already reported with the first page and does not change while
  # the reader scrolls, so later pages return only the rows and skip counting.
  def index(conn, params = %{"ids" => ids}) do
    entries = Publication.Index.details(parse_ids(ids), Map.get(params, "search"))

    json(conn, %{entries: entries})
  end

  def index(conn, %{"unsourced" => _}) do
    {:ok, results} = Publication.Index.without_sources()
    conn |> put_total() |> json(%{entries: results})
  end

  # The first response to a query returns two things: the whole ordering (the ids
  # of every match, in reading order) and the first page of those rows in full.
  # The reader scrolls the rest in using that fixed ordering, so paging cannot
  # drift as the database changes underneath.
  def index(conn, %{"search" => query}) do
    case Publication.Index.search_order(query) do
      :none -> conn |> put_total() |> json(first_page([], nil))
      order -> conn |> put_total() |> json(first_page(order, query))
    end
  end

  def index(conn, _params) do
    conn |> put_total() |> json(first_page(Publication.Index.all_order(), nil))
  end

  # How the index read the term is included in the response for the caller to
  # report. The rows do not need it: each one already carries its own record of
  # what matched it.
  defp first_page(order, search) do
    per_page = Publication.Index.per_page()
    entries = Publication.Index.details(Enum.take(order, per_page), search)

    %{
      entries: entries,
      order: order,
      per_page: per_page,
      matched: search && Publication.Index.Excerpt.resolution(search)
    }
  end

  # The total row count, sent as a header because it belongs to the query rather
  # than to any one page.
  defp put_total(conn) do
    put_resp_header(
      conn,
      Publication.Index.count_header(),
      Integer.to_string(Publication.Index.count())
    )
  end

  # Ids from the query string, dropping anything that is not an integer rather
  # than failing the request.
  defp parse_ids(ids) when is_list(ids), do: Enum.flat_map(ids, &parse_id/1)
  defp parse_ids(_), do: []

  # One id as a single-element list, or an empty one, so an unparseable id is
  # dropped by the flat_map rather than failing the request.
  defp parse_id(id) do
    case Integer.parse(to_string(id)) do
      {id, ""} -> [id]
      _ -> []
    end
  end

  # One publication, flattened into the same shape the index lists, so a page
  # showing a single record does not need a page listing many to hand it one. If
  # the reader arrived from a search, that search is sent along too, so the record
  # highlights what matched exactly as the index did.
  def show(conn, params = %{"id" => id}) do
    with {:ok, publication} <- found(Publication.find(id)) do
      flat = Publication.Codec.flatten(publication)
      json(conn, excerpted(flat, Map.get(params, "search")))
    end
  end

  # The record itself is read from the live table, so it is available as soon as it
  # is written. The excerpts come from the index, which lags behind, so a record
  # written moments ago has none. It is shown without highlighting rather than not
  # shown at all.
  defp excerpted(flat, nil), do: flat

  defp excerpted(flat, search) do
    case Publication.Index.detail(flat.id, search) do
      [indexed] ->
        %{flat | excerpts: indexed.excerpts, marked: indexed.marked}

      [] ->
        flat
    end
  end

  def export(conn, %{"search" => query, "select" => attributes}) do
    attributes = Enum.map(attributes, &String.to_existing_atom/1)
    {:ok, results} = Publication.Index.search(query, select: attributes)
    filename = "publications-#{query}-#{Enum.join(attributes, "-")}.csv"
    send_exported_csv(conn, results, filename)
  end

  def export(conn, %{"search" => query}) do
    {:ok, results} = Publication.Index.search(query, select: [])
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

  # Sends results as a CSV attachment.
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
    attrs = params |> Map.delete("id") |> Publication.Codec.nest()

    with {:ok, publication} <- Publication.update(id, attrs, actor(conn)) do
      json(conn, Publication.Codec.flatten(publication))
    end
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
    with {:ok, _count} <- Publication.Duplicates.rule_apart(ids, actor(conn)) do
      send_resp(conn, :no_content, "")
    end
  end

  def distinguish(_conn, _params), do: {:error, :not_enough}

  # Responds with `entries`, the result of
  # `Publication.Duplicates.resemblances/1` for the rows in the request body.
  # The rows are publications that are not stored yet, so each entry names its
  # row by its position in the list.
  def resemblances(conn, %{"_json" => rows}) do
    json(conn, %{entries: Publication.Duplicates.resemblances(rows)})
  end

  # What has been ruled apart, so a reviewer can see a decision and take it back.
  def distinctions(conn, _params) do
    json(conn, %{entries: Publication.Duplicates.ruled_apart()})
  end

  # Put a pair back among the questions. Naming fewer than two says nothing
  # there is to take back.
  def reconsider(conn, %{"publications" => ids = [_, _ | _]}) do
    {:ok, _count} = Publication.Duplicates.reconsider(ids)
    send_resp(conn, :no_content, "")
  end

  def reconsider(_conn, _params), do: {:error, :not_enough}

  # Collapse publications into this one. The losers are named in the body, so
  # the address stays the surviving record's own.
  #
  # A `:conflict` means the merged record would be a publication that already
  # exists.
  def merge(conn, %{"id" => id, "losers" => losers}) when is_list(losers) do
    case Publication.merge(id, losers, actor(conn)) do
      {:ok, publication} ->
        json(conn, Publication.Codec.flatten(publication))

      # Merging a record into itself, or naming no losers, is a malformed
      # request, so it is a 400 rather than the 409 that `:self` gets elsewhere.
      {:error, reason} when reason in [:self, :no_losers] ->
        {:error, :bad_request, reason}

      error ->
        error
    end
  end

  def merge(_conn, _params), do: {:error, :losers_required}

  def delete(conn, %{"id" => id}) do
    with {:ok, _publication} <- Publication.delete(id, actor(conn)) do
      send_resp(conn, :no_content, "")
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
  # entry.
  def undo(conn, %{"id" => id, "version" => version}) do
    with {:ok, version} <- integer_of(version),
         {:ok, _publication} <- Publication.undo(id, version, actor(conn)) do
      send_resp(conn, :no_content, "")
    end
  end

  # Parses an integer from the path, such as an id or a history version. A value
  # that is not a number cannot name a stored row, so it returns
  # `{:error, :not_found}` rather than a 400.
  defp integer_of(value) do
    case Integer.parse(value) do
      {integer, ""} -> {:ok, integer}
      _ -> {:error, :not_found}
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

  # Restores a deleted publication. A body with the publication's fields is
  # applied to it first, as an edit, so a restore that would conflict can be
  # made with changes.
  #
  # When another publication that is not deleted has the same composite key,
  # the response is a 409 with `error: "conflict"` and that publication. It
  # fails with `:absorbed` when a merge absorbed the publication. Only undoing
  # the merge brings back an absorbed record.
  def restore(conn, params = %{"id" => id}) do
    changes =
      case Map.delete(params, "id") do
        empty when map_size(empty) == 0 -> nil
        fields -> Publication.Codec.nest(fields)
      end

    case Publication.restore(id, actor(conn), changes) do
      {:ok, _publication} ->
        send_resp(conn, :no_content, "")

      {:error, {:conflict, twin}} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: :conflict, publication: Publication.Codec.flatten(twin)})

      error ->
        error
    end
  end

  # One history entry as the client reads it, including the records a merge
  # absorbed and whether the entry is still undoable.
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
      absorbed: Publication.History.absorbed_records(entry),
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
        result = validate_publications(publications)

        conn
        |> put_status(:ok)
        |> json(result)

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(reason)
    end
  end

  def validate(conn, %{"_json" => publications}) do
    result = validate_publications(publications)

    conn
    |> put_status(:ok)
    |> json(result)
  end

  def validate(conn, params = %{"id" => id}) do
    with {:ok, id} <- integer_of(id) do
      publication = Map.delete(params, "id")

      conn
      |> put_status(:ok)
      |> json(reported(FlatPublication.validate(publication, id), publication))
    end
  end

  # Publications validated without being written, each reported as the record
  # and its errors so a client can show both.
  defp validate_publications(publications) do
    publications
    |> FlatPublication.validate_all()
    |> Enum.zip_with(publications, &reported/2)
  end

  # A validation result reported with the publication it is for.
  defp reported(:ok, publication), do: %{publication: publication, errors: nil}
  defp reported({:error, errors}, publication), do: %{publication: publication, errors: errors}
end
