defmodule RichardBurton.Auth.SessionTest do
  @moduledoc "Tests for the app's own (Phoenix.Token) session tokens."
  use ExUnit.Case, async: true

  alias RichardBurton.Auth.Session

  test "verifies a token it just signed and returns the subject id" do
    token = Session.sign("subject-123")
    assert Session.verify(token) == {:ok, "subject-123"}
  end

  test "rejects a tampered or unrelated token" do
    assert Session.verify("not-a-real-token") == :error
  end

  test "rejects an expired token" do
    # signed_at at the epoch is far older than max_age, so it is expired.
    token = Session.sign("subject-123", signed_at: 0)
    assert Session.verify(token) == :error
  end
end
