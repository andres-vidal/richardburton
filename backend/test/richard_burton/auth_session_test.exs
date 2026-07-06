defmodule RichardBurton.Auth.SessionTest do
  @moduledoc "Tests for the app's server-side (DB-backed) sessions."
  use RichardBurton.DataCase, async: true

  alias RichardBurton.Auth.Session

  test "creates a session and verifies its token, returning the subject id" do
    {:ok, token} = Session.create("subject-123")
    assert Session.verify(token) == {:ok, "subject-123"}
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
    assert Session.verify(token) == {:ok, "subject-123"}

    assert Session.revoke(token) == :ok
    assert Session.verify(token) == :error
  end

  test "revoke_all removes every session for a subject only" do
    {:ok, token1} = Session.create("subject-123")
    {:ok, token2} = Session.create("subject-123")
    {:ok, other} = Session.create("subject-999")

    assert Session.revoke_all("subject-123") == :ok
    assert Session.verify(token1) == :error
    assert Session.verify(token2) == :error
    assert Session.verify(other) == {:ok, "subject-999"}
  end

  test "verify slides an active session's idle timeout forward" do
    {:ok, token} = Session.create("subject-123")
    # Age the session past the slide throttle, idle deadline still in the future.
    past = DateTime.utc_now() |> DateTime.add(-2 * 3600, :second) |> DateTime.truncate(:second)
    idle = DateTime.add(past, Session.idle_timeout(), :second) |> DateTime.truncate(:second)
    Repo.update_all(Session, set: [updated_at: past, expires_at: idle])

    [before] = Repo.all(from(s in Session, select: s.expires_at))
    assert Session.verify(token) == {:ok, "subject-123"}
    [after_slide] = Repo.all(from(s in Session, select: s.expires_at))

    assert DateTime.compare(after_slide, before) == :gt
  end

  test "verify rejects a session past its absolute cap even if recently active" do
    {:ok, token} = Session.create("subject-123")
    # Created before the absolute cap, but with a fresh idle deadline.
    old = DateTime.utc_now() |> DateTime.add(-(Session.max_age() + 60), :second) |> DateTime.truncate(:second)
    future = DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.truncate(:second)
    Repo.update_all(Session, set: [inserted_at: old, expires_at: future])

    assert Session.verify(token) == :error
  end
end
