defmodule RichardBurtonWeb.PublicationController do
  @moduledoc """
  The publication endpoints: listing, searching and exporting the index,
  validating publications, the writes (insert, update, merge, delete, restore
  and undo), the history, and the duplicate review.

  The index is paged by a fixed **order** rather than by offset. The first
  response to a listing or a search holds the ids of every publication it
  matches, in reading order, and the rows of the first page. A later page is
  requested by the ids it holds.

  A path id that is not a whole number is a 404, as `RichardBurtonWeb.Params.id/1`
  says. A write that would give a publication the composite key of another is a
  409 whose body holds `error: "conflict"` and, when the response names it,
  `publication`, the other publication.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication

  @doc """
  Lists the publications in the index.

  Without `ids`, the response holds `order`, the ids of every publication the
  `search` parameter matches, or of every publication when there is no search;
  `entries`, the rows of the first `per_page` of them; `per_page`; and
  `matched`, which is `Publication.Index.Excerpt.resolution/2` for the search,
  or nil. The words of the search are looked up once, for all three.

  With `ids`, the response holds `entries` alone: the rows of those ids in the
  order given, with the excerpts of `search` when there is one. An id that is
  not a whole number is left out. Reading later pages by id against a fixed
  `order` keeps them stable when publications are added or deleted between
  requests.

  With `unsourced`, the response holds `entries`, every publication without
  sources, ordered by id.

  Every response but the one for `ids` puts the number of publications in the
  index in the count header (see `Publication.Index.count_header/0`).
  """
  def index(conn, params = %{"ids" => ids}) do
    entries = Publication.Index.details(Params.integers(ids), params["search"])

    json(conn, %{entries: entries})
  end

  def index(conn, %{"unsourced" => _}) do
    {:ok, results} = Publication.Index.without_sources()
    conn |> put_total() |> json(%{entries: results})
  end

  def index(conn, %{"search" => query}) do
    standings = Publication.Index.standings(query)

    case Publication.Index.search_order(query, standings) do
      :none -> conn |> put_total() |> json(first_page([], nil, %{}))
      order -> conn |> put_total() |> json(first_page(order, query, standings))
    end
  end

  def index(conn, _params) do
    conn |> put_total() |> json(first_page(Publication.Index.all_order(), nil, %{}))
  end

  # Returns the body of a first page: `order`, the rows of its first
  # `per_page` ids as `entries`, `per_page`, and `matched`, the resolution of
  # `search`, or nil when `search` is nil. `standings` are the search's, as
  # `Publication.Index.standings/1` returns them.
  defp first_page(order, search, standings) do
    per_page = Publication.Index.per_page()
    entries = Publication.Index.details(Enum.take(order, per_page), search, standings)

    %{
      entries: entries,
      order: order,
      per_page: per_page,
      matched: search && Publication.Index.Excerpt.resolution(search, standings)
    }
  end

  # Puts the number of publications in the index in the count header. The
  # number counts the whole index, whatever the request searched for.
  defp put_total(conn) do
    put_resp_header(
      conn,
      Publication.Index.count_header(),
      Integer.to_string(Publication.Index.count())
    )
  end

  @doc """
  Responds with the publication `id`, flattened into the shape the index lists.
  With a `search`, the publication holds the excerpts and marks of that search,
  as in the index. A deleted publication is a 404.
  """
  def show(conn, params = %{"id" => id}) do
    with {:ok, id} <- Params.id(id),
         {:ok, publication} <- found(Publication.find(id)) do
      flat = Publication.Codec.flatten(publication)
      json(conn, excerpted(flat, params["search"]))
    end
  end

  # Returns `flat` with the excerpts and marks of `search`, read from the
  # index. The index lags behind writes, so a publication written since its
  # last refresh is returned without them.
  defp excerpted(flat, nil), do: flat

  defp excerpted(flat, search) do
    case Publication.Index.detail(flat.id, search) do
      [indexed] -> %{flat | excerpts: indexed.excerpts, marked: indexed.marked}
      [] -> flat
    end
  end

  @doc """
  Responds with a CSV attachment of the publications the `search` parameter
  matches, or of every publication when there is no search. The `select`
  parameter lists the columns, and every column is included when it is absent.
  The file name holds the search and the columns.
  """
  def export(conn, params) do
    search = params["search"]
    attributes = params |> Map.get("select", []) |> Enum.map(&String.to_existing_atom/1)

    {:ok, results} =
      case search do
        nil -> Publication.Index.all(select: attributes)
        search -> Publication.Index.search(search, select: attributes)
      end

    send_download(conn, {:binary, Publication.Codec.to_csv(results)},
      filename: Enum.join(["publications" | List.wrap(search)] ++ attributes, "-") <> ".csv",
      disposition: :attachment
    )
  end

  @doc """
  Inserts the publications in the request body, all or none, and responds with
  them, flattened, as a 201.

  When one of them has the composite key of a stored publication or of an
  earlier one in the body, nothing is inserted, and the response is a 409 with
  `error: "conflict"` and `publication`, the first publication that repeats a
  key. When one is invalid, the response is a 400 with `error: "invalid"`,
  `publication`, the first invalid one, and its `errors`.
  """
  def create_all(conn, %{"_json" => entries}) do
    case entries |> Publication.Codec.nest() |> Publication.insert_all(actor(conn)) do
      {:ok, publications} ->
        conn |> put_status(:created) |> json(Publication.Codec.flatten(publications))

      {:error, {publication, :conflict}} ->
        conflict(conn, publication)

      {:error, {publication, errors}} ->
        conn
        |> put_status(:bad_request)
        |> json(
          %{publication: publication, errors: errors}
          |> Publication.Codec.flatten()
          |> Map.put("error", "invalid")
        )
    end
  end

  @doc """
  Replaces the fields of the publication `id` with the flat fields in the
  request body, and responds with the publication, flattened. Invalid fields
  are a 400 whose `errors` are keyed by the same flat fields.
  """
  def update(conn, params = %{"id" => id}) do
    attrs = params |> Map.delete("id") |> Publication.Codec.nest()

    with {:ok, id} <- Params.id(id),
         {:ok, publication} <- id |> Publication.update(attrs, actor(conn)) |> flat_errors() do
      json(conn, Publication.Codec.flatten(publication))
    end
  end

  # Returns `result` with a map of errors keyed by the flat fields, as
  # `Publication.Codec.flatten_errors/1` gives them. Any other result is
  # returned unchanged.
  defp flat_errors({:error, errors}) when is_map(errors),
    do: {:error, Publication.Codec.flatten_errors(errors)}

  defp flat_errors(result), do: result

  @doc """
  Responds with the clusters of publications that look like one publication
  entered twice, likeliest first, as `entries`, and the `threshold` their
  scores are compared with. See `Publication.Duplicates.clusters/0`.
  """
  def duplicates(conn, _params) do
    json(conn, %{
      entries: Publication.Duplicates.clusters(),
      threshold: Publication.Duplicates.threshold()
    })
  end

  @doc """
  Records that the publications with the ids in `publications` are not
  duplicates of each other, so `duplicates/2` no longer reports them together.
  Naming fewer than two is a 400 with `not_enough`.
  """
  def distinguish(conn, %{"publications" => ids = [_, _ | _]}) do
    with {:ok, _count} <- Publication.Duplicates.rule_apart(ids, actor(conn)) do
      send_resp(conn, :no_content, "")
    end
  end

  def distinguish(_conn, _params), do: {:error, :not_enough}

  @doc """
  Responds with `entries`, the result of `Publication.Duplicates.resemblances/1`
  for the rows in the request body. The rows are publications that are not
  stored yet, so each entry names its row by its position in the list.
  """
  def resemblances(conn, %{"_json" => rows}) do
    json(conn, %{entries: Publication.Duplicates.resemblances(rows)})
  end

  @doc """
  Responds with `entries`, the pairs of publications that `distinguish/2`
  recorded as not duplicates. See `Publication.Duplicates.ruled_apart/0`.
  """
  def distinctions(conn, _params) do
    json(conn, %{entries: Publication.Duplicates.ruled_apart()})
  end

  @doc """
  Removes what `distinguish/2` recorded about the publications with the ids in
  `publications`, so `duplicates/2` can report them together again. Naming
  fewer than two is a 400 with `not_enough`.
  """
  def reconsider(conn, %{"publications" => ids = [_, _ | _]}) do
    with {:ok, _count} <- Publication.Duplicates.reconsider(ids, actor(conn)) do
      send_resp(conn, :no_content, "")
    end
  end

  def reconsider(_conn, _params), do: {:error, :not_enough}

  @doc """
  Merges the publications with the ids in `losers` into the publication `id`,
  and responds with the merged publication, flattened. See
  `Publication.merge/3`.

  Merging a publication into itself, or naming no losers, is a 400, rather
  than the 409 that `self` is elsewhere. A merged publication with the
  composite key of another publication is a 409 with `error: "conflict"`.
  """
  def merge(conn, %{"id" => id, "losers" => losers}) when is_list(losers) do
    with {:ok, id} <- Params.id(id),
         {:ok, publication} <- Publication.merge(id, losers, actor(conn)) do
      json(conn, Publication.Codec.flatten(publication))
    else
      {:error, reason} when reason in [:self, :no_losers] -> {:error, :bad_request, reason}
      error -> error
    end
  end

  def merge(_conn, _params), do: {:error, :losers_required}

  @doc "Deletes the publication `id`. See `Publication.delete/2`."
  def delete(conn, %{"id" => id}) do
    with {:ok, id} <- Params.id(id),
         {:ok, _publication} <- Publication.delete(id, actor(conn)) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Responds with `entries`, the history entries of the publication `id`, or of
  every publication when there is no `id`, newest first.
  """
  def history(conn, %{"id" => id}) do
    with {:ok, id} <- Params.id(id) do
      json(conn, %{entries: id |> Publication.History.of() |> Enum.map(&serialize_history/1)})
    end
  end

  def history(conn, _params) do
    json(conn, %{entries: Publication.History.all() |> Enum.map(&serialize_history/1)})
  end

  @doc """
  Undoes the history entry `version` of the publication `id`. See
  `Publication.undo/3`, which decides whether the entry can still be undone and
  how. An entry that cannot be undone is a 409 with `error: "conflict"`.
  """
  def undo(conn, %{"id" => id, "version" => version}) do
    with {:ok, id} <- Params.id(id),
         {:ok, version} <- Params.id(version),
         {:ok, _publication} <- Publication.undo(id, version, actor(conn)) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Responds with `entries`, the publications that are deleted now, each with
  its `deleted_at`, newest deletion first. A publication that was deleted,
  restored and deleted again is listed once. See `Publication.all_deleted/0`.
  """
  def index_deleted(conn, _params) do
    entries =
      Enum.map(
        Publication.all_deleted(),
        &%{publication: Publication.Codec.flatten(&1), deleted_at: &1.deleted_at}
      )

    json(conn, %{entries: entries})
  end

  @doc """
  Restores the deleted publication `id`. A body with the publication's fields
  is applied to it first, as an edit, so that a restore that would conflict can
  be made with changes.

  When another publication that is not deleted has the same composite key, the
  response is a 409 with `error: "conflict"` and that publication. A
  publication that a merge absorbed is a 409 with `error: "absorbed"`, because
  only undoing the merge brings it back.
  """
  def restore(conn, params = %{"id" => id}) do
    changes =
      case Map.delete(params, "id") do
        empty when map_size(empty) == 0 -> nil
        fields -> Publication.Codec.nest(fields)
      end

    with {:ok, id} <- Params.id(id),
         {:ok, _publication} <- Publication.restore(id, actor(conn), changes) do
      send_resp(conn, :no_content, "")
    else
      {:error, {:conflict, twin}} -> conflict(conn, twin)
      error -> error
    end
  end

  # Responds with a 409 whose body holds `error: "conflict"` and `publication`,
  # the publication a write collides with, flattened.
  defp conflict(conn, publication) do
    conn
    |> put_status(:conflict)
    |> json(%{error: :conflict, publication: Publication.Codec.flatten(publication)})
  end

  # Returns a history entry as a map for a response. Besides the entry's own
  # fields, it holds `absorbed`, the publications a merge took in or an undone
  # merge gave back, and `related`, the other publications a duplicate decision
  # is about.
  defp serialize_history(entry) do
    %{
      publication_id: entry.publication_id,
      version: entry.version,
      action: entry.action,
      actor: entry.actor,
      snapshot: entry.snapshot,
      diff: entry.diff,
      undoable: entry.undoable,
      absorbed: Publication.History.absorbed_records(entry),
      related: Publication.History.related_records(entry),
      timestamp: entry.inserted_at
    }
  end

  @doc """
  Validates publications without writing them, and responds with each one and
  its `errors`, which are nil when it is valid.

  The publications come from the CSV file uploaded as `csv`, or from a list in
  the request body. A CSV file that cannot be read is a 400 whose `error` names
  the reason, such as `invalid_escape_sequence`.

  With an `id`, the request body is one publication, validated as an edit of
  the publication `id`, so that its own composite key is not a conflict.
  """
  def validate(conn, %{"csv" => %Plug.Upload{path: path}}) do
    with {:ok, publications} <- Publication.Codec.from_csv(path) do
      json(conn, validate_publications(publications))
    end
  end

  def validate(conn, %{"_json" => publications}) do
    json(conn, validate_publications(publications))
  end

  def validate(conn, params = %{"id" => id}) do
    with {:ok, id} <- Params.id(id) do
      publication = Map.delete(params, "id")
      json(conn, reported(FlatPublication.validate(publication, id), publication))
    end
  end

  # Validates `publications` without writing them, and returns each one with
  # its errors, or nil errors when it is valid.
  defp validate_publications(publications) do
    publications
    |> FlatPublication.validate_all()
    |> Enum.zip_with(publications, &reported/2)
  end

  # Returns a validation result as a map with the publication it is for.
  defp reported(:ok, publication), do: %{publication: publication, errors: nil}
  defp reported({:error, errors}, publication), do: %{publication: publication, errors: errors}
end
