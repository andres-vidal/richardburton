defmodule RichardBurton.Publication.InsightsTest do
  @moduledoc """
  Tests `RichardBurton.Publication.Insights.describe/2` over every publication
  in the index and over the ones a search matches. The charts are tested in
  `RichardBurton.Publication.ChartTest`.
  """

  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Chart
  alias RichardBurton.Publication.Index
  alias RichardBurton.Publication.Insights

  setup do
    seed_index(insights_corpus())
    []
  end

  describe "describe/2" do
    test "counts the publications and the span of years they cover" do
      insights = Insights.describe()

      assert insights.publications == 7
      assert insights.years == %{first: 1886, last: 1997}
      assert insights.sourced == 2
    end

    test "counts each name once however many publications name it" do
      assert Insights.describe().totals == %{
               works: 5,
               original_authors: 3,
               translators: 6,
               publishers: 6,
               countries: 2
             }
    end

    test "draws the chart over the same publications" do
      chart = %Chart{by: :decade, split: :kind}

      assert Insights.describe(nil, chart).chart == Chart.draw(FlatPublication, chart)

      assert Insights.describe("machado", chart).chart ==
               Chart.draw(Index.matching("machado"), chart)
    end

    test "counts only the publications a search matches" do
      insights = Insights.describe("machado")

      assert insights.publications == 4
      assert insights.years == %{first: 1952, last: 1997}

      assert insights.totals == %{
               works: 2,
               original_authors: 1,
               translators: 3,
               publishers: 3,
               countries: 2
             }
    end

    test "reads operators the way the index does" do
      insights = Insights.describe("year:1980-1989")

      assert insights.publications == 2
      assert insights.totals.original_authors == 1
    end

    test "describes nothing when the search matches nothing" do
      chart = %Chart{by: :kind}

      assert Insights.describe("zzyzx", chart) == %{
               publications: 0,
               years: nil,
               totals: %{
                 works: 0,
                 original_authors: 0,
                 translators: 0,
                 publishers: 0,
                 countries: 0
               },
               sourced: 0,
               chart: Chart.nothing(chart)
             }
    end
  end
end
