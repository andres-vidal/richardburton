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

      merged = Base.encode64(<<1, 2>>)
      expect_auth_authorize_admin()

      assert meta.conn
             |> post(document_path(meta.conn, :compact, document["id"]), %{"update" => merged})
             |> response(204)

      expect_auth_authorize_admin()

      assert %{"entries" => [^merged]} =
               meta.conn
               |> get(document_path(meta.conn, :updates, document["id"]))
               |> json_response(200)
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
