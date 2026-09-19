defmodule RichardBurtonWeb.CountryController do
  @moduledoc """
  The country lookup that backs the editor's country field: every country, or
  those a term finds, named in the language asked for.

  A country is stored as its code and shown as its name, so both travel: the id
  is what a publication holds, the label is what a reader is shown.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Country

  def index(conn, params) do
    locale = Map.get(params, "locale", "en")

    case Map.get(params, "search") do
      nil -> json(conn, Country.known(locale))
      term -> json(conn, Country.search(term, locale))
    end
  end
end
