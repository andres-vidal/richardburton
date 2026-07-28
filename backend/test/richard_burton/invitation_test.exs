defmodule RichardBurton.InvitationTest do
  @moduledoc """
  Tests for offering a role to an address, and for the sign-in that redeems it
  """

  use RichardBurton.DataCase

  import Mox

  alias RichardBurton.Invitation
  alias RichardBurton.User

  setup :verify_on_exit!

  defp expect_mail(n \\ 1) do
    expect(RichardBurton.MailerMock, :send, n, fn email -> {:ok, email} end)
  end

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
end
