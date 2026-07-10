defmodule RichardBurton.Auth.CsrfTest do
  use ExUnit.Case, async: true

  alias RichardBurton.Auth.Csrf

  describe "sign/1 and verify/1" do
    test "a signed token verifies back to its subject" do
      token = Csrf.sign("subject-123")
      assert Csrf.verify(token) == {:ok, "subject-123"}
    end

    test "a tampered token is rejected" do
      token = Csrf.sign("subject-123")
      assert {:error, _} = Csrf.verify(token <> "tampered")
    end

    test "a non-token value is rejected" do
      assert {:error, _} = Csrf.verify("not-a-token")
      assert {:error, :invalid} = Csrf.verify(nil)
    end
  end
end
