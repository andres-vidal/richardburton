defmodule RichardBurton.MailerTest do
  @moduledoc """
  Tests for the Swoosh email the mailer builds from a `RichardBurton.Email`,
  and for what it returns when the adapter fails. The adapter under test is
  Swoosh's test adapter (see `config/test.exs`), which sends the built email
  to the calling process.
  """
  use ExUnit.Case, async: false

  import Swoosh.TestAssertions

  alias RichardBurton.Email
  alias RichardBurton.FailingMailAdapter
  alias RichardBurton.Mailer

  # A Swoosh adapter that raises, as Swoosh's SMTP adapter does when its relay
  # is not configured.
  defmodule RaisingAdapter do
    use Swoosh.Adapter

    @impl true
    def deliver(_email, _config), do: raise(ArgumentError, "expected :relay to be set")
  end

  setup do
    put_env("SMTP_NAME", "Burton Platform")
    put_env("SMTP_FROM", "noreply@burton.test")
    put_env("SMTP_ADMIN_INBOX", "admin@burton.test")
    :ok
  end

  defp put_env(name, value) do
    original = System.get_env(name)
    System.put_env(name, value)

    on_exit(fn ->
      if original, do: System.put_env(name, original), else: System.delete_env(name)
    end)
  end

  defp addresses(recipients), do: Enum.map(recipients, fn {_name, address} -> address end)

  describe "a contact-form email (no :to)" do
    test "goes to the admin inbox, replying to the sender, with a composed subject" do
      email = %Email{
        name: "Ada Lovelace",
        institution: "IFRS",
        address: "ada@example.com",
        subject: "A question",
        message: "Hello there",
        to: nil
      }

      assert {:ok, _} = Mailer.send(email)
      assert_receive {:email, sent}

      assert sent.subject == "A question (from Ada Lovelace (IFRS)<ada@example.com>)"
      assert sent.text_body == "Hello there"
      assert "admin@burton.test" in addresses(sent.to)
      assert {_, "ada@example.com"} = sent.reply_to
      assert {_, "noreply@burton.test"} = sent.from
    end

    test "omits the institution from the subject when it is blank" do
      email = %Email{
        name: "Ada Lovelace",
        institution: "",
        address: "ada@example.com",
        subject: "A question",
        message: "Hello",
        to: nil
      }

      assert {:ok, _} = Mailer.send(email)
      assert_receive {:email, sent}

      assert sent.subject == "A question (from Ada Lovelace<ada@example.com>)"
    end
  end

  describe "a transactional email (with :to)" do
    test "goes to the given recipient with the subject verbatim" do
      email = %Email{
        name: "Burton Platform",
        institution: "IFRS",
        address: "noreply@burton.test",
        subject: "Contact Confirmation",
        message: "Thanks for reaching out",
        to: "ada@example.com"
      }

      assert {:ok, _} = Mailer.send(email)
      assert_receive {:email, sent}

      assert sent.subject == "Contact Confirmation"
      assert sent.text_body == "Thanks for reaching out"
      assert "ada@example.com" in addresses(sent.to)
    end
  end

  test "returns the adapter's error when the email cannot be sent" do
    FailingMailAdapter.install()

    email = %Email{
      name: "Ada Lovelace",
      address: "ada@example.com",
      subject: "A question",
      message: "Hello",
      to: nil
    }

    assert Mailer.send(email) == {:error, "smtp is down"}
    assert_no_email_sent()
  end

  test "returns the exception when the adapter raises" do
    previous = Application.fetch_env!(:richard_burton, :mailer_adapter)
    Application.put_env(:richard_burton, :mailer_adapter, RaisingAdapter)
    on_exit(fn -> Application.put_env(:richard_burton, :mailer_adapter, previous) end)

    email = %Email{name: "Ada", address: "ada@example.com", subject: "Hi", message: "Hello"}

    assert {:error, %ArgumentError{}} = Mailer.send(email)
  end
end
