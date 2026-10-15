defmodule RichardBurtonWeb.PublicationControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.PublicationController`: the index and its pages,
  one publication, the export, validation, the writes, the history and the
  duplicate review.
  """
  use RichardBurtonWeb.ConnCase
  # Arity 4 takes a second path segment, the history version an undo names.
  import Routes, only: [publication_path: 2, publication_path: 3, publication_path: 4]

  alias RichardBurton.Country
  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo

  # Most routes here need an admin. The writes also record the signed-in admin
  # in the history.
  @moduletag role: :admin

  # Isabel Burton's translation of Iracema, published by Bickers & Son in Great
  # Britain in 1886, as a flat publication with atom keys and the year given
  # as a string.
  @iracema %{
    title: "Iraçéma the Honey-Lips: A Legend of Brazil",
    year: "1886",
    countries: ["GB"],
    publishers: ["Bickers & Son"],
    authors: ["Isabel Burton"],
    original_authors: ["José de Alencar"],
    original_title: "Iracema"
  }

  describe "GET /publications when there are no publications" do
    @tag role: :reader
    test "does not require authentication", %{conn: conn} do
      expect_auth_verify(0)
      assert get(conn, publication_path(conn, :index)).status == 200
    end

    test "returns rb-total-count header with value 0", %{conn: conn} do
      assert ["0"] ==
               conn
               |> get(publication_path(conn, :index))
               |> Plug.Conn.get_resp_header("rb-total-count")
    end
  end

  describe "GET /publications (paged)" do
    setup %{conn: conn} do
      seed_index(
        for i <- 1..7, do: %{@iracema | title: "Paged #{String.pad_leading("#{i}", 2, "0")}"}
      )

      [conn: conn, per_page: Publication.Index.per_page()]
    end

    test "hands back the whole ordering and the first page of it", meta do
      body =
        meta.conn
        |> get(publication_path(meta.conn, :index))
        |> json_response(200)

      assert length(body["order"]) == 7
      assert body["per_page"] == meta.per_page
      assert length(body["entries"]) == meta.per_page
      # The first page is the head of the ordering, in that order.
      assert Enum.map(body["entries"], & &1["id"]) == Enum.take(body["order"], meta.per_page)
    end

    test "a later stretch is fetched by id, just the rows, in the order asked", meta do
      order =
        meta.conn
        |> get(publication_path(meta.conn, :index))
        |> json_response(200)
        |> Map.get("order")

      rest = Enum.drop(order, meta.per_page)
      ids_query = Enum.map_join(rest, "&", &"ids[]=#{&1}")

      body =
        meta.conn
        |> get("#{publication_path(meta.conn, :index)}?#{ids_query}")
        |> json_response(200)

      assert Enum.map(body["entries"], & &1["id"]) == rest
      # A later page holds the rows alone, without the order.
      refute Map.has_key?(body, "order")
    end

    test "a search nothing answers is an empty page, not an error", meta do
      body =
        meta.conn
        |> get("#{publication_path(meta.conn, :index)}?search=zzzznomatchqqq")
        |> json_response(200)

      assert body["entries"] == []
      assert body["order"] == []
    end

    test "a search looks each of its words up once, for the first page and for a later one",
         meta do
      search = "Pagd+Isabl+Burton+title:Paged+-autor:Machadoo"

      {body, lookups} =
        counting_keyword_lookups(fn ->
          meta.conn
          |> get("#{publication_path(meta.conn, :index)}?search=#{search}")
          |> json_response(200)
        end)

      assert lookups == 1
      assert length(body["order"]) == 7
      assert Enum.all?(body["entries"], &(&1["excerpts"]["title"] =~ "[["))
      assert Enum.any?(body["matched"], &(&1["typed"] == "Pagd"))

      ids_query = body["order"] |> Enum.drop(meta.per_page) |> Enum.map_join("&", &"ids[]=#{&1}")

      {page, lookups} =
        counting_keyword_lookups(fn ->
          meta.conn
          |> get("#{publication_path(meta.conn, :index)}?#{ids_query}&search=#{search}")
          |> json_response(200)
        end)

      assert lookups == 1
      assert length(page["entries"]) == 7 - meta.per_page
    end

    test "a blank search asks for the whole database, not for nothing", meta do
      whole = meta.conn |> get(publication_path(meta.conn, :index)) |> json_response(200)

      for blank <- ["", "%20%20"] do
        body =
          meta.conn
          |> get("#{publication_path(meta.conn, :index)}?search=#{blank}")
          |> json_response(200)

        assert body["order"] == whole["order"]
        assert body["matched"] == nil
      end
    end
  end

  describe "GET /publications/:id" do
    setup(%{conn: conn}) do
      [conn: conn, publication: publication_fixture(@iracema)]
    end

    @tag role: :reader
    test "returns one publication, flat, without authentication", meta do
      expect_auth_verify(0)

      conn = get(meta.conn, publication_path(meta.conn, :show, meta.publication.id))

      assert %{"title" => title, "authors" => authors, "id" => id} =
               json_response(conn, 200)

      assert title == @iracema.title
      assert authors == @iracema.authors
      assert id == meta.publication.id
    end

    test "marks the source a search matched, and only that one", meta do
      publication =
        publication_fixture(%{
          sources: [
            "Caldwell, Helen. Machado de Assis. Berkeley: California, 1970.",
            "Gledson, John. The Deceptive Realism. Liverpool: Cairns, 1984."
          ]
        })

      body =
        meta.conn
        |> get("#{publication_path(meta.conn, :show, publication.id)}?search=berkeley")
        |> json_response(200)

      assert [marked, unmatched] = body["marked"]["sources"]
      assert marked =~ "[[Berkeley]]"
      # The whole source is marked, not an excerpt of it.
      assert marked =~ "Caldwell, Helen."
      assert unmatched == nil
    end

    test "reports the country a search matched, by code", meta do
      body =
        meta.conn
        |> get("#{publication_path(meta.conn, :show, meta.publication.id)}?search=Reino+Unido")
        |> json_response(200)

      assert body["marked"]["countries"] == ["GB"]
    end

    test "reports no countries when the search did not name one", meta do
      body =
        meta.conn
        |> get("#{publication_path(meta.conn, :show, meta.publication.id)}?search=Iracema")
        |> json_response(200)

      assert body["marked"]["countries"] == [nil]
    end

    test "reports no countries at all when nothing was searched", meta do
      body =
        meta.conn
        |> get(publication_path(meta.conn, :show, meta.publication.id))
        |> json_response(200)

      assert body["marked"] == nil
    end

    test "returns 404 for a publication that never existed", meta do
      conn = get(meta.conn, publication_path(meta.conn, :show, -1))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "returns 404 for an id that is not a number", meta do
      conn = get(meta.conn, publication_path(meta.conn, :show, "abc"))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "a deleted publication reads as missing, not merely hidden", meta do
      delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))

      # A deleted publication is missing from this read, as it is from the
      # index and the search.
      conn = get(meta.conn, publication_path(meta.conn, :show, meta.publication.id))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "GET /publications?unsourced" do
    test "returns only publications that have no sources", %{conn: conn} do
      with_refs = publication_fixture(@iracema)

      {:ok, _} =
        Publication.update(
          with_refs.id,
          publication_attrs(Map.put(@iracema, :sources, ["A source"]))
        )

      publication_fixture(%{@iracema | title: "Unsourced Title"})

      entries =
        conn
        |> get("#{publication_path(conn, :index)}?unsourced")
        |> json_response(200)
        |> Map.get("entries")

      titles = Enum.map(entries, & &1["title"])
      assert "Unsourced Title" in titles
      refute @iracema.title in titles
    end
  end

  describe "CSRF protection on admin mutations" do
    test "rejects a POST without a CSRF token", %{conn: conn} do
      conn =
        conn
        |> delete_req_header("rb-csrf-token")
        |> post(publication_path(conn, :create_all), %{"_json" => []})

      assert %{"error" => "invalid_csrf"} == json_response(conn, 403)
    end

    test "rejects a POST whose CSRF token is for a different subject", %{conn: conn} do
      conn =
        conn
        |> put_req_header("rb-csrf-token", RichardBurton.Auth.Csrf.sign("99999"))
        |> post(publication_path(conn, :create_all), %{"_json" => []})

      assert %{"error" => "invalid_csrf"} == json_response(conn, 403)
    end

    test "rejects a DELETE without a CSRF token", %{conn: conn} do
      conn =
        conn
        |> delete_req_header("rb-csrf-token")
        |> delete(publication_path(conn, :delete, 1))

      assert %{"error" => "invalid_csrf"} == json_response(conn, 403)
    end
  end

  describe "an id that is not a number" do
    test "is not found by any write", %{conn: conn} do
      for conn <- [
            put(conn, "/api/publications/abc", @iracema),
            delete(conn, "/api/publications/abc"),
            post(conn, "/api/publications/abc/merge", %{"losers" => [1]}),
            post(conn, "/api/publications/abc/restore"),
            post(conn, "/api/publications/1/history/abc/undo")
          ] do
        assert json_response(conn, 404) == %{"error" => "not_found"}
      end
    end
  end

  describe "DELETE /publications/:id" do
    setup(%{conn: conn}) do
      [conn: conn, publication: publication_fixture()]
    end

    test "soft-deletes the publication and returns 204", meta do
      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert response(conn, 204)

      # It is gone from the index.
      conn = get(build_conn(), publication_path(conn, :index))
      assert %{"entries" => []} = json_response(conn, 200)
    end

    test "records the acting admin in the publication's history", meta do
      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert response(conn, 204)

      assert [%{action: "deleted", actor: actor}, _created] =
               RichardBurton.Publication.History.of(meta.publication.id)

      assert actor == session_user_email()
    end

    test "returns 404 for a missing publication", meta do
      conn = delete(meta.conn, publication_path(meta.conn, :delete, -1))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "returns 404 for an already-deleted publication", meta do
      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert response(conn, 204)

      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "GET /publications/:id/history" do
    setup(%{conn: conn}) do
      {:ok, publication} =
        @iracema |> publication_attrs() |> Publication.insert("importer@example.com")

      [conn: conn, publication: publication]
    end

    test "returns 404 for an id that is not a number", meta do
      conn = get(meta.conn, publication_path(meta.conn, :history, "abc"))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "returns the ordered mutation stream with actors and snapshots", meta do
      attrs = %{@iracema | title: "Iracema, revised"}

      conn =
        put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), attrs)

      assert response(conn, 200)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.publication.id))

      # The entries are newest first.
      assert %{"entries" => [updated, created]} = json_response(conn, 200)
      assert %{"version" => 1, "action" => "created", "actor" => "importer@example.com"} = created
      assert %{"version" => 2, "action" => "updated"} = updated
      assert updated["actor"] == session_user_email()
      assert created["snapshot"]["title"] =~ "Honey-Lips"
      assert updated["snapshot"]["title"] == "Iracema, revised"
      assert %{"timestamp" => _} = updated
    end

    test "reports whether each entry can still be undone", meta do
      attrs = %{@iracema | title: "Iracema, revised"}
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), attrs)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.publication.id))

      # Whether an entry can be undone depends on the whole history, so the
      # response says so for each entry.
      assert %{"entries" => [%{"undoable" => true}, %{"undoable" => false}]} =
               json_response(conn, 200)
    end

    test "returns no entries for an unknown publication", meta do
      conn = get(meta.conn, publication_path(meta.conn, :history, 999_999))

      assert %{"entries" => []} = json_response(conn, 200)
    end
  end

  describe "GET /publications/history (database-wide)" do
    test "returns every recorded change, newest first, tagged with its publication", %{
      conn: conn
    } do
      {:ok, first} = @iracema |> publication_attrs() |> Publication.insert("a@example.com")

      {:ok, _second} =
        %{@iracema | title: "Iracema, again"}
        |> publication_attrs()
        |> Publication.insert("b@example.com")

      conn = get(conn, publication_path(conn, :history))

      assert %{"entries" => [newest, oldest]} = json_response(conn, 200)
      assert %{"action" => "created", "actor" => "b@example.com"} = newest
      assert oldest["publication_id"] == first.id
      assert oldest["snapshot"]["title"] =~ "Honey-Lips"
    end
  end

  describe "POST /publications/:id/history/:version/undo" do
    setup(%{conn: conn}) do
      [conn: conn, publication: publication_fixture(@iracema)]
    end

    defp undo_path(conn, publication, version) do
      publication_path(conn, :undo, publication.id, version)
    end

    test "undoes a recorded change and records the undo as its own entry", meta do
      attrs = %{@iracema | title: "Iracema, revised"}
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), attrs)

      conn = post(meta.conn, undo_path(meta.conn, meta.publication, 2))
      assert response(conn, 204)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.publication.id))
      assert %{"entries" => entries} = json_response(conn, 200)

      # The undo is a new entry. The update it undid stays in the history.
      assert ["updated", "updated", "created"] = Enum.map(entries, & &1["action"])
      assert hd(entries)["snapshot"]["title"] == @iracema.title
      assert hd(entries)["actor"] == session_user_email()
    end

    test "refuses an entry that is no longer reconcilable", meta do
      first = %{@iracema | title: "First"}
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), first)

      second = %{@iracema | title: "Second"}
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), second)

      # Undoing the first title change would discard the second one.
      conn = post(meta.conn, undo_path(meta.conn, meta.publication, 2))
      assert json_response(conn, 409) == %{"error" => "conflict"}
    end

    test "returns 404 for a version that was never recorded", meta do
      conn = post(meta.conn, undo_path(meta.conn, meta.publication, 99))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "POST /publications/:id/restore" do
    setup(%{conn: conn}) do
      publication = publication_fixture(@iracema)
      {:ok, _} = Publication.delete(publication.id)

      [conn: conn, publication: publication]
    end

    test "restores a deleted publication back into the index", meta do
      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.publication.id))
      assert response(conn, 204)

      conn = get(build_conn(), publication_path(conn, :index))
      assert %{"entries" => [entry]} = json_response(conn, 200)
      assert entry["title"] == @iracema.title
    end

    test "the trash lists what is currently deleted, and a restore empties it", meta do
      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))

      assert %{"entries" => [entry]} = json_response(conn, 200)
      assert entry["publication"]["title"] == @iracema.title
      assert is_binary(entry["deleted_at"])

      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.publication.id))
      assert response(conn, 204)

      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))
      assert %{"entries" => []} = json_response(conn, 200)
    end

    test "a deleted, restored and re-deleted record is one tombstone, not three", meta do
      {:ok, _} = Publication.restore(meta.publication.id)
      {:ok, _} = Publication.delete(meta.publication.id)

      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))
      assert %{"entries" => [_only_one]} = json_response(conn, 200)

      # The history keeps both deletions.
      conn = get(meta.conn, publication_path(meta.conn, :history))
      assert %{"entries" => entries} = json_response(conn, 200)
      assert 2 == Enum.count(entries, &(&1["action"] == "deleted"))
    end

    test "restoring is a conflict when the same record was imported again, and names it",
         meta do
      twin = publication_fixture(@iracema)

      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.publication.id))

      assert %{"error" => "conflict", "publication" => %{"id" => id, "title" => title}} =
               json_response(conn, 409)

      assert id == twin.id
      assert title == @iracema.title
    end

    test "a restore with changes applies them, so it no longer conflicts", meta do
      publication_fixture(@iracema)

      conn =
        post(
          meta.conn,
          publication_path(meta.conn, :restore, meta.publication.id),
          %{@iracema | year: "1887"}
        )

      assert response(conn, 204)

      assert %Publication{deleted_at: nil, year: 1887} =
               Repo.get(Publication, meta.publication.id)
    end

    test "restoring a live or unknown publication is not found", meta do
      conn = post(meta.conn, publication_path(meta.conn, :restore, -1))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "GET /publications/duplicates" do
    test "offers the records that look like one publication entered twice", meta do
      publication_fixture(@iracema)
      publication_fixture(%{@iracema | title: "Iraçéma the Honey-Lips"})

      assert %{"entries" => [entry], "threshold" => threshold} =
               meta.conn
               |> get(publication_path(meta.conn, :duplicates))
               |> json_response(200)

      assert is_float(threshold)
      assert 2 == length(entry["publications"])
      assert entry["score"] > threshold
    end

    test "a database with nothing alike in it has nothing to review", meta do
      publication_fixture(@iracema)

      assert %{"entries" => []} =
               meta.conn
               |> get(publication_path(meta.conn, :duplicates))
               |> json_response(200)
    end
  end

  describe "POST /publications/duplicates/resemblances" do
    test "reports the stored record a row being imported resembles", meta do
      stored = publication_fixture(@iracema)

      rows = [
        %{@iracema | title: "Iracema the Honey-Lips: A Legend of Brazil"}
      ]

      assert %{"entries" => [entry]} =
               meta.conn
               |> post(publication_path(meta.conn, :resemblances), %{"_json" => rows})
               |> json_response(200)

      assert 0 == entry["position"]
      assert [found] = entry["stored"]
      assert found["id"] == stored.id
      assert [] == entry["others"]
    end

    test "reports two rows that resemble each other and nothing stored", meta do
      rows = [
        @iracema,
        %{@iracema | title: "Iracema the Honey-Lips: A Legend of Brazil"}
      ]

      assert %{"entries" => entries} =
               meta.conn
               |> post(publication_path(meta.conn, :resemblances), %{"_json" => rows})
               |> json_response(200)

      assert [
               %{"position" => 0, "others" => [1], "stored" => []},
               %{"position" => 1, "others" => [0], "stored" => []}
             ] = entries
    end

    test "reports a row that repeats an earlier row's key", meta do
      assert %{"entries" => entries} =
               meta.conn
               |> post(publication_path(meta.conn, :resemblances), %{
                 "_json" => [@iracema, @iracema]
               })
               |> json_response(200)

      assert [%{"repeats" => nil}, %{"repeats" => 0}] = entries
    end

    test "a row unlike anything is not reported at all", meta do
      publication_fixture(@iracema)

      rows = [
        %{
          @iracema
          | title: "Dom Casmurro",
            authors: ["Helen Caldwell"],
            original_title: "Dom Casmurro",
            original_authors: ["Machado de Assis"]
        }
      ]

      assert %{"entries" => []} =
               meta.conn
               |> post(publication_path(meta.conn, :resemblances), %{"_json" => rows})
               |> json_response(200)
    end
  end

  describe "POST /publications/duplicates/distinguish" do
    test "remembers the records ruled apart, so they are not offered again", meta do
      one = publication_fixture(@iracema)
      other = publication_fixture(%{@iracema | title: "Iraçéma the Honey-Lips"})

      conn =
        post(meta.conn, publication_path(meta.conn, :distinguish), %{
          "publications" => [one.id, other.id]
        })

      assert response(conn, 204)

      assert %{"entries" => []} =
               meta.conn
               |> get(publication_path(meta.conn, :duplicates))
               |> json_response(200)

      # Ruling the same pair apart again succeeds and changes nothing.
      conn =
        post(meta.conn, publication_path(meta.conn, :distinguish), %{
          "publications" => [other.id, one.id]
        })

      assert response(conn, 204)
    end

    test "naming fewer than two is nothing to rule apart", meta do
      one = publication_fixture(@iracema)

      conn =
        post(meta.conn, publication_path(meta.conn, :distinguish), %{
          "publications" => [one.id]
        })

      assert json_response(conn, 400) == %{"error" => "not_enough"}

      conn = post(meta.conn, publication_path(meta.conn, :distinguish), %{})
      assert json_response(conn, 400) == %{"error" => "not_enough"}
    end

    test "records the decision in both histories, naming the other record, and so does taking it back",
         meta do
      one = publication_fixture(@iracema)
      other = publication_fixture(%{@iracema | title: "Iraçéma the Honey-Lips"})

      meta.conn
      |> post(publication_path(meta.conn, :distinguish), %{"publications" => [one.id, other.id]})
      |> response(204)

      assert %{"entries" => [decision | _]} =
               meta.conn
               |> get(publication_path(meta.conn, :history, one.id))
               |> json_response(200)

      assert %{
               "action" => "distinguished",
               "actor" => actor,
               "undoable" => false,
               "related" => [%{"id" => other_id, "title" => "Iraçéma the Honey-Lips"}]
             } = decision

      assert {actor, other_id} == {session_user_email(), other.id}

      meta.conn
      |> post(publication_path(meta.conn, :reconsider), %{"publications" => [one.id, other.id]})
      |> response(204)

      one_id = one.id

      assert %{
               "entries" => [%{"action" => "reconsidered", "related" => [%{"id" => ^one_id}]} | _]
             } =
               meta.conn
               |> get(publication_path(meta.conn, :history, other.id))
               |> json_response(200)
    end
  end

  describe "POST /publications/:id/merge" do
    setup do
      winner = publication_fixture(@iracema)
      loser = publication_fixture(%{@iracema | countries: ["US"], publishers: ["Noonday Press"]})

      [winner: winner, loser: loser]
    end

    test "collapses the losers into the addressed publication", meta do
      result =
        meta.conn
        |> post(publication_path(meta.conn, :merge, meta.winner.id), %{
          "losers" => [meta.loser.id]
        })
        |> json_response(200)

      assert result["id"] == meta.winner.id
      assert result["countries"] == ["GB", "US"]
      assert result["publishers"] == ["Bickers & Son", "Noonday Press"]

      # Only the survivor is left in the index.
      conn = get(build_conn(), publication_path(meta.conn, :index))
      assert %{"entries" => [entry]} = json_response(conn, 200)
      assert entry["id"] == meta.winner.id
    end

    test "records the merge as one entry, on the record that survived it", meta do
      meta.conn
      |> post(publication_path(meta.conn, :merge, meta.winner.id), %{"losers" => [meta.loser.id]})
      |> json_response(200)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.winner.id))
      assert %{"entries" => [entry | _]} = json_response(conn, 200)
      assert entry["action"] == "merged"
      assert entry["actor"] == session_user_email()
      # The merge is one entry that can be undone, and it holds the whole
      # publication it took in.
      assert entry["undoable"]
      assert [absorbed] = entry["absorbed"]
      assert absorbed["id"] == meta.loser.id
      assert absorbed["title"] == meta.loser.title
      refute Map.has_key?(absorbed, "countries_fingerprint")
    end

    test "merging a publication into itself is a bad request", meta do
      conn =
        post(meta.conn, publication_path(meta.conn, :merge, meta.winner.id), %{
          "losers" => [meta.winner.id]
        })

      assert json_response(conn, 400) == %{"error" => "self"}
    end

    test "merging an unknown publication is not found", meta do
      conn =
        post(meta.conn, publication_path(meta.conn, :merge, -1), %{"losers" => [meta.loser.id]})

      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "naming no losers is a bad request", meta do
      conn = post(meta.conn, publication_path(meta.conn, :merge, meta.winner.id), %{})
      assert json_response(conn, 400) == %{"error" => "losers_required"}
    end

    test "a record it took in cannot be restored out of it", meta do
      meta.conn
      |> post(publication_path(meta.conn, :merge, meta.winner.id), %{
        "losers" => [meta.loser.id]
      })
      |> json_response(200)

      # The absorbed publication is not listed as deleted, and restoring it is
      # refused, because it comes back only by undoing the merge.
      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))
      assert %{"entries" => []} = json_response(conn, 200)

      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.loser.id))
      assert json_response(conn, 409) == %{"error" => "absorbed"}
    end
  end

  describe "POST /publications/bulk" do
    test "returns 201 and the created publications when all the publications are valid", meta do
      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB"],
          "year" => 1886,
          "publishers" => ["Bickers & Son"],
          "authors" => ["Richard Burton", "Isabel Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      # The response lists each publication's names sorted, as they are stored.
      [manuel_de_moraes, iracema] = publications

      assert [%{manuel_de_moraes | "authors" => ["Isabel Burton", "Richard Burton"]}, iracema] ==
               Enum.map(
                 result,
                 &Map.drop(&1, [
                   "id",
                   "sources",
                   "excerpts",
                   "marked"
                 ])
               )
    end

    test "bulk-inserts publications with their sources", meta do
      input = %{
        "_json" => [
          Map.put(@iracema, :sources, ["First source", "Second source"])
        ]
      }

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      assert [%{"sources" => ["First source", "Second source"]}] = result
      assert [%{sources: ["First source", "Second source"]}] = Repo.all(FlatPublication)
    end

    test "returns 201 and inserts publications with several countries", meta do
      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB", "US"],
          "year" => 1886,
          "publishers" => ["Bickers & Son"],
          "authors" => ["Richard Burton", "Isabel Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => ["GB", "US"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        },
        %{
          "authors" => ["Isabel Burton", "Richard Burton"],
          "countries" => ["GB", "BR", "US"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "publishers" => ["Bickers & Son"],
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      output = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB", "US"],
          "year" => 1886,
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton", "Richard Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => ["GB", "US"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        },
        %{
          "authors" => ["Isabel Burton", "Richard Burton"],
          "countries" => ["BR", "GB", "US"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "publishers" => ["Bickers & Son"],
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886
        }
      ]

      assert 3 == Repo.all(FlatPublication) |> length()

      assert ["BR", "GB", "US"] == Country |> Repo.all() |> Enum.map(& &1.code) |> Enum.sort()

      assert output ==
               Enum.map(
                 result,
                 &Map.drop(&1, [
                   "id",
                   "sources",
                   "excerpts",
                   "marked"
                 ])
               )
    end

    test "returns 201 and inserts publications with several publishers", meta do
      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB"],
          "year" => 1886,
          "publishers" => ["Bickers & Son", "Noonday Press"],
          "authors" => ["Richard Burton", "Isabel Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son", "Noonday Press"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        },
        %{
          "authors" => ["Isabel Burton", "Richard Burton"],
          "countries" => ["GB"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "publishers" => ["Bickers & Son", "Noonday Press", "Ronald Massey"],
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      output = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB"],
          "year" => 1886,
          "publishers" => ["Bickers & Son", "Noonday Press"],
          "authors" => ["Isabel Burton", "Richard Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son", "Noonday Press"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        },
        %{
          "authors" => ["Isabel Burton", "Richard Burton"],
          "countries" => ["GB"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "publishers" => ["Bickers & Son", "Noonday Press", "Ronald Massey"],
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886
        }
      ]

      publishers = ["Bickers & Son", "Noonday Press", "Ronald Massey"]

      assert 3 == Repo.all(FlatPublication) |> length()
      assert publishers == Publisher |> Repo.all() |> Enum.map(& &1.name)

      assert output ==
               Enum.map(
                 result,
                 &Map.drop(&1, [
                   "id",
                   "sources",
                   "excerpts",
                   "marked"
                 ])
               )
    end

    test "returns 409 when publications are repeated, and names the first repeated one", meta do
      repeated_publication = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => 1886,
        "countries" => ["GB"],
        "publishers" => ["Bickers & Son"],
        "authors" => ["Isabel Burton"],
        "original_authors" => ["José de Alencar"],
        "original_title" => "Iracema"
      }

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB"],
          "year" => 1886,
          "publishers" => ["Bickers & Son"],
          "authors" => ["Richard Burton", "Isabel Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        repeated_publication,
        repeated_publication
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(409)

      assert %{"error" => "conflict", "publication" => repeated_publication} == result
      assert [] == Repo.all(FlatPublication)
    end

    test "returns 400 when a publication is invalid, and returns it with its errors", meta do
      invalid_publication = %{
        "title" => "",
        "year" => 1886,
        "countries" => ["GB"],
        "publishers" => ["Bickers & Son"],
        "authors" => [],
        "original_authors" => ["José de Alencar"],
        "original_title" => "Iracema"
      }

      invalid_publication_errors = %{
        "title" => "required",
        "authors" => "required"
      }

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => ["GB"],
          "year" => 1886,
          "publishers" => ["Bickers & Son"],
          "authors" => ["Richard Burton", "Isabel Burton"],
          "original_authors" => ["J. M. Pereira da Silva"],
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        invalid_publication,
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        }
      ]

      input = %{"_json" => publications}

      output = %{
        "error" => "invalid",
        "publication" => invalid_publication,
        "errors" => invalid_publication_errors
      }

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(400)

      assert output == result
    end
  end

  describe "POST /publications/validate when sending valid json" do
    @correct_input_1 %{
      "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
      "year" => "1886",
      "countries" => ["GB"],
      "publishers" => ["Bickers & Son"],
      "authors" => ["Isabel Burton", "Richard Burton"],
      "original_authors" => ["José de Alencar"],
      "original_title" => "Iracema"
    }
    @correct_input_2 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "1922",
      "countries" => ["US"],
      "publishers" => ["Ronald Massey"],
      "authors" => ["J. T. W. Sadler"],
      "original_authors" => ["José de Alencar"],
      "original_title" => "Ubirajara"
    }
    @correct_input_3 %{
      "title" => "",
      "year" => "AAAA",
      "countries" => ["GB"],
      "publishers" => ["Bickers & Son"],
      "authors" => [],
      "original_authors" => ["José de Alencar"],
      "original_title" => "Iracema"
    }
    @correct_input_4 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => [],
      "publishers" => [],
      "authors" => ["J. T. W. Sadler"],
      "original_authors" => [],
      "original_title" => ""
    }
    @correct_input_5 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => ["Narnia"],
      "publishers" => [],
      "authors" => ["J. T. W. Sadler"],
      "original_authors" => [],
      "original_title" => ""
    }

    @input [
      @correct_input_1,
      @correct_input_2,
      @correct_input_3,
      @correct_input_4,
      @correct_input_5
    ]

    @output [
      %{
        "publication" => @correct_input_1,
        "errors" => nil
      },
      %{
        "publication" => @correct_input_2,
        "errors" => nil
      },
      %{
        "publication" => @correct_input_3,
        "errors" => %{
          "year" => "integer",
          "title" => "required",
          "authors" => "required"
        }
      },
      %{
        "publication" => @correct_input_4,
        "errors" => %{
          "year" => "required",
          "countries" => "required",
          "publishers" => "required",
          "original_authors" => "required",
          "original_title" => "required"
        }
      },
      %{
        "publication" => @correct_input_5,
        "errors" => %{
          "year" => "required",
          "countries" => "alpha2",
          "publishers" => "required",
          "original_authors" => "required",
          "original_title" => "required"
        }
      }
    ]

    test "returns 200 a list of maps with the publications an their corresponding errors", meta do
      assert @output ==
               meta.conn
               |> post(publication_path(meta.conn, :validate), %{"_json" => @input})
               |> json_response(200)
    end
  end

  describe "POST /publications/validate when sending correct csv" do
    @output [
      %{
        "publication" => %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886",
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton", "Richard Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "sources" => []
        },
        "errors" => nil
      },
      %{
        "publication" => %{
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "1922",
          "countries" => ["US", "GB"],
          "publishers" => ["Ronald Massey"],
          "authors" => ["J. T. W. Sadler"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Ubirajara",
          "sources" => []
        },
        "errors" => nil
      },
      %{
        "publication" => %{
          "title" => "",
          "year" => "AAAA",
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son"],
          "authors" => [],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "sources" => []
        },
        "errors" => %{
          "year" => "integer",
          "title" => "required",
          "authors" => "required"
        }
      }
    ]

    test "returns 200 and a list of maps with parsed publications and their corresponding errors",
         meta do
      input = uploaded_csv_fixture("test/fixtures/data_correct_with_errors.csv")

      assert @output ==
               meta.conn
               |> post(publication_path(meta.conn, :validate), input)
               |> json_response(200)
    end
  end

  describe "POST /publications/validate when sending incorrect csv" do
    test "on invalid escape sequence, returns 400 naming the reason", meta do
      input = uploaded_csv_fixture("test/fixtures/data_incorrect_escape_sequence.csv")

      response =
        meta.conn
        |> post(publication_path(meta.conn, :validate), input)
        |> json_response(400)

      assert %{"error" => "invalid_escape_sequence"} == response
    end
  end

  describe "GET /files/publications without search and select params" do
    test "returns 200 and a csv attachment with all the publications", meta do
      publication_fixture(@iracema)

      conn = get(meta.conn, publication_path(meta.conn, :export))

      expected_data =
        "authors,countries,original_authors,original_title,publishers,sources,title,year\nIsabel Burton,GB,José de Alencar,Iracema,Bickers & Son,,Iraçéma the Honey-Lips: A Legend of Brazil,1886\n"

      expected_filename = "publications.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end

    test "joins a publication's sources into the sources cell", meta do
      publication = publication_fixture(@iracema)

      # Adds sources to the publication, then exports it.
      {:ok, _} =
        Publication.update(
          publication.id,
          publication_attrs(Map.put(@iracema, :sources, ["First source", "Second source"]))
        )

      conn = get(meta.conn, publication_path(meta.conn, :export))

      # One source per line inside a single quoted cell (CSV quotes the newline).
      assert response(conn, 200) =~ "\"First source\nSecond source\""
    end

    test "imports a newline-per-line sources cell back into a list", meta do
      input = uploaded_csv_fixture("test/fixtures/data_with_sources.csv")

      [first | _] =
        meta.conn
        |> post(publication_path(meta.conn, :validate), input)
        |> json_response(200)

      assert ["First source", "Second source"] == first["publication"]["sources"]
    end
  end

  describe "GET /files/publications with search param and without select param" do
    test "returns 200 and a csv attachment with the requested attributes of all the matching publications",
         meta do
      seed_index([@iracema, %{@iracema | title: "bla"}])

      search = "Honey"

      path = "#{publication_path(meta.conn, :export)}?search=#{search}"

      conn = get(meta.conn, path)

      expected_data =
        "authors,countries,original_authors,original_title,publishers,sources,title,year\nIsabel Burton,GB,José de Alencar,Iracema,Bickers & Son,,Iraçéma the Honey-Lips: A Legend of Brazil,1886\n"

      expected_filename = "publications-#{search}.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "GET /files/publications with search param and with select param" do
    test "returns 200 and a csv attachment with all the matching publications", meta do
      seed_index([@iracema, %{@iracema | title: "bla"}])

      search = "Honey"
      attributes = [:title, :original_title, :authors]
      select = Enum.map_join(attributes, "&", &"select[]=#{&1}")

      path = "#{publication_path(meta.conn, :export)}?search=#{search}&#{select}"

      conn = get(meta.conn, path)

      expected_data =
        "authors,original_title,title\nIsabel Burton,Iracema,Iraçéma the Honey-Lips: A Legend of Brazil\n"

      expected_filename = "publications-#{search}-#{Enum.join(attributes, "-")}.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "GET /files/publications without search param and with select param" do
    test "returns 200 and a csv attachment with the requested attributes of all the publications",
         meta do
      publication_fixture(@iracema)

      attributes = [:title, :original_title, :authors]
      select = Enum.map_join(attributes, "&", &"select[]=#{&1}")

      path = "#{publication_path(meta.conn, :export)}?#{select}"

      conn = get(meta.conn, path)

      expected_data =
        "authors,original_title,title\nIsabel Burton,Iracema,Iraçéma the Honey-Lips: A Legend of Brazil\n"

      expected_filename = "publications-#{Enum.join(attributes, "-")}.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "PUT /publications/:id" do
    test "updates a publication and returns the flattened result", meta do
      publication = publication_fixture(@iracema)

      attrs = %{@iracema | title: "A New Title"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["id"] == publication.id
      assert result["title"] == "A New Title"
      # The change is stored, and the flat publications show it.
      assert ["A New Title"] == Repo.all(FlatPublication) |> Enum.map(& &1.title)
    end

    test "edits a keyed field, changing the record's identity", meta do
      publication = publication_fixture(@iracema)

      attrs = %{@iracema | year: "1999"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["id"] == publication.id
      assert result["year"] == 1999
    end

    test "updates the translated book when the original fields change", meta do
      publication = publication_fixture(@iracema)

      attrs = %{@iracema | original_title: "Iracema (rev.)"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["original_title"] == "Iracema (rev.)"
    end

    test "returns 409 when the edit collides with another publication", meta do
      a = publication_fixture(@iracema)
      _b = publication_fixture(%{@iracema | title: "Another Title"})

      # Editing `a` to `b`'s title collides with `b`'s composite key.
      attrs = %{@iracema | title: "Another Title"}

      conn = put(meta.conn, publication_path(meta.conn, :update, a.id), attrs)
      assert json_response(conn, 409) == %{"error" => "conflict"}
    end

    test "re-saving the same data does not conflict with itself", meta do
      publication = publication_fixture(@iracema)

      conn =
        put(meta.conn, publication_path(meta.conn, :update, publication.id), @iracema)

      assert response(conn, 200)
    end

    test "returns 400 for invalid data", meta do
      publication = publication_fixture(@iracema)

      attrs = %{@iracema | title: "", original_authors: []}

      conn = put(meta.conn, publication_path(meta.conn, :update, publication.id), attrs)

      assert json_response(conn, 400) == %{
               "errors" => %{"title" => "required", "original_authors" => "required"}
             }
    end

    test "returns 404 for a missing publication", meta do
      conn = put(meta.conn, publication_path(meta.conn, :update, 999_999), @iracema)
      assert response(conn, 404)
    end

    test "sets the publication's sources from the flat payload", meta do
      publication = publication_fixture(@iracema)

      attrs = Map.put(@iracema, :sources, ["First source", "Second source"])

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      # The sources are stored as rows of their own, and come back as the same
      # list, in order, in the response and in the flat publications.
      assert result["sources"] == ["First source", "Second source"]

      assert [%{sources: ["First source", "Second source"]}] = Repo.all(FlatPublication)
    end
  end

  describe "POST /publications/:id/validate" do
    test "does not report the row being edited as a conflict", meta do
      publication = publication_fixture(@iracema)

      result =
        meta.conn
        |> post(publication_path(meta.conn, :validate, publication.id), @iracema)
        |> json_response(200)

      assert result["errors"] == nil
    end

    test "reports a conflict against a different publication", meta do
      _a = publication_fixture(@iracema)
      b = publication_fixture(%{@iracema | title: "Another Title"})

      # Validating `b` against `a`'s data conflicts with `a`.
      result =
        meta.conn
        |> post(publication_path(meta.conn, :validate, b.id), @iracema)
        |> json_response(200)

      assert result["errors"] == "conflict"
    end

    test "answers 404 for an id that is not a number", meta do
      meta.conn
      |> post("/api/publications/abc/validate", @iracema)
      |> json_response(404)
    end
  end
end
