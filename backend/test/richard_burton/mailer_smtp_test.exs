defmodule RichardBurton.Mailer.SMTPTest do
  @moduledoc """
  The SMTP mailer builds a Swoosh email from a `RichardBurton.Email`. Under test
  the adapter is Swoosh's test adapter (see `config/test.exs`), which delivers the
  built email to the caller's mailbox instead of opening a connection — so we
  assert on what was built.
  """
  use ExUnit.Case, async: false

  alias RichardBurton.Mailer.SMTP
  alias RichardBurton.Email

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

      assert {:ok, _} = SMTP.send(email)
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

      assert {:ok, _} = SMTP.send(email)
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

      assert {:ok, _} = SMTP.send(email)
      assert_receive {:email, sent}

      assert sent.subject == "Contact Confirmation"
      assert sent.text_body == "Thanks for reaching out"
      assert "ada@example.com" in addresses(sent.to)
    end
  end
end
