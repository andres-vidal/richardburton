defmodule RichardBurton.Auth.ClaimsTest do
  @moduledoc """
  Tests for OIDC ID token claim validation (issuer, audience, subject, expiry,
  and the verified email a role is granted to).
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
        "exp" => @now + 3600,
        "email" => "reader@example.com",
        "email_verified" => true
      },
      overrides
    )
  end

  test "returns the identity when every claim is valid" do
    assert Claims.validate(claims(), @iss, @aud, @now) ==
             {:ok, %{subject_id: "subject-123", email: "reader@example.com"}}
  end

  # A role is granted to an address, so an address the provider will not vouch
  # for is one this cannot act on.
  test "rejects an unverified email" do
    assert Claims.validate(claims(%{"email_verified" => false}), @iss, @aud, @now) == :error
    assert Claims.validate(claims(%{"email_verified" => "true"}), @iss, @aud, @now) == :error
    assert Claims.validate(Map.delete(claims(), "email_verified"), @iss, @aud, @now) == :error
  end

  test "rejects a missing or blank email" do
    assert Claims.validate(Map.delete(claims(), "email"), @iss, @aud, @now) == :error
    assert Claims.validate(claims(%{"email" => ""}), @iss, @aud, @now) == :error
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
