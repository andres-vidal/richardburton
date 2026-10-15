defmodule RichardBurton.EmailTest do
  @moduledoc """
  Tests for the contact form's changeset, and for sending a contact-form
  message and its confirmation.
  """
  use RichardBurton.DataCase

  import Swoosh.TestAssertions

  alias RichardBurton.Email
  alias RichardBurton.FailingMailAdapter
  alias RichardBurton.Validation

  # A Swoosh adapter that sends mail to the research team's inbox, as the test
  # adapter does, and fails to send any other mail.
  defmodule InboxOnlyAdapter do
    use Swoosh.Adapter

    @impl true
    def deliver(email = %{to: [{_, "inbox@richardburton.test"}]}, config),
      do: Swoosh.Adapters.Test.deliver(email, config)

    def deliver(_email, _config), do: {:error, "smtp is down"}
  end

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

    # A `to` taken from the params would let anyone send mail through the
    # platform to any address.
    test "does not cast :to, so the params cannot choose the recipient" do
      params = Map.put(@valid_params, "to", "victim@example.com")

      changeset = Email.changeset(%Email{}, params)

      assert changeset.valid?
      refute Map.has_key?(changeset.changes, :to)
      assert is_nil(Ecto.Changeset.get_field(changeset, :to))
    end
  end

  describe "contact/1" do
    test "sends the message to the research team, then a confirmation to the writer" do
      assert Email.contact(@valid_params) == :ok

      assert_email_sent(to: "inbox@richardburton.test")
      assert_email_sent(to: "johndoe@canoas.ifrs.edu.br")
    end

    test "returns the changeset when a field is invalid, and sends nothing" do
      assert {:error, changeset} = Email.contact(Map.delete(@valid_params, "subject"))

      assert %{subject: :required} == Validation.get_errors(changeset)
      assert_no_email_sent()
    end

    test "returns :unsent when the message cannot be sent" do
      FailingMailAdapter.install()

      assert Email.contact(@valid_params) == {:error, :unsent}
    end

    # The message has reached the research team, so a confirmation that fails
    # to send does not make the call fail.
    test "succeeds when only the confirmation cannot be sent" do
      previous = Application.fetch_env!(:richard_burton, :mailer_adapter)
      Application.put_env(:richard_burton, :mailer_adapter, InboxOnlyAdapter)
      on_exit(fn -> Application.put_env(:richard_burton, :mailer_adapter, previous) end)

      assert Email.contact(@valid_params) == :ok
      assert_email_sent(to: "inbox@richardburton.test")
    end
  end

  describe "deliver/1" do
    test "sends a message from the platform to the given address" do
      assert Email.deliver(to: "ada@example.com", subject: "Hello", message: "Hi") == :ok

      assert_email_sent(to: "ada@example.com", subject: "Hello", text_body: "Hi")
    end

    test "returns :unsent when the message cannot be sent" do
      FailingMailAdapter.install()

      assert Email.deliver(to: "ada@example.com", subject: "Hello", message: "Hi") ==
               {:error, :unsent}
    end
  end
end
