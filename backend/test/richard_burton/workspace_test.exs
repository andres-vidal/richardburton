defmodule RichardBurton.WorkspaceTest do
  @moduledoc """
  Tests for workspaces: who may open one, and the updates its document is made
  of.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Repo
  alias RichardBurton.User
  alias RichardBurton.Workspace

  defp user(email) do
    %User{}
    |> User.changeset(%{"subject_id" => email, "email" => email})
    |> Repo.insert!()
  end

  defp workspace(owner, name \\ "Second pass") do
    {:ok, workspace} = Workspace.create(%{"name" => name}, owner.id)
    workspace
  end

  describe "create/2" do
    test "starts a workspace owned by the person who asked" do
      owner = user("owner@rb.test")
      {:ok, workspace} = Workspace.create(%{"name" => "Second pass"}, owner.id)

      assert workspace.owner_id == owner.id
      assert workspace.rows == 0
    end

    test "a workspace needs a name" do
      owner = user("owner@rb.test")

      assert {:error, changeset} = Workspace.create(%{"name" => ""}, owner.id)
      refute changeset.valid?
    end
  end

  describe "for_user/1" do
    test "lists the ones started and the ones let into, and nothing else" do
      owner = user("owner@rb.test")
      guest = user("guest@rb.test")
      stranger = user("stranger@rb.test")

      mine = workspace(owner, "Mine")
      shared = workspace(owner, "Shared")
      :ok = Workspace.add_member(shared, guest.id, owner.id)

      assert Enum.map(Workspace.for_user(owner.id), & &1.id) |> Enum.sort() ==
               Enum.sort([mine.id, shared.id])

      assert Enum.map(Workspace.for_user(guest.id), & &1.id) == [shared.id]
      assert Workspace.for_user(stranger.id) == []
    end
  end

  describe "find/2" do
    test "a workspace someone may not open is not found rather than forbidden" do
      owner = user("owner@rb.test")
      stranger = user("stranger@rb.test")
      workspace = workspace(owner)

      assert {:ok, _} = Workspace.find(workspace.id, owner.id)

      # Whether it exists is not theirs to know.
      assert {:error, :not_found} = Workspace.find(workspace.id, stranger.id)
    end
  end

  describe "updates/1 and append/3" do
    test "hands back what was appended, in the order it was written" do
      owner = user("owner@rb.test")
      workspace = workspace(owner)

      {:ok, _} = Workspace.append(workspace, <<1, 2, 3>>, 1)
      {:ok, _} = Workspace.append(workspace, <<4, 5>>, 2)

      assert Workspace.updates(workspace) == [<<1, 2, 3>>, <<4, 5>>]
    end

    test "the row count is the client's word, recorded as given" do
      owner = user("owner@rb.test")
      workspace = workspace(owner)

      {:ok, _} = Workspace.append(workspace, <<1>>, 428)

      assert Repo.get(Workspace, workspace.id).rows == 428
    end

    test "a workspace nobody has written to has nothing to apply" do
      owner = user("owner@rb.test")

      assert Workspace.updates(workspace(owner)) == []
    end
  end

  describe "compact/2" do
    test "one merged update replaces everything behind it" do
      owner = user("owner@rb.test")
      workspace = workspace(owner)

      {:ok, _} = Workspace.append(workspace, <<1>>, 1)
      {:ok, _} = Workspace.append(workspace, <<2>>, 2)
      {:ok, _} = Workspace.compact(workspace, <<1, 2>>)

      assert Workspace.updates(workspace) == [<<1, 2>>]
    end

    test "what is written after a compaction is read with it" do
      owner = user("owner@rb.test")
      workspace = workspace(owner)

      {:ok, _} = Workspace.append(workspace, <<1>>, 1)
      {:ok, _} = Workspace.compact(workspace, <<1>>)
      {:ok, _} = Workspace.append(workspace, <<2>>, 2)

      assert Workspace.updates(workspace) == [<<1>>, <<2>>]
    end
  end

  describe "add_member/3" do
    test "only the owner may let someone in" do
      owner = user("owner@rb.test")
      guest = user("guest@rb.test")
      stranger = user("stranger@rb.test")
      workspace = workspace(owner)

      assert {:error, :forbidden} = Workspace.add_member(workspace, stranger.id, guest.id)
      assert :ok = Workspace.add_member(workspace, guest.id, owner.id)
    end

    test "letting the same person in twice is the same as once" do
      owner = user("owner@rb.test")
      guest = user("guest@rb.test")
      workspace = workspace(owner)

      assert :ok = Workspace.add_member(workspace, guest.id, owner.id)
      assert :ok = Workspace.add_member(workspace, guest.id, owner.id)

      assert length(Workspace.members(workspace)) == 1
    end

    test "a member can open it afterwards" do
      owner = user("owner@rb.test")
      guest = user("guest@rb.test")
      workspace = workspace(owner)

      assert {:error, :not_found} = Workspace.find(workspace.id, guest.id)

      :ok = Workspace.add_member(workspace, guest.id, owner.id)

      assert {:ok, _} = Workspace.find(workspace.id, guest.id)
    end
  end
end
