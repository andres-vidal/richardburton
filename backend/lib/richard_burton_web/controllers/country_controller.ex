defmodule RichardBurtonWeb.CountryController do
  @moduledoc """
  Lists the countries, named in the language of the `locale` parameter.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Country

  @doc """
  Responds with the countries that `RichardBurton.Country.search/2` finds for
  the `search` parameter, or with every country when there is no search. Each
  country holds its code as `id` and its name in `locale` as `label`. A missing
  or unknown locale is read as English.
  """
  def index(conn, params) do
    locale = params["locale"]

    case params["search"] do
      nil -> json(conn, Country.known(locale))
      term -> json(conn, Country.search(term, locale))
    end
  end
end
