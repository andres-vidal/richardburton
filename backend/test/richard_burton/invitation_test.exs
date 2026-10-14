defmodule RichardBurton.InvitationTest do
  @moduledoc """
  Tests for offering a role to an address, and for the sign-in that redeems it
  """

  use RichardBurton.DataCase

  import Swoosh.TestAssertions

  alias Ecto.Adapters.SQL.Sandbox
  alias RichardBurton.Auth.Access
  alias RichardBurton.FailingMailAdapter
  alias RichardBurton.Invitation
  alias RichardBurton.User
  alias RichardBurton.Validation

  # Sets `name` back to `value`, or unsets it when `value` is nil.
  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)

  describe "invite/2 for someone who has never signed in" do
    test "records the offer and mails it" do
      assert {:ok, {:invited, invitation}} =
               Invitation.invite(%{"email" => "new@example.com", "role" => "contributor"})

      assert invitation.email == "new@example.com"
      assert invitation.role == :contributor
      assert is_nil(invitation.accepted_at)
      assert_email_sent(to: "new@example.com")
    end

    test "names the admin who sent it" do
      admin = user_fixture("admin@example.com", :admin)

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "new@example.com", "role" => "admin"}, admin)

      assert invitation.invited_by_id == admin.id
    end

    # The invitation is what grants the role, so it is kept when the mail
    # cannot be sent, and `resend/1` can send it later.
    test "stands even when the mail cannot be sent" do
      FailingMailAdapter.install()

      assert {:ok, {:unsent, invitation}} =
               Invitation.invite(%{"email" => "new@example.com", "role" => "contributor"})

      refute is_nil(Invitation.get(invitation.id))
    end

    test "refuses an address that is not one" do
      assert {:error, changeset} =
               Invitation.invite(%{"email" => "not-an-email", "role" => "admin"})

      assert %{email: :invalid} == Validation.get_errors(changeset)
    end

    test "refuses a role that is not one, or no role, and records nothing" do
      assert {:error, :invalid_role} =
               Invitation.invite(%{"email" => "new@example.com", "role" => "wizard"})

      assert {:error, :invalid_role} = Invitation.invite(%{"email" => "new@example.com"})
      assert Invitation.all() == []
    end

    # One address waits on one offer, whatever case it is written in.
    test "refuses a second pending invitation for the same address" do
      {:ok, _} = Invitation.invite(%{"email" => "new@example.com", "role" => "reader"})

      assert {:error, :pending} =
               Invitation.invite(%{"email" => "NEW@example.com", "role" => "admin"})
    end
  end

  describe "the invitation email" do
    setup do
      previous = System.get_env("APP_URL")
      on_exit(fn -> restore_env("APP_URL", previous) end)
    end

    test "says the same thing in Portuguese, then in English" do
      System.put_env("APP_URL", "https://riburton.example.org")

      Invitation.invite(%{"email" => "new@example.com", "role" => "contributor"})

      assert_received {:email, email}
      assert email.to == [{"", "new@example.com"}]
      assert email.subject =~ "Convite para a Plataforma Richard & Isabel Burton"
      assert email.subject =~ "Invitation to the Richard & Isabel Burton Platform"

      assert [portuguese, english] = String.split(email.text_body, "\n---\n")
      assert portuguese =~ "como colaborador, que pode acrescentar e corrigir publicações"
      assert portuguese =~ "Entre com o Google em https://riburton.example.org"
      assert portuguese =~ "(new@example.com)"
      assert english =~ "as a contributor, who can add and correct publications"
      assert english =~ "Sign in with Google at https://riburton.example.org"
      assert english =~ "(new@example.com)"
    end

    test "names the admin who sent it, in both languages" do
      admin = user_fixture("admin@example.com", :admin)

      Invitation.invite(%{"email" => "new@example.com", "role" => "admin"}, admin)

      assert_received {:email, email}
      assert email.text_body =~ "Burton por admin@example.com como administrador"
      assert email.text_body =~ "Burton Platform by admin@example.com as an administrator"
    end

    test "points at the platform in general when APP_URL is unset or empty" do
      System.delete_env("APP_URL")
      Invitation.invite(%{"email" => "unset@example.com", "role" => "reader"})
      System.put_env("APP_URL", "")
      Invitation.invite(%{"email" => "empty@example.com", "role" => "reader"})

      for _ <- 1..2 do
        assert_received {:email, email}
        assert email.text_body =~ "Entre na plataforma com o Google usando este endereço"
        assert email.text_body =~ "Sign in to the platform with Google using this address"
      end
    end
  end

  describe "invite/2 for someone who is already here" do
    test "gives them the role outright, with nothing left to wait for" do
      user = user_fixture("here@example.com")

      assert {:ok, {:granted, updated}} =
               Invitation.invite(%{"email" => "here@example.com", "role" => "contributor"})

      assert updated.id == user.id
      assert updated.role == :contributor
      assert Invitation.all() == []
    end

    test "matches the address whatever its case" do
      user_fixture("here@example.com")

      assert {:ok, {:granted, updated}} =
               Invitation.invite(%{"email" => "HERE@Example.com", "role" => "admin"})

      assert updated.role == :admin
    end

    test "refuses the inviter their own address" do
      admin = user_fixture("admin@example.com", :admin)

      assert {:error, :self} =
               Invitation.invite(%{"email" => "admin@example.com", "role" => "reader"}, admin)

      assert User.get_by_email("admin@example.com").role == :admin
    end

    test "refuses a role that is not one" do
      user_fixture("here@example.com")

      assert {:error, :invalid_role} =
               Invitation.invite(%{"email" => "here@example.com", "role" => "wizard"})
    end
  end

  describe "admit/2" do
    test "makes the account, with the role that was waiting, and closes the offer" do
      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "invited@example.com", "role" => "contributor"})

      assert {:ok, user} = Invitation.admit("sub-1", "invited@example.com")

      assert user.role == :contributor
      assert user.email == "invited@example.com"
      refute is_nil(Invitation.get(invitation.id).accepted_at)
    end

    test "matches the address whatever its case" do
      {:ok, _} = Invitation.invite(%{"email" => "Invited@Example.com", "role" => "admin"})

      assert {:ok, user} = Invitation.admit("sub-1", "invited@example.com")
      assert user.role == :admin
    end

    # Anyone may hold a Google account. If signing in made an account here for
    # anyone, revoking an account would mean nothing, since the next sign-in
    # would make another.
    test "refuses someone who was never invited, and makes no account for them" do
      assert Invitation.admit("sub-stranger", "stranger@example.com") == :not_invited
      assert is_nil(User.get("sub-stranger"))
    end

    test "admits someone who has been here before on their account alone" do
      user = user_fixture("known@example.com", :contributor)

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :contributor
    end

    # An accepted invitation is not taken up again, so it cannot give the role
    # back to someone whose role was lowered since.
    test "an invitation already taken up is not taken up twice" do
      {:ok, _} = Invitation.invite(%{"email" => "once@example.com", "role" => "contributor"})

      {:ok, user} = Invitation.admit("sub-1", "once@example.com")
      assert user.role == :contributor

      {:ok, _demoted} = User.set_role(user, :reader)

      assert {:ok, again} = Invitation.admit("sub-1", "once@example.com")
      assert again.role == :reader
    end

    # The development sign-in and the seeds make accounts without an
    # invitation, so an address can have both an account and a pending
    # invitation. The next sign-in takes the invitation up.
    test "honours an offer that was waiting when the account arrived another way" do
      {:ok, _} = Invitation.invite(%{"email" => "here@example.com", "role" => "admin"})

      user = user_fixture("here@example.com")

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :admin
    end

    test "keeps an existing account's role when the offer waiting for it is lower, and closes the offer" do
      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "here@example.com", "role" => "reader"})

      user = user_fixture("here@example.com", :contributor)

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :contributor
      assert User.get(user.subject_id).role == :contributor
      refute is_nil(Invitation.get(invitation.id).accepted_at)
    end

    test "admits the last admin as an admin when the offer waiting for them is lower" do
      {:ok, _} = Invitation.invite(%{"email" => "here@example.com", "role" => "contributor"})

      user = user_fixture("here@example.com", :admin)

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :admin
    end

    # Tests that a subscriber which reads after the announcement finds the
    # raised role. A subscriber reads on its own database connection, so it only
    # sees committed rows. The test reads the same way, on a connection outside
    # the SQL sandbox, because inside the sandbox every process shares the
    # test's connection.
    #
    # The rows the test commits are deleted by `on_exit`. This module is not
    # async, so no other test runs while those rows exist.
    test "announces the raised role after it commits" do
      subject_id = "sub-raised@example.com"
      email = "raised@example.com"

      on_exit(fn ->
        unboxed(fn ->
          Repo.delete_all(from(i in Invitation, where: i.email == ^email))
          Repo.delete_all(from(u in User, where: u.subject_id == ^subject_id))
        end)
      end)

      unboxed(fn ->
        {:ok, _} = User.insert(%{"subject_id" => subject_id, "email" => email})
        Repo.insert!(%Invitation{email: email, role: :contributor})
      end)

      test = self()

      spawn_link(fn ->
        Phoenix.PubSub.subscribe(RichardBurton.PubSub, Access.topic(subject_id))
        send(test, :listening)
        report_roles(test, subject_id)
      end)

      assert_receive :listening
      {:ok, _} = unboxed(fn -> Invitation.admit(subject_id, email) end)

      assert_receive {:role, :contributor}
    end
  end

  describe "cancel/1 and resend/1" do
    test "a pending invitation can be withdrawn" do
      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "x@example.com", "role" => "reader"})

      assert {:ok, _} = Invitation.cancel(invitation)
      assert is_nil(Invitation.get(invitation.id))
    end

    test "one already taken up cannot be withdrawn or sent again" do
      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "y@example.com", "role" => "reader"})

      {:ok, _} = Invitation.admit("sub-y", "y@example.com")

      accepted = Invitation.get(invitation.id)

      assert Invitation.cancel(accepted) == {:error, :accepted}
      assert Invitation.resend(accepted) == {:error, :accepted}
    end

    test "a pending invitation can be sent again" do
      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "z@example.com", "role" => "reader"})

      assert {:ok, ^invitation} = Invitation.resend(invitation)
      assert_email_sent(to: "z@example.com")
      assert_email_sent(to: "z@example.com")
    end

    test "says so when the mail cannot be sent again, and keeps the invitation" do
      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "z@example.com", "role" => "reader"})

      FailingMailAdapter.install()

      assert Invitation.resend(invitation) == {:error, :unsent}
      refute is_nil(Invitation.get(invitation.id))
    end
  end

  # Runs `fun` on a connection outside the SQL sandbox, so its writes commit.
  defp unboxed(fun), do: Sandbox.unboxed_run(Repo, fun)

  # Each time this process receives `:access_changed`, sends `test` the role of
  # the user with `subject_id`, read on a connection outside the SQL sandbox.
  defp report_roles(test, subject_id) do
    receive do
      :access_changed ->
        send(test, {:role, unboxed(fn -> User.get(subject_id).role end)})
        report_roles(test, subject_id)
    end
  end
end
