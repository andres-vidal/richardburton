defmodule RichardBurton.Auth.ClaimsTest do
  @moduledoc """
  Tests for OIDC ID token claim validation (issuer, audience, subject, expiry).
  """
  use ExUnit.Case, async: true

  alias RichardBurton.Auth.Claims

  @iss "https://accounts.google.com"
  @aud "client-id.apps.googleusercontent.com"
  @now 1_000_000

  defp claims(overrides \\ %{}) do
    Map.merge(
      %{
        "iss" => @iss,
        "aud" => @aud,
        "sub" => "subject-123",
        "exp" => @now + 3600
      },
      overrides
    )
  end

  test "returns the subject id when every claim is valid" do
    assert Claims.validate(claims(), @iss, @aud, @now) == {:ok, "subject-123"}
  end

  test "rejects an expired token" do
    assert Claims.validate(claims(%{"exp" => @now - 1}), @iss, @aud, @now) == :error
  end

  test "rejects a token that expires exactly now" do
    assert Claims.validate(claims(%{"exp" => @now}), @iss, @aud, @now) == :error
  end

  test "rejects a mismatched issuer" do
    assert Claims.validate(claims(%{"iss" => "https://unknown.com"}), @iss, @aud, @now) == :error
  end

  test "rejects a mismatched audience" do
    assert Claims.validate(claims(%{"aud" => "other-client"}), @iss, @aud, @now) == :error
  end

  test "rejects a missing or blank subject" do
    assert Claims.validate(Map.delete(claims(), "sub"), @iss, @aud, @now) == :error
    assert Claims.validate(claims(%{"sub" => ""}), @iss, @aud, @now) == :error
  end

  test "rejects a missing or non-integer expiry" do
    assert Claims.validate(Map.delete(claims(), "exp"), @iss, @aud, @now) == :error
    assert Claims.validate(claims(%{"exp" => "soon"}), @iss, @aud, @now) == :error
  end

  test "rejects when the issuer or audience are not configured" do
    assert Claims.validate(claims(), nil, @aud, @now) == :error
    assert Claims.validate(claims(), @iss, nil, @now) == :error
  end
end
