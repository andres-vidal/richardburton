defmodule RichardBurtonWeb.WorkspaceControllerTest do
  @moduledoc """
  Tests for the workspace endpoints.

  Updates cross as base64 and are never parsed here, so the bytes that go in are
  the bytes that come back.
  """
  use RichardBurtonWeb.ConnCase

  import Routes, only: [workspace_path: 2, workspace_path: 3]

  alias RichardBurton.Repo
  alias RichardBurton.User
  alias RichardBurton.Workspace

  setup do
    {:ok, actor: create_session_user()}
  end

  defp create(conn, name \\ "Second pass") do
    expect_auth_authorize_admin()

    conn
    |> post(workspace_path(conn, :create), %{"name" => name})
    |> json_response(201)
  end

  describe "POST /workspaces" do
    test "starts one owned by whoever asked", meta do
      body = create(meta.conn)

      assert body["name"] == "Second pass"
      assert body["rows"] == 0
      assert Repo.get(Workspace, body["id"]).owner_id == meta.actor.id
    end

    test "a workspace needs a name", meta do
      expect_auth_authorize_admin()

      assert %{"errors" => _} =
               meta.conn
               |> post(workspace_path(meta.conn, :create), %{"name" => ""})
               |> json_response(400)
    end
  end

  describe "GET /workspaces" do
    test "lists the ones this person may open", meta do
      mine = create(meta.conn, "Mine")

      expect_auth_authorize_admin()

      assert %{"entries" => [entry]} =
               meta.conn |> get(workspace_path(meta.conn, :index)) |> json_response(200)

      assert entry["id"] == mine["id"]
    end
  end

  describe "the updates a document is made of" do
    test "what is appended comes back as the bytes it went in as", meta do
      workspace = create(meta.conn)
      update = Base.encode64(<<1, 2, 3>>)

      expect_auth_authorize_admin()

      assert meta.conn
             |> post(workspace_path(meta.conn, :append, workspace["id"]), %{
               "update" => update,
               "rows" => 3
             })
             |> response(204)

      expect_auth_authorize_admin()

      assert %{"entries" => [^update]} =
               meta.conn
               |> get(workspace_path(meta.conn, :updates, workspace["id"]))
               |> json_response(200)

      assert Repo.get(Workspace, workspace["id"]).rows == 3
    end

    test "a compaction replaces what is behind it", meta do
      workspace = create(meta.conn)

      for bytes <- [<<1>>, <<2>>] do
        expect_auth_authorize_admin()

        meta.conn
        |> post(workspace_path(meta.conn, :append, workspace["id"]), %{
          "update" => Base.encode64(bytes),
          "rows" => 1
        })
        |> response(204)
      end

      merged = Base.encode64(<<1, 2>>)
      expect_auth_authorize_admin()

      assert meta.conn
             |> post(workspace_path(meta.conn, :compact, workspace["id"]), %{"update" => merged})
             |> response(204)

      expect_auth_authorize_admin()

      assert %{"entries" => [^merged]} =
               meta.conn
               |> get(workspace_path(meta.conn, :updates, workspace["id"]))
               |> json_response(200)
    end

    test "something that is not base64 is refused", meta do
      workspace = create(meta.conn)
      expect_auth_authorize_admin()

      assert %{"error" => "invalid_update"} =
               meta.conn
               |> post(workspace_path(meta.conn, :append, workspace["id"]), %{
                 "update" => "not base64!"
               })
               |> json_response(400)
    end
  end

  describe "who may open one" do
    test "a workspace someone is not in is not found", meta do
      workspace = create(meta.conn)

      # A workspace belonging to somebody else entirely.
      other =
        %User{}
        |> User.changeset(%{"subject_id" => "other", "email" => "other@rb.test"})
        |> Repo.insert!()

      {:ok, theirs} = Workspace.create(%{"name" => "Theirs"}, other.id)

      expect_auth_authorize_admin()

      assert %{"error" => "not_found"} =
               meta.conn
               |> get(workspace_path(meta.conn, :show, theirs.id))
               |> json_response(404)

      # And the one that is theirs to open still is.
      expect_auth_authorize_admin()

      assert %{"workspace" => _} =
               meta.conn
               |> get(workspace_path(meta.conn, :show, workspace["id"]))
               |> json_response(200)
    end

    test "the owner lets someone in by the address they signed in with", meta do
      workspace = create(meta.conn)

      guest =
        %User{}
        |> User.changeset(%{"subject_id" => "guest", "email" => "guest@rb.test"})
        |> Repo.insert!()

      expect_auth_authorize_admin()

      assert meta.conn
             |> post(workspace_path(meta.conn, :add_member, workspace["id"]), %{
               "email" => "guest@rb.test"
             })
             |> response(204)

      assert {:ok, _} = Workspace.find(workspace["id"], guest.id)
    end

    test "letting in somebody with no account says so", meta do
      workspace = create(meta.conn)
      expect_auth_authorize_admin()

      assert %{"error" => "no_such_user"} =
               meta.conn
               |> post(workspace_path(meta.conn, :add_member, workspace["id"]), %{
                 "email" => "nobody@rb.test"
               })
               |> json_response(404)
    end
  end
end
