defmodule RichardBurtonWeb.DocumentControllerTest do
  @moduledoc """
  Tests for the import-document endpoints.

  Updates cross as base64 and are never parsed here, so the bytes that go in are
  the bytes that come back.
  """
  use RichardBurtonWeb.ConnCase

  import Routes, only: [document_path: 2, document_path: 3]

  alias RichardBurton.Document
  alias RichardBurton.Repo

  setup do
    {:ok, actor: create_session_user()}
  end

  defp create(conn, name \\ "Second pass") do
    expect_auth_authorize_admin()

    conn
    |> post(document_path(conn, :create), %{"name" => name})
    |> json_response(201)
  end

  describe "POST /documents" do
    test "starts one under a name", meta do
      body = create(meta.conn)

      assert body["name"] == "Second pass"
      assert body["rows"] == 0
    end

    test "a document needs a name", meta do
      expect_auth_authorize_admin()

      assert %{"errors" => _} =
               meta.conn
               |> post(document_path(meta.conn, :create), %{"name" => ""})
               |> json_response(400)
    end
  end

  describe "GET /documents" do
    test "lists every document, whoever started it", meta do
      mine = create(meta.conn, "Mine")

      # One somebody else started, which this person has never touched.
      {:ok, theirs} = Document.create(%{"name" => "Theirs"})

      expect_auth_authorize_admin()

      assert %{"entries" => entries} =
               meta.conn |> get(document_path(meta.conn, :index)) |> json_response(200)

      assert Enum.map(entries, & &1["id"]) |> Enum.sort() ==
               Enum.sort([mine["id"], theirs.id])
    end

    test "a page of them, with how many there are in all", meta do
      for name <- ["One", "Two", "Three"], do: Document.create(%{"name" => name})

      expect_auth_authorize_admin()

      assert %{"entries" => entries, "total" => 3} =
               meta.conn
               |> get(document_path(meta.conn, :index), %{"limit" => "2"})
               |> json_response(200)

      assert length(entries) == 2
    end

    test "an archived document is not on the list", meta do
      kept = create(meta.conn, "Kept")
      {:ok, retired} = Document.create(%{"name" => "Retired"})
      {:ok, _} = Document.archive(retired)

      expect_auth_authorize_admin()

      assert %{"entries" => entries} =
               meta.conn |> get(document_path(meta.conn, :index)) |> json_response(200)

      assert Enum.map(entries, & &1["id"]) == [kept["id"]]
    end
  end

  describe "renaming and retiring" do
    test "a document can be given a different name", meta do
      document = create(meta.conn, "Before")
      expect_auth_authorize_admin()

      assert %{"name" => "After"} =
               meta.conn
               |> patch(document_path(meta.conn, :update, document["id"]), %{"name" => "After"})
               |> json_response(200)
    end

    test "a name it could not be told apart by is refused", meta do
      document = create(meta.conn)
      expect_auth_authorize_admin()

      assert %{"errors" => _} =
               meta.conn
               |> patch(document_path(meta.conn, :update, document["id"]), %{"name" => ""})
               |> json_response(400)
    end

    test "archiving takes it off the list and putting it back returns it", meta do
      document = create(meta.conn)
      expect_auth_authorize_admin()

      assert %{"archived_at" => archived_at} =
               meta.conn
               |> delete(document_path(meta.conn, :archive, document["id"]))
               |> json_response(200)

      assert archived_at

      expect_auth_authorize_admin()

      assert %{"archived_at" => nil} =
               meta.conn
               |> post(document_path(meta.conn, :unarchive, document["id"]))
               |> json_response(200)
    end
  end

  describe "the updates a document is made of" do
    test "what is appended comes back as the bytes it went in as", meta do
      document = create(meta.conn)
      update = Base.encode64(<<1, 2, 3>>)

      expect_auth_authorize_admin()

      assert meta.conn
             |> post(document_path(meta.conn, :append, document["id"]), %{
               "update" => update,
               "rows" => 3
             })
             |> response(204)

      expect_auth_authorize_admin()

      assert %{"entries" => [^update]} =
               meta.conn
               |> get(document_path(meta.conn, :updates, document["id"]))
               |> json_response(200)

      assert Repo.get(Document, document["id"]).rows == 3
    end

    test "a compaction replaces what is behind it", meta do
      document = create(meta.conn)

      for bytes <- [<<1>>, <<2>>] do
        expect_auth_authorize_admin()

        meta.conn
        |> post(document_path(meta.conn, :append, document["id"]), %{
          "update" => Base.encode64(bytes),
          "rows" => 1
        })
        |> response(204)
      end

      expect_auth_authorize_admin()

      %{"through" => through} =
        meta.conn
        |> get(document_path(meta.conn, :updates, document["id"]))
        |> json_response(200)

      merged = Base.encode64(<<1, 2>>)
      expect_auth_authorize_admin()

      assert meta.conn
             |> post(document_path(meta.conn, :compact, document["id"]), %{
               "update" => merged,
               "through" => through
             })
             |> response(204)

      expect_auth_authorize_admin()

      assert %{"entries" => [^merged]} =
               meta.conn
               |> get(document_path(meta.conn, :updates, document["id"]))
               |> json_response(200)
    end

    test "a compaction that names no point it reaches is refused", meta do
      document = create(meta.conn)
      expect_auth_authorize_admin()

      assert %{"error" => "invalid_through"} =
               meta.conn
               |> post(document_path(meta.conn, :compact, document["id"]), %{
                 "update" => Base.encode64(<<1>>)
               })
               |> json_response(400)
    end

    test "a row count that is not one is not a reason to refuse the change", meta do
      document = create(meta.conn)
      expect_auth_authorize_admin()

      assert meta.conn
             |> post(document_path(meta.conn, :append, document["id"]), %{
               "update" => Base.encode64(<<1>>),
               "rows" => "not a number"
             })
             |> response(204)

      assert Repo.get(Document, document["id"]).rows == 0
    end

    test "something that is not base64 is refused", meta do
      document = create(meta.conn)
      expect_auth_authorize_admin()

      assert %{"error" => "invalid_update"} =
               meta.conn
               |> post(document_path(meta.conn, :append, document["id"]), %{
                 "update" => "not base64!"
               })
               |> json_response(400)
    end

    test "a document that does not exist is not found", meta do
      expect_auth_authorize_admin()

      assert %{"error" => "not_found"} =
               meta.conn
               |> get(document_path(meta.conn, :updates, 999_999))
               |> json_response(404)
    end
  end

  describe "POST /documents/socket-token" do
    test "mints a token the socket accepts", meta do
      expect_auth_authorize_admin()

      assert %{"token" => token} =
               meta.conn
               |> post(document_path(meta.conn, :socket_token))
               |> json_response(200)

      assert is_binary(token)
    end
  end
end
