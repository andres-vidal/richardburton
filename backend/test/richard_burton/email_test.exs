defmodule RichardBurton.EmailTest do
  @moduledoc """
  Tests for the Email schema/changeset
  """
  use RichardBurton.DataCase

  alias RichardBurton.Email

  @valid_params %{
    "name" => "João Silva",
    "institution" => "IFRS Canoas",
    "address" => "johndoe@canoas.ifrs.edu.br",
    "subject" => "Olá",
    "message" => "Olá, mundo!"
  }

  describe "changeset/2" do
    test "is valid with all the expected fields" do
      changeset = Email.changeset(%Email{}, @valid_params)
      assert changeset.valid?
    end

    test "ignores a client-supplied :to (open-relay guard)" do
      params = Map.put(@valid_params, "to", "victim@example.com")

      changeset = Email.changeset(%Email{}, params)

      assert changeset.valid?
      # :to must never be settable from request params; it is set server-side only.
      refute Map.has_key?(changeset.changes, :to)
      assert is_nil(Ecto.Changeset.get_field(changeset, :to))
    end
  end
end
