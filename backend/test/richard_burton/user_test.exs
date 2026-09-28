defmodule RichardBurton.UserTest do
  @moduledoc """
  Tests for the User schema
  """

  use RichardBurton.DataCase
  import Ecto.Changeset

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
    # The change is announced to every connection this person holds open, so a
    # lower role reaches a document channel already joined, and not only the next
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
end
