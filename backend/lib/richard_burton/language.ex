defmodule RichardBurton.Language do
  @moduledoc """
  The languages a publication's notes and sources are written in: Portuguese,
  whose code is `"pt"`, and English, whose code is `"en"`.

  A publication holds each kind of text in one field per language, named
  after the kind and the language code: `notes_pt` and `notes_en`, and
  `sources_pt` and `sources_en`. `fields/1` returns those names. This module
  depends on no other, so a module can read its lists when it is compiled.
  """

  @codes ["pt", "en"]

  @doc ~S"""
  Returns the language codes, Portuguese first.

  ## Examples

      iex> RichardBurton.Language.codes()
      ["pt", "en"]
  """
  def codes, do: @codes

  @doc ~S"""
  Returns the fields that hold a publication's text of `kind`, `:notes` or
  `:sources`, one per language, in the order of `codes/0`.

  ## Examples

      iex> RichardBurton.Language.fields(:notes)
      [:notes_pt, :notes_en]

      iex> RichardBurton.Language.fields(:sources)
      [:sources_pt, :sources_en]
  """
  def fields(kind) when kind in [:notes, :sources] do
    Enum.map(@codes, &String.to_atom("#{kind}_#{&1}"))
  end
end
