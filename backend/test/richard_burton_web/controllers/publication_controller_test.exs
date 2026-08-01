defmodule RichardBurtonWeb.PublicationControllerTest do
  @moduledoc """
  Tests for the Publication controller
  """
  alias RichardBurton.FlatPublication
  use RichardBurtonWeb.ConnCase
  # Arity 4 carries a second path segment — the history version an undo names.
  import Routes, only: [publication_path: 2, publication_path: 3, publication_path: 4]

  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Reference

  # Admin mutations resolve the acting user for the history log.
  setup do
    create_session_user()
    :ok
  end

  @publication_attrs %{
    "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
    "year" => "1886",
    "countries" => "GB",
    "publishers" => "Bickers & Son",
    "authors" => "Isabel Burton",
    "original_authors" => "José de Alencar",
    "original_title" => "Iracema"
  }

  describe "GET /publications when there are no publications" do
    test "does not require authentication", %{conn: conn} do
      expect_auth_verify(0)
      expect_auth_authorize_admin(0)
      get(conn, publication_path(conn, :index))
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
      for i <- 1..7 do
        %{@publication_attrs | "title" => "Paged #{String.pad_leading("#{i}", 2, "0")}"}
        |> Publication.Codec.nest()
        |> Publication.insert("importer@example.com")
      end

      # A direct seed stands in for a bulk insert; the index reads a materialized
      # view, so signal the refresh the real write path would.
      Publication.Index.Refresher.refresh()

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

      body =
        meta.conn
        |> get("#{publication_path(meta.conn, :index)}?ids=#{Enum.join(rest, ",")}")
        |> json_response(200)

      assert Enum.map(body["entries"], & &1["id"]) == rest
      # The ordering was handed back once; a later stretch is only the rows.
      refute Map.has_key?(body, "order")
    end
  end

  describe "GET /publications/:id" do
    setup(%{conn: conn}) do
      {:ok, publication} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert("importer@example.com")

      [conn: conn, publication: publication]
    end

    test "returns one publication, flat, without authentication", meta do
      expect_auth_verify(0)
      expect_auth_authorize_admin(0)

      conn = get(meta.conn, publication_path(meta.conn, :show, meta.publication.id))

      assert %{"title" => title, "authors" => authors, "id" => id} =
               json_response(conn, 200)

      assert title == @publication_attrs["title"]
      assert authors == @publication_attrs["authors"]
      assert id == meta.publication.id
    end

    test "returns 404 for a publication that never existed", meta do
      conn = get(meta.conn, publication_path(meta.conn, :show, -1))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "a deleted publication reads as missing, not merely hidden", meta do
      expect_auth_authorize_admin()
      delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))

      # The same answer the index and the search give: gone from every read
      # path, so a stale link cannot resurrect a record from the trash.
      conn = get(meta.conn, publication_path(meta.conn, :show, meta.publication.id))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "GET /publications?unreferenced" do
    test "returns only publications that have no references", %{conn: conn} do
      {:ok, with_refs} =
        @publication_attrs |> Publication.Codec.nest() |> Publication.insert()

      {:ok, _} =
        Publication.update(
          with_refs.id,
          @publication_attrs
          |> Publication.Codec.nest()
          |> Map.put("references", Reference.nest(["A source"]))
        )

      {:ok, _without} =
        %{@publication_attrs | "title" => "Unsourced Title"}
        |> Publication.Codec.nest()
        |> Publication.insert()

      Publication.Index.Refresher.refresh()

      entries =
        conn
        |> get("#{publication_path(conn, :index)}?unreferenced")
        |> json_response(200)
        |> Map.get("entries")

      titles = Enum.map(entries, & &1["title"])
      assert "Unsourced Title" in titles
      refute @publication_attrs["title"] in titles
    end
  end

  describe "CSRF protection on admin mutations" do
    test "rejects a POST without a CSRF token", %{conn: conn} do
      conn =
        conn
        |> delete_req_header("rb-csrf-token")
        |> post(publication_path(conn, :create_all), %{"_json" => []})

      assert response(conn, 403)
    end

    test "rejects a POST whose CSRF token is for a different subject", %{conn: conn} do
      conn =
        conn
        |> put_req_header("rb-csrf-token", RichardBurton.Auth.Csrf.sign("99999"))
        |> post(publication_path(conn, :create_all), %{"_json" => []})

      assert response(conn, 403)
    end

    test "rejects a DELETE without a CSRF token", %{conn: conn} do
      conn =
        conn
        |> delete_req_header("rb-csrf-token")
        |> delete(publication_path(conn, :delete, 1))

      assert response(conn, 403)
    end
  end

  describe "DELETE /publications/:id" do
    setup(%{conn: conn}) do
      {:ok, publication} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      [conn: conn, publication: publication]
    end

    test "soft-deletes the publication and returns 204", meta do
      expect_auth_authorize_admin()

      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert response(conn, 204)

      # Gone from the index the readers see.
      conn = get(build_conn(), publication_path(conn, :index))
      assert %{"entries" => []} = json_response(conn, 200)
    end

    test "records the acting admin in the publication's history", meta do
      expect_auth_authorize_admin()

      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert response(conn, 204)

      assert [%{action: "deleted", actor: actor}, _created] =
               RichardBurton.Publication.History.of(meta.publication.id)

      assert actor == session_user_email()
    end

    test "returns 404 for a missing publication", meta do
      expect_auth_authorize_admin()

      conn = delete(meta.conn, publication_path(meta.conn, :delete, -1))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end

    test "returns 404 for an already-deleted publication", meta do
      expect_auth_authorize_admin(2)

      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert response(conn, 204)

      conn = delete(meta.conn, publication_path(meta.conn, :delete, meta.publication.id))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "GET /publications/:id/history" do
    setup(%{conn: conn}) do
      {:ok, publication} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert("importer@example.com")

      [conn: conn, publication: publication]
    end

    test "returns the ordered mutation stream with actors and snapshots", meta do
      expect_auth_authorize_admin(2)

      attrs = Map.put(@publication_attrs, "title", "Iracema, revised")

      conn =
        put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), attrs)

      assert response(conn, 200)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.publication.id))

      # Newest first, so the viewer renders the response as it arrives.
      assert %{"entries" => [updated, created]} = json_response(conn, 200)
      assert %{"version" => 1, "action" => "created", "actor" => "importer@example.com"} = created
      assert %{"version" => 2, "action" => "updated"} = updated
      assert updated["actor"] == session_user_email()
      assert created["snapshot"]["title"] =~ "Honey-Lips"
      assert updated["snapshot"]["title"] == "Iracema, revised"
      assert %{"timestamp" => _} = updated
    end

    test "reports whether each entry can still be undone", meta do
      expect_auth_authorize_admin(2)

      attrs = Map.put(@publication_attrs, "title", "Iracema, revised")
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), attrs)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.publication.id))

      # The client is told, not left to work it out: the answer depends on the
      # whole log, which a paginated client would not have.
      assert %{"entries" => [%{"undoable" => true}, %{"undoable" => false}]} =
               json_response(conn, 200)
    end

    test "returns no entries for an unknown publication", meta do
      expect_auth_authorize_admin()

      conn = get(meta.conn, publication_path(meta.conn, :history, -1))

      assert %{"entries" => []} = json_response(conn, 200)
    end
  end

  describe "GET /publications/history (database-wide)" do
    test "returns every recorded change, newest first, tagged with its publication", %{
      conn: conn
    } do
      expect_auth_authorize_admin()

      {:ok, first} =
        @publication_attrs |> Publication.Codec.nest() |> Publication.insert("a@example.com")

      {:ok, _second} =
        @publication_attrs
        |> Map.put("title", "Iracema, again")
        |> Publication.Codec.nest()
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
      {:ok, publication} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert("importer@example.com")

      [conn: conn, publication: publication]
    end

    defp undo_path(conn, publication, version) do
      publication_path(conn, :undo, publication.id, version)
    end

    test "undoes a recorded change and records the undo as its own entry", meta do
      expect_auth_authorize_admin(3)

      attrs = Map.put(@publication_attrs, "title", "Iracema, revised")
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), attrs)

      conn = post(meta.conn, undo_path(meta.conn, meta.publication, 2))
      assert response(conn, 204)

      conn = get(meta.conn, publication_path(meta.conn, :history, meta.publication.id))
      assert %{"entries" => entries} = json_response(conn, 200)

      # Three entries, not one: the log grew rather than losing the update.
      assert ["updated", "updated", "created"] = Enum.map(entries, & &1["action"])
      assert hd(entries)["snapshot"]["title"] == @publication_attrs["title"]
      assert hd(entries)["actor"] == session_user_email()
    end

    test "refuses an entry that is no longer reconcilable", meta do
      expect_auth_authorize_admin(3)

      first = Map.put(@publication_attrs, "title", "First")
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), first)

      second = Map.put(@publication_attrs, "title", "Second")
      put(meta.conn, publication_path(meta.conn, :update, meta.publication.id), second)

      # Undoing the first retitle would silently discard the second.
      conn = post(meta.conn, undo_path(meta.conn, meta.publication, 2))
      assert json_response(conn, 409) == %{"error" => "conflict"}
    end

    test "returns 404 for a version that was never recorded", meta do
      expect_auth_authorize_admin()

      conn = post(meta.conn, undo_path(meta.conn, meta.publication, 99))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "POST /publications/:id/restore" do
    setup(%{conn: conn}) do
      {:ok, publication} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      {:ok, _} = Publication.delete(publication.id)

      [conn: conn, publication: publication]
    end

    test "restores a deleted publication back into the index", meta do
      expect_auth_authorize_admin()

      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.publication.id))
      assert response(conn, 204)

      conn = get(build_conn(), publication_path(conn, :index))
      assert %{"entries" => [entry]} = json_response(conn, 200)
      assert entry["title"] == @publication_attrs["title"]
    end

    test "the trash lists what is currently deleted, and a restore empties it", meta do
      expect_auth_authorize_admin(3)

      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))

      assert %{"entries" => [entry]} = json_response(conn, 200)
      assert entry["publication"]["title"] == @publication_attrs["title"]
      assert is_binary(entry["deleted_at"])

      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.publication.id))
      assert response(conn, 204)

      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))
      assert %{"entries" => []} = json_response(conn, 200)
    end

    test "a deleted, restored and re-deleted record is one tombstone, not three", meta do
      expect_auth_authorize_admin(2)

      {:ok, _} = Publication.restore(meta.publication.id)
      {:ok, _} = Publication.delete(meta.publication.id)

      conn = get(meta.conn, publication_path(meta.conn, :index_deleted))
      assert %{"entries" => [_only_one]} = json_response(conn, 200)

      # The log, by contrast, keeps every event.
      conn = get(meta.conn, publication_path(meta.conn, :history))
      assert %{"entries" => entries} = json_response(conn, 200)
      assert 2 == Enum.count(entries, &(&1["action"] == "deleted"))
    end

    test "restoring is a conflict when the same record was imported again", meta do
      expect_auth_authorize_admin()

      {:ok, _twin} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      conn = post(meta.conn, publication_path(meta.conn, :restore, meta.publication.id))
      assert json_response(conn, 409) == %{"error" => "conflict"}
    end

    test "restoring a live or unknown publication is not found", meta do
      expect_auth_authorize_admin()

      conn = post(meta.conn, publication_path(meta.conn, :restore, -1))
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end

  describe "POST /publications/bulk" do
    test "returns 201 and the created publications when all the publications are valid", meta do
      expect_auth_authorize_admin()

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      assert publications == Enum.map(result, &Map.drop(&1, ["id", "references", "source_match"]))
    end

    test "bulk-inserts publications with their references", meta do
      expect_auth_authorize_admin()

      input = %{
        "_json" => [
          Map.put(@publication_attrs, "references", ["First source", "Second source"])
        ]
      }

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      assert [%{"references" => ["First source", "Second source"]}] = result
      assert [%{references: ["First source", "Second source"]}] = FlatPublication.all()
    end

    test "returns 201 and inserts publications with several countries", meta do
      expect_auth_authorize_admin()

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB, US",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB,US",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB, BR,US",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son",
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
          "countries" => "GB, US",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB, US",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB, BR, US",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886
        }
      ]

      assert 3 == FlatPublication.all() |> length()
      assert ["GB", "US", "BR"] == Country.all() |> Enum.map(&Country.get_code/1)
      assert output == Enum.map(result, &Map.drop(&1, ["id", "references", "source_match"]))
    end

    test "returns 201 and inserts publications with several publishers", meta do
      expect_auth_authorize_admin()

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son,Noonday Press",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son, Noonday Press,Ronald Massey",
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
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son, Noonday Press, Ronald Massey",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886
        }
      ]

      publishers = ["Bickers & Son", "Noonday Press", "Ronald Massey"]

      assert 3 == FlatPublication.all() |> length()
      assert publishers == Publisher.all() |> Enum.map(&Publisher.get_name/1)
      assert output == Enum.map(result, &Map.drop(&1, ["id", "references", "source_match"]))
    end

    test "returns 409 when publications are repeated, and returns the first repeated one", meta do
      expect_auth_authorize_admin()

      repeated_publication = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => 1886,
        "countries" => "GB",
        "publishers" => "Bickers & Son",
        "authors" => "Isabel Burton",
        "original_authors" => "José de Alencar",
        "original_title" => "Iracema"
      }

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
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

      assert repeated_publication == result
    end

    test "returns 400 when a publication is invalid, and returns it with its errors", meta do
      expect_auth_authorize_admin()

      invalid_publication = %{
        "title" => "",
        "year" => 1886,
        "countries" => "GB",
        "publishers" => "Bickers & Son",
        "authors" => "",
        "original_authors" => "José de Alencar",
        "original_title" => "Iracema"
      }

      invalid_publication_errors = %{
        "title" => "required",
        "authors" => "required"
      }

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        invalid_publication,
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        }
      ]

      input = %{"_json" => publications}

      output = %{
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
      "countries" => "GB",
      "publishers" => "Bickers & Son",
      "authors" => "Isabel Burton, Richard Burton",
      "original_authors" => "José de Alencar",
      "original_title" => "Iracema"
    }
    @correct_input_2 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "1922",
      "countries" => "US",
      "publishers" => "Ronald Massey",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "José de Alencar",
      "original_title" => "Ubirajara"
    }
    @correct_input_3 %{
      "title" => "",
      "year" => "AAAA",
      "countries" => "GB",
      "publishers" => "Bickers & Son",
      "authors" => "",
      "original_authors" => "José de Alencar",
      "original_title" => "Iracema"
    }
    @correct_input_4 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => "",
      "publishers" => "",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "",
      "original_title" => ""
    }
    @correct_input_5 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => "USA",
      "publishers" => "",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "",
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
      expect_auth_authorize_admin()

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
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton, Richard Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "references" => []
        },
        "errors" => nil
      },
      %{
        "publication" => %{
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "1922",
          "countries" => "US, GB",
          "publishers" => "Ronald Massey",
          "authors" => "J. T. W. Sadler",
          "original_authors" => "José de Alencar",
          "original_title" => "Ubirajara",
          "references" => []
        },
        "errors" => nil
      },
      %{
        "publication" => %{
          "title" => "",
          "year" => "AAAA",
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "references" => []
        },
        "errors" => %{
          "year" => "integer",
          "title" => "required",
          "authors" => "required"
        }
      },
      %{
        "publication" => %{
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "",
          "countries" => "",
          "publishers" => "",
          "authors" => "J. T. W. Sadler",
          "original_authors" => "",
          "original_title" => "",
          "references" => []
        },
        "errors" => %{
          "year" => "required",
          "countries" => "required",
          "publishers" => "required",
          "original_authors" => "required",
          "original_title" => "required"
        }
      }
    ]

    test "returns 200 and a list of maps with parsed publications and their corresponding errors",
         meta do
      expect_auth_authorize_admin()
      input = uploaded_csv_fixture("test/fixtures/data_correct_with_errors.csv")

      assert @output ==
               meta.conn
               |> post(publication_path(meta.conn, :validate), input)
               |> json_response(200)
    end
  end

  describe "POST /publications/validate when sending incorrect csv" do
    test "on invalid escape sequence, returns 400 with invalid_escape_sequence code", meta do
      expect_auth_authorize_admin()
      input = uploaded_csv_fixture("test/fixtures/data_incorrect_escape_sequence.csv")

      response =
        meta.conn
        |> post(publication_path(meta.conn, :validate), input)
        |> json_response(400)

      assert "invalid_escape_sequence" = response
    end
  end

  describe "GET /files/publications without search and select params" do
    test "returns 200 and a csv attachment with all the publications", meta do
      expect_auth_authorize_admin()

      {:ok, _p} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      Publication.Index.Refresher.refresh()

      conn = get(meta.conn, publication_path(meta.conn, :export))

      expected_data =
        "authors;countries;original_authors;original_title;publishers;references;title;year\nIsabel Burton;GB;José de Alencar;Iracema;Bickers & Son;;Iraçéma the Honey-Lips: A Legend of Brazil;1886\n"

      expected_filename = "publications.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end

    test "joins a publication's references into the references cell", meta do
      expect_auth_authorize_admin()

      {:ok, publication} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      # Attach provenance, then export.
      {:ok, _} =
        Publication.update(
          publication.id,
          @publication_attrs
          |> Publication.Codec.nest()
          |> Map.put("references", Reference.nest(["First source", "Second source"]))
        )

      conn = get(meta.conn, publication_path(meta.conn, :export))

      # One reference per line inside a single quoted cell (CSV quotes the newline).
      assert response(conn, 200) =~ "\"First source\nSecond source\""
    end

    test "imports a newline-per-line references cell back into a list", meta do
      expect_auth_authorize_admin()
      input = uploaded_csv_fixture("test/fixtures/data_with_references.csv")

      [first | _] =
        meta.conn
        |> post(publication_path(meta.conn, :validate), input)
        |> json_response(200)

      assert ["First source", "Second source"] == first["publication"]["references"]
    end
  end

  describe "GET /files/publications with search param and without select param" do
    test "returns 200 and a csv attachment with the requested attributes of all the matching publications",
         meta do
      expect_auth_authorize_admin()

      {:ok, [_p1, _p2]} =
        [@publication_attrs, Map.put(@publication_attrs, "title", "bla")]
        |> Publication.Codec.nest()
        |> Publication.insert_all()

      search = "Honey"

      path = "#{publication_path(meta.conn, :export)}?search=#{search}"

      conn = get(meta.conn, path)

      expected_data =
        "authors;countries;original_authors;original_title;publishers;references;title;year\nIsabel Burton;GB;José de Alencar;Iracema;Bickers & Son;;Iraçéma the Honey-Lips: A Legend of Brazil;1886\n"

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
      expect_auth_authorize_admin()

      {:ok, [_p1, _p2]} =
        [@publication_attrs, Map.put(@publication_attrs, "title", "bla")]
        |> Publication.Codec.nest()
        |> Publication.insert_all()

      search = "Honey"
      attributes = [:title, :original_title, :authors]
      select = Enum.map_join(attributes, "&", &"select[]=#{&1}")

      path = "#{publication_path(meta.conn, :export)}?search=#{search}&#{select}"

      conn = get(meta.conn, path)

      expected_data =
        "authors;original_title;title\nIsabel Burton;Iracema;Iraçéma the Honey-Lips: A Legend of Brazil\n"

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
      expect_auth_authorize_admin()

      {:ok, _p} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      Publication.Index.Refresher.refresh()

      attributes = [:title, :original_title, :authors]
      select = Enum.map_join(attributes, "&", &"select[]=#{&1}")

      path = "#{publication_path(meta.conn, :export)}?#{select}"

      conn = get(meta.conn, path)

      expected_data =
        "authors;original_title;title\nIsabel Burton;Iracema;Iraçéma the Honey-Lips: A Legend of Brazil\n"

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
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "title" => "A New Title"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["id"] == publication.id
      assert result["title"] == "A New Title"
      # The change is persisted and visible through the read model.
      assert ["A New Title"] == FlatPublication.all() |> Enum.map(& &1.title)
    end

    test "edits a keyed field, changing the record's identity", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "year" => "1999"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["id"] == publication.id
      assert result["year"] == 1999
    end

    test "updates the translated book when the original fields change", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "original_title" => "Iracema (rev.)"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["original_title"] == "Iracema (rev.)"
    end

    test "returns 409 when the edit collides with another publication", meta do
      a = insert_publication(@publication_attrs)
      _b = insert_publication(%{@publication_attrs | "title" => "Another Title"})
      expect_auth_authorize_admin()

      # Editing `a` to `b`'s title collides with `b`'s composite key.
      attrs = %{@publication_attrs | "title" => "Another Title"}

      conn = put(meta.conn, publication_path(meta.conn, :update, a.id), attrs)
      assert response(conn, 409)
    end

    test "re-saving the same data does not conflict with itself", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      conn =
        put(meta.conn, publication_path(meta.conn, :update, publication.id), @publication_attrs)

      assert response(conn, 200)
    end

    test "returns 400 for invalid data", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "title" => ""}

      conn = put(meta.conn, publication_path(meta.conn, :update, publication.id), attrs)
      assert response(conn, 400)
    end

    test "returns 404 for a missing publication", meta do
      expect_auth_authorize_admin()

      conn = put(meta.conn, publication_path(meta.conn, :update, 999_999), @publication_attrs)
      assert response(conn, 404)
    end

    test "sets the publication's references from the flat payload", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = Map.put(@publication_attrs, "references", ["First source", "Second source"])

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      # The flat string list round-trips: nested into child rows on the way in,
      # flattened back to an ordered list in the response and the read model.
      assert result["references"] == ["First source", "Second source"]

      assert [%{references: ["First source", "Second source"]}] = FlatPublication.all()
    end
  end

  describe "POST /publications/:id/validate" do
    test "does not report the row being edited as a conflict", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      result =
        meta.conn
        |> post(publication_path(meta.conn, :validate, publication.id), @publication_attrs)
        |> json_response(200)

      assert result["errors"] == nil
    end

    test "reports a conflict against a different publication", meta do
      _a = insert_publication(@publication_attrs)
      b = insert_publication(%{@publication_attrs | "title" => "Another Title"})
      expect_auth_authorize_admin()

      # Validating `b` against `a`'s data conflicts with `a`.
      result =
        meta.conn
        |> post(publication_path(meta.conn, :validate, b.id), @publication_attrs)
        |> json_response(200)

      assert result["errors"] == "conflict"
    end
  end

  defp insert_publication(attrs) do
    {:ok, publication} = attrs |> Publication.Codec.nest() |> Publication.insert()
    publication
  end
end
