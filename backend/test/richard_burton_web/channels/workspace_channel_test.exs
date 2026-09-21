defmodule RichardBurtonWeb.WorkspaceChannelTest do
  @moduledoc """
  Tests for the channel workspaces are edited live over.

  Updates cross as the opaque bytes they are: nothing here reads one, so what
  arrives is what was sent.
  """
  use RichardBurtonWeb.ChannelCase

  alias RichardBurton.Repo
  alias RichardBurton.User
  alias RichardBurton.Workspace
  alias RichardBurtonWeb.WorkspaceChannel
  alias RichardBurtonWeb.WorkspaceSocket

  defp user(email) do
    %User{}
    |> User.changeset(%{"subject_id" => email, "email" => email})
    |> Repo.insert!()
  end

  defp connected_as(user) do
    {:ok, socket} =
      connect(WorkspaceSocket, %{"token" => WorkspaceSocket.sign(user.subject_id)})

    socket
  end

  defp workspace(owner) do
    {:ok, workspace} = Workspace.create(%{"name" => "Second pass"}, owner.id)
    workspace
  end

  describe "connecting" do
    test "a token minted for someone gets them on" do
      owner = user("owner@rb.test")

      assert {:ok, socket} =
               connect(WorkspaceSocket, %{"token" => WorkspaceSocket.sign(owner.subject_id)})

      assert socket.assigns.subject_id == owner.subject_id
    end

    test "no token, no connection" do
      assert :error = connect(WorkspaceSocket, %{})
    end

    test "something that is not a token this server signed is refused" do
      assert :error = connect(WorkspaceSocket, %{"token" => "made up"})
    end
  end

  describe "joining" do
    test "the owner may join their own workspace" do
      owner = user("owner@rb.test")
      workspace = workspace(owner)

      assert {:ok, _reply, _socket} =
               connected_as(owner)
               |> subscribe_and_join(WorkspaceChannel, "workspace:#{workspace.id}")
    end

    test "a member may join one they were let into" do
      owner = user("owner@rb.test")
      guest = user("guest@rb.test")
      workspace = workspace(owner)

      :ok = Workspace.add_member(workspace, guest.id, owner.id)

      assert {:ok, _reply, _socket} =
               connected_as(guest)
               |> subscribe_and_join(WorkspaceChannel, "workspace:#{workspace.id}")
    end

    test "someone else's workspace is not said to exist" do
      owner = user("owner@rb.test")
      stranger = user("stranger@rb.test")
      workspace = workspace(owner)

      assert {:error, %{reason: "not_found"}} =
               connected_as(stranger)
               |> subscribe_and_join(WorkspaceChannel, "workspace:#{workspace.id}")
    end

    test "a workspace that does not exist is not either" do
      assert {:error, %{reason: "not_found"}} =
               connected_as(user("owner@rb.test"))
               |> subscribe_and_join(WorkspaceChannel, "workspace:999999")
    end
  end

  describe "relaying" do
    setup do
      owner = user("owner@rb.test")
      workspace = workspace(owner)

      {:ok, _reply, socket} =
        connected_as(owner)
        |> subscribe_and_join(WorkspaceChannel, "workspace:#{workspace.id}")

      {:ok, socket: socket, workspace: workspace}
    end

    test "a change reaches the others, as the bytes it was sent as", meta do
      push(meta.socket, "update", %{"update" => "AQIDBA=="})

      assert_broadcast("update", %{"update" => "AQIDBA=="})
    end

    test "awareness crosses the same way", meta do
      push(meta.socket, "awareness", %{"awareness" => "BQY="})

      assert_broadcast("awareness", %{"awareness" => "BQY="})
    end

    test "the sender is not handed back its own change", meta do
      push(meta.socket, "update", %{"update" => "AQIDBA=="})

      # It is broadcast to the topic...
      assert_broadcast("update", %{"update" => "AQIDBA=="})

      # ...but never pushed down the socket it came from, which would have the
      # client apply its own change a second time.
      refute_push("update", %{"update" => "AQIDBA=="})
    end

    test "an event it does not know is ignored rather than crashing", meta do
      push(meta.socket, "whatever", %{})

      refute_broadcast("whatever", %{})
    end
  end
end
