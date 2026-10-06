defmodule RichardBurton.InvitationTest do
  @moduledoc """
  Tests for offering a role to an address, and for the sign-in that redeems it
  """

  use RichardBurton.DataCase

  import Mox

  alias Ecto.Adapters.SQL.Sandbox
  alias RichardBurton.Auth.Access
  alias RichardBurton.Invitation
  alias RichardBurton.User

  setup :verify_on_exit!

  defp expect_mail(n \\ 1) do
    expect(RichardBurton.MailerMock, :send, n, fn email -> {:ok, email} end)
  end

  # Expects `n` emails, and sends each to the test process as `{:mailed, email}`.
  defp capture_mail(n \\ 1) do
    test = self()

    expect(RichardBurton.MailerMock, :send, n, fn email ->
      send(test, {:mailed, email})
      {:ok, email}
    end)
  end

  # Sets `name` back to `value`, or unsets it when `value` is nil.
  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)

  describe "invite/2 for someone who has never signed in" do
    test "records the offer and mails it" do
      expect_mail()

      assert {:ok, {:invited, invitation}} =
               Invitation.invite(%{"email" => "new@example.com", "role" => "contributor"})

      assert invitation.email == "new@example.com"
      assert invitation.role == :contributor
      assert is_nil(invitation.accepted_at)
    end

    test "names the admin who sent it" do
      expect_mail()
      admin = user_fixture("admin@example.com", :admin)

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "new@example.com", "role" => "admin"}, admin)

      assert invitation.invited_by_id == admin.id
    end

    # The offer is what grants the role, so it must survive a mail server having
    # a bad day — the dashboard says it went unsent and can send it again.
    test "stands even when the mail cannot be sent" do
      expect(RichardBurton.MailerMock, :send, fn _ -> {:error, "smtp is down"} end)

      assert {:ok, {:unsent, invitation}} =
               Invitation.invite(%{"email" => "new@example.com", "role" => "contributor"})

      refute is_nil(Invitation.get(invitation.id))
    end

    test "refuses an address that is not one" do
      assert {:error, errors} = Invitation.invite(%{"email" => "not-an-email", "role" => "admin"})
      assert errors[:email]
    end

    # One address waits on one offer, whatever case it is written in.
    test "refuses a second pending invitation for the same address" do
      expect_mail()
      {:ok, _} = Invitation.invite(%{"email" => "new@example.com", "role" => "reader"})

      assert {:error, :conflict} =
               Invitation.invite(%{"email" => "NEW@example.com", "role" => "admin"})
    end
  end

  describe "the invitation email" do
    setup do
      previous = System.get_env("APP_URL")
      on_exit(fn -> restore_env("APP_URL", previous) end)
    end

    test "says the same thing in Portuguese, then in English" do
      capture_mail()
      System.put_env("APP_URL", "https://riburton.example.org")

      Invitation.invite(%{"email" => "new@example.com", "role" => "contributor"})

      assert_received {:mailed, email}
      assert email.to == "new@example.com"
      assert email.subject =~ "Convite para a Plataforma Richard & Isabel Burton"
      assert email.subject =~ "Invitation to the Richard & Isabel Burton Platform"

      assert [portuguese, english] = String.split(email.message, "\n---\n")
      assert portuguese =~ "como colaborador, que pode acrescentar e corrigir publicações"
      assert portuguese =~ "Entre com o Google em https://riburton.example.org"
      assert portuguese =~ "(new@example.com)"
      assert english =~ "as a contributor, who can add and correct publications"
      assert english =~ "Sign in with Google at https://riburton.example.org"
      assert english =~ "(new@example.com)"
    end

    test "names the admin who sent it, in both languages" do
      capture_mail()
      admin = user_fixture("admin@example.com", :admin)

      Invitation.invite(%{"email" => "new@example.com", "role" => "admin"}, admin)

      assert_received {:mailed, email}
      assert email.message =~ "Burton por admin@example.com como administrador"
      assert email.message =~ "Burton Platform by admin@example.com as an administrator"
    end

    test "points at the platform in general when APP_URL is unset or empty" do
      capture_mail(2)

      System.delete_env("APP_URL")
      Invitation.invite(%{"email" => "unset@example.com", "role" => "reader"})
      System.put_env("APP_URL", "")
      Invitation.invite(%{"email" => "empty@example.com", "role" => "reader"})

      for _ <- 1..2 do
        assert_received {:mailed, email}
        assert email.message =~ "Entre na plataforma com o Google usando este endereço"
        assert email.message =~ "Sign in to the platform with Google using this address"
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
      expect_mail()

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "invited@example.com", "role" => "contributor"})

      assert {:ok, user} = Invitation.admit("sub-1", "invited@example.com")

      assert user.role == :contributor
      assert user.email == "invited@example.com"
      refute is_nil(Invitation.get(invitation.id).accepted_at)
    end

    test "matches the address whatever its case" do
      expect_mail()
      {:ok, _} = Invitation.invite(%{"email" => "Invited@Example.com", "role" => "admin"})

      assert {:ok, user} = Invitation.admit("sub-1", "invited@example.com")
      assert user.role == :admin
    end

    # Anyone may hold a Google account. If signing in made one here regardless,
    # who has an account would be decided by whoever tries — and revoking one
    # would mean nothing, since the next sign-in would make another.
    test "refuses someone who was never invited, and makes no account for them" do
      assert Invitation.admit("sub-stranger", "stranger@example.com") == :not_invited
      assert is_nil(User.get("sub-stranger"))
    end

    test "admits someone who has been here before on their account alone" do
      user = user_fixture("known@example.com", :contributor)

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :contributor
    end

    # Redeeming it once is the point: the offer is spent, so it cannot hand the
    # role back to someone it has since been taken from.
    test "an invitation already taken up is not taken up twice" do
      expect_mail()
      {:ok, _} = Invitation.invite(%{"email" => "once@example.com", "role" => "contributor"})

      {:ok, user} = Invitation.admit("sub-1", "once@example.com")
      assert user.role == :contributor

      {:ok, _demoted} = User.set_role(user, :reader)

      assert {:ok, again} = Invitation.admit("sub-1", "once@example.com")
      assert again.role == :reader
    end

    # An offer can outlive the address having no account: the dev provider and
    # the seeds make accounts without going through here. The next sign-in
    # should hand over what was waiting rather than step past it.
    test "honours an offer that was waiting when the account arrived another way" do
      expect_mail()
      {:ok, _} = Invitation.invite(%{"email" => "here@example.com", "role" => "admin"})

      user = user_fixture("here@example.com")

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :admin
    end

    test "keeps an existing account's role when the offer waiting for it is lower, and closes the offer" do
      expect_mail()

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "here@example.com", "role" => "reader"})

      user = user_fixture("here@example.com", :contributor)

      assert {:ok, admitted} = Invitation.admit(user.subject_id, user.email)
      assert admitted.role == :contributor
      assert User.get(user.subject_id).role == :contributor
      refute is_nil(Invitation.get(invitation.id).accepted_at)
    end

    test "admits the last admin as an admin when the offer waiting for them is lower" do
      expect_mail()
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
      expect_mail()

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "x@example.com", "role" => "reader"})

      assert {:ok, _} = Invitation.cancel(invitation)
      assert is_nil(Invitation.get(invitation.id))
    end

    test "one already taken up cannot be withdrawn or sent again" do
      expect_mail()

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "y@example.com", "role" => "reader"})

      {:ok, _} = Invitation.admit("sub-y", "y@example.com")

      accepted = Invitation.get(invitation.id)

      assert Invitation.cancel(accepted) == {:error, :already_accepted}
      assert Invitation.resend(accepted) == {:error, :already_accepted}
    end

    test "a pending invitation can be sent again" do
      expect_mail(2)

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "z@example.com", "role" => "reader"})

      assert {:ok, ^invitation} = Invitation.resend(invitation)
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
