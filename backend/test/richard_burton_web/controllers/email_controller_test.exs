defmodule RichardBurtonWeb.EmailControllerTest do
  @moduledoc """
  Tests for the contact form's endpoint.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [email_path: 2]
  import Swoosh.TestAssertions

  alias RichardBurton.FailingMailAdapter

  describe "POST /contact" do
    test "returns 200 and a success message when all the fields are sent", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "name" => "João Silva",
        "institution" => "IFRS Canoas",
        "address" => "johndoe@canoas.ifrs.edu.br",
        "subject" => "Olá",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"message" => "Email sent."} == json_response(conn, 200)
      assert_email_sent(to: "inbox@richardburton.test")
      assert_email_sent(to: "johndoe@canoas.ifrs.edu.br")
    end

    test "returns 200 and a success message when only the institution is omitted", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "name" => "João Silva",
        "address" => "johndoe@canoas.ifrs.edu.br",
        "subject" => "Olá",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"message" => "Email sent."} == json_response(conn, 200)
      assert_email_sent(to: "inbox@richardburton.test")
      assert_email_sent(to: "johndoe@canoas.ifrs.edu.br")
    end

    test "returns 502 unsent when the message cannot be sent", %{conn: conn} do
      expect_auth_recaptcha_verify(1)
      FailingMailAdapter.install()

      params = %{
        "name" => "João Silva",
        "address" => "johndoe@canoas.ifrs.edu.br",
        "subject" => "Olá",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"error" => "unsent"} == json_response(conn, 502)
      assert_no_email_sent()
    end

    test "returns 400 when the sender's name is omitted", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "address" => "johndoe@canoas.ifrs.edu.br",
        "subject" => "Olá",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"errors" => %{"name" => "required"}} == json_response(conn, 400)
      assert_no_email_sent()
    end

    test "returns 400 when the sender's email is omitted", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "name" => "João Silva",
        "subject" => "Olá",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"errors" => %{"address" => "required"}} == json_response(conn, 400)
      assert_no_email_sent()
    end

    test "returns 400 when the sender's email is invalid", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "name" => "João Silva",
        "address" => "a",
        "subject" => "Olá",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"errors" => %{"address" => "invalid"}} == json_response(conn, 400)
      assert_no_email_sent()
    end

    test "returns 400 when the subject is omitted", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "name" => "João Silva",
        "address" => "johndoe@canoas.ifrs.edu.br",
        "message" => "Olá, mundo!",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"errors" => %{"subject" => "required"}} == json_response(conn, 400)
      assert_no_email_sent()
    end

    test "returns 400 when the message is omitted", %{conn: conn} do
      expect_auth_recaptcha_verify(1)

      params = %{
        "name" => "João Silva",
        "address" => "johndoe@canoas.ifrs.edu.br",
        "subject" => "Olá",
        "recaptcha_token" => "token"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"errors" => %{"message" => "required"}} == json_response(conn, 400)
      assert_no_email_sent()
    end

    test "returns 403 invalid_captcha when the recaptcha token is omitted", %{conn: conn} do
      expect_auth_recaptcha_verify(0)

      params = %{
        "name" => "João Silva",
        "address" => "johndoe@canoas.ifrs.edu.br",
        "subject" => "Olá",
        "message" => "Olá, mundo!"
      }

      conn = post(conn, email_path(conn, :contact), params)

      assert %{"error" => "invalid_captcha"} == json_response(conn, 403)
      assert_no_email_sent()
    end
  end
end
