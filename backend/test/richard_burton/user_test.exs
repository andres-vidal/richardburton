defmodule RichardBurton.UserTest do
  @moduledoc """
  Tests for the User schema
  """

  use RichardBurton.DataCase
  import Ecto.Changeset

  alias Ecto.Adapters.SQL.Sandbox
  alias RichardBurton.Auth.Access
  alias RichardBurton.Auth.Session
  alias RichardBurton.User
  alias RichardBurton.Util
  alias RichardBurton.Validation

  @valid_attrs %{"email" => "example@gmail.com", "subject_id" => "1245"}

  defp changeset(attrs) do
    User.changeset(%User{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
  end

  defp insert(attrs) do
    attrs |> changeset() |> Repo.insert()
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(@valid_attrs).valid?
    end

    test "when email is blank, is invalid" do
      refute change_valid(%{"email" => ""}).valid?
    end

    test "when email is nil is invalid" do
      refute change_valid(%{"email" => nil}).valid?
    end

    test "when subject id is blank, is invalid" do
      refute change_valid(%{"subject_id" => ""}).valid?
    end

    test "when subject id is nil is invalid" do
      refute change_valid(%{"subject_id" => nil}).valid?
    end

    test "when a user with the provided attributes exist, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end

    test "role is always reader" do
      changeset = change_valid(%{"role" => "admin"})
      assert :reader == get_change(changeset, :role)
    end
  end

  describe "insert/1" do
    test "when inserting a valid user, returns the new user" do
      {:ok, user} = User.insert(@valid_attrs)
      assert User.all() == [user]
    end

    test "when inserting an invalid user, returns an error map" do
      {:error, errors} = User.insert(Map.put(@valid_attrs, "email", ""))
      assert %{email: :required} == errors
    end

    test "when inserting a duplicate user, returns conflict" do
      insert(@valid_attrs)
      {:error, errors} = User.insert(@valid_attrs)
      assert :conflict == errors
    end
  end

  describe "set_role/3" do
    # `set_role/3` broadcasts on the person's access topic, so a document
    # channel they already joined checks the new role, not only their next
    # request.
    test "announces that the person's access changed" do
      user = user_fixture("helen@example.com", :contributor)

      Phoenix.PubSub.subscribe(
        RichardBurton.PubSub,
        RichardBurton.Auth.Access.topic(user.subject_id)
      )

      {:ok, _} = User.set_role(user, :reader)

      assert_receive :access_changed
    end

    test "a change that is refused announces nothing" do
      user = user_fixture("helen@example.com", :contributor)

      Phoenix.PubSub.subscribe(
        RichardBurton.PubSub,
        RichardBurton.Auth.Access.topic(user.subject_id)
      )

      {:error, :invalid_role} = User.set_role(user, :emperor)

      refute_receive :access_changed, 50
    end
  end

  describe "delete/2" do
    # A document channel checks access on its own database connection, so it
    # only sees committed rows. This test checks the same way, on a connection
    # outside the SQL sandbox. Inside the sandbox every process shares the
    # test's connection, so a check could not see the database as a channel
    # does while `delete/2` holds its transaction open.
    #
    # The rows the test commits are deleted by `delete/2`, or by `on_exit` if
    # the test fails first. This module is not async, so no other test runs
    # while those rows exist.
    test "announces the removal after it commits" do
      subject_id = "sub-removed@example.com"

      on_exit(fn ->
        unboxed(fn ->
          Repo.delete_all(from(s in Session, where: s.subject_id == ^subject_id))
          Repo.delete_all(from(u in User, where: u.subject_id == ^subject_id))
        end)
      end)

      {user, session} =
        unboxed(fn ->
          {:ok, user} =
            User.insert(%{"subject_id" => subject_id, "email" => "removed@example.com"})

          {:ok, token} = Session.create(subject_id)
          {:ok, session} = Session.verify_session(token)
          {user, session}
        end)

      test = self()

      spawn_link(fn ->
        Phoenix.PubSub.subscribe(RichardBurton.PubSub, Access.topic(subject_id))
        send(test, :listening)
        report_checks(test, session.id)
      end)

      assert_receive :listening
      {:ok, _} = unboxed(fn -> User.delete(user) end)

      assert_receive {:session_active?, false}
    end

    test "a removal that is refused announces nothing" do
      user = user_fixture("helen@example.com", :admin)
      Phoenix.PubSub.subscribe(RichardBurton.PubSub, Access.topic(user.subject_id))

      {:error, :self} = User.delete(user, user.subject_id)

      refute_receive :access_changed, 50
    end
  end

  # Runs `fun` on a connection outside the SQL sandbox, so its writes commit.
  defp unboxed(fun), do: Sandbox.unboxed_run(Repo, fun)

  # Each time this process receives `:access_changed`, sends `test` whether the
  # session is still active, read on a connection outside the SQL sandbox.
  defp report_checks(test, session_id) do
    receive do
      :access_changed ->
        send(test, {:session_active?, unboxed(fn -> Session.active?(session_id) end)})
        report_checks(test, session_id)
    end
  end
end
