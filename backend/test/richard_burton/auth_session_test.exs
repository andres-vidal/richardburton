defmodule RichardBurton.Auth.SessionTest do
  @moduledoc "Tests for the app's server-side (DB-backed) sessions."
  use RichardBurton.DataCase, async: true

  alias RichardBurton.Auth.Access
  alias RichardBurton.Auth.Session

  test "creates a session and verifies its token, returning the session" do
    {:ok, token} = Session.create("subject-123")
    assert {:ok, %Session{subject_id: "subject-123"}} = Session.verify(token)
  end

  test "rejects an unknown token" do
    assert Session.verify("not-a-real-token") == :error
  end

  test "rejects and prunes an expired session" do
    {:ok, token} = Session.create("subject-123")
    Repo.update_all(Session, set: [expires_at: ~U[2000-01-01 00:00:00Z]])

    assert Session.verify(token) == :error
    assert Repo.aggregate(Session, :count) == 0
  end

  test "revoke deletes the session so its token no longer verifies" do
    {:ok, token} = Session.create("subject-123")
    assert {:ok, %Session{subject_id: "subject-123"}} = Session.verify(token)

    assert {:ok, _subject_id} = Session.revoke(token)
    assert Session.verify(token) == :error
  end

  test "revoke_all removes every session for a subject only" do
    {:ok, token1} = Session.create("subject-123")
    {:ok, token2} = Session.create("subject-123")
    {:ok, other} = Session.create("subject-999")

    assert Session.revoke_all("subject-123") == :ok
    assert Session.verify(token1) == :error
    assert Session.verify(token2) == :error
    assert {:ok, %Session{subject_id: "subject-999"}} = Session.verify(other)
  end

  test "verify slides an active session's idle timeout forward" do
    {:ok, token} = Session.create("subject-123")
    # Age the session past the slide throttle, idle deadline still in the future.
    past = DateTime.utc_now() |> DateTime.add(-2 * 3600, :second) |> DateTime.truncate(:second)
    idle = DateTime.add(past, Session.idle_timeout(), :second) |> DateTime.truncate(:second)
    Repo.update_all(Session, set: [updated_at: past, expires_at: idle])

    [before] = Repo.all(from(s in Session, select: s.expires_at))
    assert {:ok, %Session{subject_id: "subject-123"}} = Session.verify(token)
    [after_slide] = Repo.all(from(s in Session, select: s.expires_at))

    assert DateTime.compare(after_slide, before) == :gt
  end

  test "verify rejects a session past its absolute cap even if recently active" do
    {:ok, token} = Session.create("subject-123")
    # Created before the absolute cap, but with a fresh idle deadline.
    old =
      DateTime.utc_now()
      |> DateTime.add(-(Session.max_age() + 60), :second)
      |> DateTime.truncate(:second)

    future = DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.truncate(:second)
    Repo.update_all(Session, set: [inserted_at: old, expires_at: future])

    assert Session.verify(token) == :error
  end

  describe "active?/1" do
    test "a live session stands" do
      {:ok, token} = Session.create("subject-123")
      {:ok, session} = Session.verify(token)

      assert Session.active?(session.id)
    end

    test "one that has been revoked does not" do
      {:ok, token} = Session.create("subject-123")
      {:ok, session} = Session.verify(token)
      Session.revoke(token)

      refute Session.active?(session.id)
    end

    test "one past its idle timeout does not, and is left for verify to prune" do
      {:ok, token} = Session.create("subject-123")
      {:ok, session} = Session.verify(token)
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:second)
      Repo.update_all(Session, set: [expires_at: past])

      refute Session.active?(session.id)
      assert Repo.aggregate(Session, :count) == 1
    end
  end

  # Revoking sessions broadcasts on the person's access topic, so each of their
  # open document channels checks its access again.
  describe "announcing a change of access" do
    setup do
      Phoenix.PubSub.subscribe(RichardBurton.PubSub, Access.topic("subject-123"))
      :ok
    end

    test "revoking a session announces it" do
      {:ok, token} = Session.create("subject-123")
      Session.revoke(token)

      assert_receive :access_changed
    end

    test "revoking all of a person's sessions announces it" do
      Session.create("subject-123")
      Session.revoke_all("subject-123")

      assert_receive :access_changed
    end

    test "revoking a token that is no session announces nothing" do
      Session.revoke("not a session")

      refute_receive :access_changed, 50
    end
  end
end
