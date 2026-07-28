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

  defp user_fixture(email, role \\ :reader) do
    {:ok, user} = User.insert(%{"subject_id" => "sub-#{email}", "email" => email})

    case role do
      :reader ->
        user

      _ ->
        {:ok, promoted} = User.set_role(user, role)
        promoted
    end
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
  end

  describe "claim/1" do
    test "hands over the role that was waiting, and closes the invitation" do
      expect_mail()

      {:ok, {:invited, invitation}} =
        Invitation.invite(%{"email" => "invited@example.com", "role" => "contributor"})

      user = user_fixture("invited@example.com")
      claimed = Invitation.claim(user)

      assert claimed.role == :contributor
      refute is_nil(Invitation.get(invitation.id).accepted_at)
    end

    test "matches the address whatever its case" do
      expect_mail()
      {:ok, _} = Invitation.invite(%{"email" => "Invited@Example.com", "role" => "admin"})

      claimed = Invitation.claim(user_fixture("invited@example.com"))

      assert claimed.role == :admin
    end

    test "leaves an uninvited user as they are" do
      user = user_fixture("uninvited@example.com")

      assert Invitation.claim(user).role == :reader
    end

    # Redeeming it once is the point: the offer is spent, so it cannot hand the
    # role back to someone it has since been taken from.
    test "an invitation already taken up is not taken up twice" do
      expect_mail()
      {:ok, _} = Invitation.invite(%{"email" => "once@example.com", "role" => "contributor"})

      user = user_fixture("once@example.com")
      assert Invitation.claim(user).role == :contributor

      {:ok, demoted} = User.set_role(user, :reader)

      assert Invitation.claim(demoted).role == :reader
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

      Invitation.claim(user_fixture("y@example.com"))

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
