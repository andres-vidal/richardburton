defmodule RichardBurton.ConcurrentAdminsTest do
  @moduledoc """
  Tests that two changes raced with `RichardBurton.RaceCase` cannot leave the
  platform without an admin: two admins demoting each other at once, or one
  demoting the other while being removed.
  """

  use RichardBurton.RaceCase

  alias RichardBurton.User

  setup do
    on_exit(fn -> unboxed(fn -> Repo.delete_all(User) end) end)
  end

  # Inserts an admin with `name` as its subject id, and commits it.
  defp admin(name) do
    unboxed(fn ->
      {:ok, user} = User.insert(%{subject_id: name, email: "#{name}@example.org"})
      {:ok, user} = User.set_role(user, :admin)
      user
    end)
  end

  # Returns the number of admins stored.
  defp admin_count do
    unboxed(fn -> Repo.aggregate(from(u in User, where: u.role == :admin), :count) end)
  end

  test "two admins demoting each other at once leave one admin" do
    ana = admin("ana")
    bea = admin("bea")

    assert %{first: {:ok, _}, second: {:error, :last_admin}, waited: true} =
             race(
               fn -> User.set_role(bea, :reader, ana.subject_id) end,
               fn -> User.set_role(ana, :reader, bea.subject_id) end
             )

    assert admin_count() == 1
  end

  test "an admin removed while removing the other admin leaves one admin" do
    ana = admin("ana")
    bea = admin("bea")

    assert %{first: {:ok, _}, second: {:error, :last_admin}, waited: true} =
             race(
               fn -> User.delete(bea, ana.subject_id) end,
               fn -> User.delete(ana, bea.subject_id) end
             )

    assert admin_count() == 1
  end
end
