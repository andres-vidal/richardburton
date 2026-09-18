defmodule RichardBurton.Publication.Index.Highlight do
  @moduledoc """
  Shows why a row is in a result when the reason is not on screen.

  A publication can match on its sources, which the index does not display, so a
  row can look unrelated to what was searched. When that happens the matching
  source is returned as a snippet with the matched words wrapped in `[[ ]]`, in
  the row's virtual `source_match` field.

  Only whole-row reads carry it: an export narrowed to named columns asks for no
  snippet.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index.Query

  @headline "StartSel=[[,StopSel=]],MaxFragments=1,MaxWords=16,MinWords=6"

  @doc """
  The ask to highlight a row's sources with.

  Built from the words the search already resolved to, which came back with the
  ids, so a page highlights without resolving the term again. A spelled-out term
  carries no keywords and is highlighted exactly as written.
  """
  def asked(term, keywords) do
    if Query.spelled_out?(term) do
      {:spelled_out, term}
    else
      {:parsed, Enum.map_join(keywords, " | ", &Query.lexeme/1)}
    end
  end

  @doc """
  Adds the snippet to a query, when the read is of whole rows.

  A query narrowed to named attributes is returned untouched.
  """
  def select(query, [], {:parsed, term}), do: snippet(query, "to_tsquery", term)
  def select(query, [], {:spelled_out, term}), do: snippet(query, "websearch_to_tsquery", term)
  def select(query, _attributes, _ask), do: query

  # The source text is matched and headlined with the same query function, so a
  # row is highlighted by whatever found it.
  defp snippet(query, "to_tsquery", term) do
    select_merge(query, [p], %{
      source_match:
        fragment(
          "CASE WHEN to_tsvector('rb_search', array_to_string(?, ' ')) @@ to_tsquery('rb_search', ?) THEN ts_headline('rb_search', array_to_string(?, ' '), to_tsquery('rb_search', ?), ?) ELSE NULL END",
          p.references,
          ^term,
          p.references,
          ^term,
          ^@headline
        )
    })
  end

  defp snippet(query, "websearch_to_tsquery", term) do
    select_merge(query, [p], %{
      source_match:
        fragment(
          "CASE WHEN to_tsvector('rb_search', array_to_string(?, ' ')) @@ websearch_to_tsquery('rb_search', ?) THEN ts_headline('rb_search', array_to_string(?, ' '), websearch_to_tsquery('rb_search', ?), ?) ELSE NULL END",
          p.references,
          ^term,
          p.references,
          ^term,
          ^@headline
        )
    })
  end
end
