defmodule RichardBurton.Publication.IndexTest do
  @moduledoc """
  Tests for the Publication.Index module
  """

  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Util

  @publications [
    %FlatPublication{
      authors: "Arthur Brakel",
      countries: "CA",
      countries_fingerprint: "4B650E5C4785025DEE7BD65E3C5C527356717D7A1C0BFEF5B4ADA8CA1E9CBE17",
      original_authors: "Cyro dos Anjos",
      original_title: "O amanuense Belmiro",
      publishers: "Fairleigh Dickinson University Press",
      publishers_fingerprint: "BDBBE0C6ACE0F5D7CDAC2301CBD7DDE19808618AF03AB6B6546FF30A82F4FA5E",
      title: "Diary of a Civil Servant",
      year: 1986
    },
    %FlatPublication{
      authors: "Arthur Brakel",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Cyro dos Anjos",
      original_title: "O amanuense Belmiro",
      publishers: "Associated University Presses",
      publishers_fingerprint: "FA1B59EB992D97EB10B6219661EA4C9C740D509048CC0DF9A86EB3BC8EB8E45B",
      title: "Diary of a Civil Servant",
      year: 1988
    },
    %FlatPublication{
      authors: "Dorothy Scott Loos",
      countries: "GB, US",
      countries_fingerprint: "F060274D35CC0709781F13A9331376B035C9A04546FE43381BC5749F1362C8BF",
      original_authors: "Rachel de Queiroz",
      original_title: "Dora Doralina",
      publishers: "Dutton",
      publishers_fingerprint: "289485905D12E66D52118BCFECB6C911B1A8E4379477DD98ED30F2ED795E260C",
      title: "Dora Doralina",
      year: 1984
    },
    %FlatPublication{
      authors: "E. Percy Ellis",
      countries: "BR",
      countries_fingerprint: "BBAF8352442730E92C16C5EA6B0FF7CC595C24E02D8E8BFC5FEA5A4E0BB0B46B",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "Instituto Nacional do Livro",
      publishers_fingerprint: "CFC153F1AB2F32958A66F3F4B36EECFFDF8A28C48F202DE09FFEFF6BE98F1027",
      title: "Posthumous Reminiscences of Brás Cubas",
      year: 1955,
      references: [
        "Caldwell, Helen. Machado de Assis: The Brazilian Master. Berkeley: University of California Press, 1970.",
        "Ellis, E. Percy, trans. Posthumous Reminiscences of Brás Cubas. Rio de Janeiro: Instituto Nacional do Livro, 1955."
      ]
    },
    %FlatPublication{
      authors: "Fred P. Ellison",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Rachel de Queiroz",
      original_title: "As três Marias",
      publishers: "University of Texas Press",
      publishers_fingerprint: "2F6FE554F3CF1014B2345ADE7C06166EA58D929FBEE633D4A782126F5C4331EA",
      title: "The Three Marias",
      year: 1963,
      references: ["Ellison, Fred P. The Three Marias. Austin: University of Texas Press, 1963."]
    },
    %FlatPublication{
      authors: "Gregory Rabassa",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "Oxford University Press",
      publishers_fingerprint: "27E4CE2B302408251962F38DD2928A99EB212A7BB09088BBBE6F77944A11A90D",
      title: "Posthumous Memoirs of Bras Cubas",
      year: 1997
    },
    %FlatPublication{
      authors: "Jean Neel Karnoff",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Erico Verissimo",
      original_title: "Olhai os lírios do campo",
      publishers: "Greenwood",
      publishers_fingerprint: "37AA9A83218BF5F4A5F6EABA530C07E64316BA03788B42D0A2A419719B8B12BC",
      title: "Consider the Lilies of the Field",
      year: 1969
    },
    %FlatPublication{
      authors: "L. C. Kaplan",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Graciliano Ramos",
      original_title: "Angústia",
      publishers: "Alfred A. Knopf",
      publishers_fingerprint: "A4AFA4682BC9F658DD5DAD7649822F925C9A4FB0A72459F631FA32D07CC405D4",
      title: "Anguish",
      year: 1946
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Erico Verissimo",
      original_title: "O tempo e o vento",
      publishers: "Arco Publications",
      publishers_fingerprint: "DD6D4A5F8B8C4DD9BB9E5AD5634BB98CC3568E943729417FD69846D75C07B802",
      title: "Time and the Wind",
      year: 1954
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Erico Verissimo",
      original_title: "Noite",
      publishers: "Arco Publications",
      publishers_fingerprint: "DD6D4A5F8B8C4DD9BB9E5AD5634BB98CC3568E943729417FD69846D75C07B802",
      title: "Night",
      year: 1956
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Erico Verissimo",
      original_title: "O tempo e o vento",
      publishers: "Macmillan",
      publishers_fingerprint: "873D23F97EEB8B04973339EC8A202DC8AEC0B33298D2E194301E223ECD7E9C05",
      title: "Time and the Wind",
      year: 1951
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Erico Verissimo",
      original_title: "Noite",
      publishers: "Macmillan",
      publishers_fingerprint: "873D23F97EEB8B04973339EC8A202DC8AEC0B33298D2E194301E223ECD7E9C05",
      title: "Night",
      year: 1956
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett, Marie Barrett",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Erico Verissimo",
      original_title: "O senhor embaixador",
      publishers: "Macmillan",
      publishers_fingerprint: "873D23F97EEB8B04973339EC8A202DC8AEC0B33298D2E194301E223ECD7E9C05",
      title: "His Excellency, the Ambassador",
      year: 1967
    },
    %FlatPublication{
      authors: "Johnny Lorenz",
      countries: "CA",
      countries_fingerprint: "4B650E5C4785025DEE7BD65E3C5C527356717D7A1C0BFEF5B4ADA8CA1E9CBE17",
      original_authors: "Clarice Lispector",
      original_title: "Um sopro de vida: pulsações",
      publishers: "New Directions",
      publishers_fingerprint: "A092A747DE2B957ADC822F5FEE63B2078F4CEE237438789BBF9A6D10F9F104E2",
      title: "A Breath of Life (Pulsations)",
      year: 2012
    },
    %FlatPublication{
      authors: "Margaret Richardson Hollingsworth",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Mário de Andrade",
      original_title: "Amar verbo intransitivo",
      publishers: "MacCaulay",
      publishers_fingerprint: "A092A747DE2B957ADC822F5FEE63B2078F4CEE237438789BBF9A6D10F9F104E1",
      title: "Fraulein",
      year: 1933
    },
    %FlatPublication{
      authors: "Thomas Colchie",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Graciliano Ramos",
      original_title: "Memórias do cárcere",
      publishers: "Evans",
      publishers_fingerprint: "8658EBF1EDF525094102102EB55229187C236F9147950C775273B2D33AF516F0",
      title: "Jail Prison Memoirs",
      year: 1974
    },
    %FlatPublication{
      authors: "William L. Grossman",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "W.H. Allen",
      publishers_fingerprint: "0AE69A42F21F227103D46FF569A689AC1A139BD3F036C74DEA48E8C86FF93326",
      title: "Epitaph of a Small Winner",
      year: 1953
    },
    %FlatPublication{
      authors: "William L. Grossman",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "Noonday Press",
      publishers_fingerprint: "3444E1379BFB654A280E4E86B4BD0916534828F1AA529FFB8714D315E203F166",
      title: "Epitaph of a Small Winner",
      year: 1952
    }
  ]

  setup(_context) do
    # Seed as plain flat maps, not FlatPublication structs: nesting a struct applies
    # changes and turns references into %Reference{} structs that a second cast can't
    # re-cast. Feeding the codec maps lets insert cast references once. (Reference-less
    # seeds insert identically either way.)
    @publications
    |> Enum.map(&(&1 |> Map.from_struct() |> Map.delete(:__meta__)))
    |> Publication.Codec.nest()
    |> Enum.map(&Publication.insert/1)

    # Single inserts don't signal the refresher (callers do, once per logical
    # operation) — this seed is one such operation, and search needs the index.
    Publication.Index.Refresher.refresh()

    []
  end

  defp assert_publication_fields(publication, expected_fields) do
    Enum.each(
      Map.keys(publication),
      fn key ->
        assert key in expected_fields,
               """
               Expected publication

               #{inspect(publication, pretty: true)}

               to only contain fields #{inspect(expected_fields)}

               field #{key} found.
               """
      end
    )
  end

  defp assert_search_results(publications, expect: expected_values) do
    assert_search_results(publications, expect: expected_values, fields: [])
  end

  defp assert_search_results(publications, expect: expected_values, fields: expected_fields)
       when is_list(publications) and is_list(expected_values) do
    unless Keyword.keyword?(expected_values) do
      throw(
        "Expected values must be defined as a keyword with attribute as key and expected values as value"
      )
    end

    refute Enum.empty?(publications), "Expected publications not to be empty."

    unless Enum.empty?(expected_fields) do
      Enum.each(publications, &assert_publication_fields(&1, expected_fields))
    end

    Enum.each(publications, fn p ->
      assert Enum.any?(expected_values, fn {key, value} ->
               String.contains?(inspect(Map.fetch(p, key)), value)
             end),
             """
             Expected publication

             #{inspect(p, pretty: true)}

             to meet one of the following conditions:

             #{Enum.map_join(expected_values, "", fn
               {key, [v]} -> """
                 #{key} contains #{inspect(v, pretty: true)}
                 """
               {key, v} when is_list(v) -> """
                 #{key} contains one of #{inspect(v, pretty: true)}
                 """
               {key, v} -> """
                 #{key} contains #{inspect(v, pretty: true)}
                 """
             end)}
             """
    end)
  end

  defp select_attrs(publication, attributes) when is_map(publication) do
    Enum.filter(publication, fn {k, _} -> k in attributes end) |> Map.new()
  end

  defp select_attrs(publications, attributes) when is_list(publications) do
    Enum.map(publications, &select_attrs(&1, attributes))
  end

  describe "all/0" do
    test "returns all publications flattened" do
      {:ok, output} = Publication.Index.all()

      # Fingerprint values are covered by the fingerprint/composite-key tests, and
      # references by the codec/controller round-trip tests; this test is about the
      # flattened representation, so normalise them. (Some seeds carry references;
      # they're zeroed here since this test only checks the flattened shape.)
      strip =
        &%{
          &1
          | __meta__: nil,
            id: nil,
            references: [],
            countries_fingerprint: nil,
            publishers_fingerprint: nil,
            translated_book_fingerprint: nil
        }

      actual = output |> Enum.map(strip) |> Enum.sort()
      expected = @publications |> Enum.map(strip) |> Enum.sort()

      assert expected == actual
    end
  end

  describe "all/1" do
    test "retrieves a subset of all publications attributes" do
      attributes = [:title, :original_title, :authors]

      {:ok, actual} = Publication.Index.all(select: attributes)

      expected =
        Publication.all()
        |> Publication.preload()
        |> Publication.Codec.flatten()
        |> Util.stringify_keys()
        |> select_attrs(Enum.map(attributes, &Atom.to_string/1))

      assert Enum.sort(Util.stringify_keys(actual)) == Enum.sort(expected)
    end
  end

  describe "without_references/0" do
    test "returns only the publications missing references, ordered by id" do
      {:ok, results} = Publication.Index.without_references()

      # The reference-less seeds come back; the ones seeded with references don't.
      expected_titles =
        @publications
        |> Enum.filter(&(&1.references in [nil, []]))
        |> Enum.map(& &1.title)
        |> Enum.sort()

      assert Enum.sort(Enum.map(results, & &1.title)) == expected_titles
      assert Enum.all?(results, &(&1.references == []))

      # Stable ascending-id order — the wizard steps through a fixed queue.
      ids = Enum.map(results, & &1.id)
      assert ids == Enum.sort(ids)
    end
  end

  describe "search/1 with a single-word term present in the dataset" do
    test "retrieves publications by original author" do
      term = "Verissimo"
      keyword = String.downcase(term)
      expected_original_authors = ["Erico Verissimo", "Luis Fernando Verissimo"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_authors: expected_original_authors
        ]
      )
    end

    test "retrieves publications by title" do
      term = "Night"
      keyword = String.downcase(term)
      expected_titles = ["Night"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          title: expected_titles
        ]
      )
    end

    test "retrieves publications by original title" do
      term = "Noite"
      keyword = String.downcase(term)
      expected_original_titles = ["Noite"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_title: expected_original_titles
        ]
      )
    end

    test "retrieves publications by author" do
      term = "Brakel"
      keyword = String.downcase(term)
      expected_authors = ["Arthur Brakel"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          authors: expected_authors
        ]
      )
    end

    test "retrieves publications by publisher" do
      term = "Macmillan"
      keyword = String.downcase(term)
      expected_publishers = ["Macmillan"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          publishers: expected_publishers
        ]
      )
    end

    test "retrieves publications by year" do
      term = "1956"
      keyword = String.downcase(term)
      expected_years = ["1956"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          year: expected_years
        ]
      )
    end

    test "retrieves no publications and no keywords for inexistent term" do
      term = "Blablabla"

      assert {:ok, [], []} == Publication.Index.search(term)
    end
  end

  describe "search/1 with a single-word term not present in the dataset" do
    test "prioritizes words that start with the term" do
      term = "veri"

      assert {:ok, publications, ["verissimo"]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_authors: ["Erico Verissimo", "Luis Fernando Verissimo"]
        ]
      )
    end

    test "does a fuzzy search when there's no words start with the term" do
      term = "vera"

      assert {:ok, publications, ["verbo"]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_title: ["Amar verbo intransitivo"]
        ]
      )
    end
  end

  describe "search/1 with a single-word term that matches several fields" do
    test "does a prefix search" do
      term = "Mari"

      assert {:ok, publications, keywords} = Publication.Index.search(term)

      # "Mário" is held with its accent folded away, so a term written without
      # one reaches it.
      assert Enum.sort(keywords) == ["marias", "marie", "mario"]

      assert_search_results(
        publications,
        expect: [
          title: "The Three Marias",
          authors: "Marie Barrett",
          original_title: "As três Marias",
          original_authors: "Mário de Andrade"
        ]
      )
    end

    test "does a fuzzy search" do
      term = "Maries"

      assert {:ok, publications, keywords} = Publication.Index.search(term)

      assert Enum.sort(keywords) == ["marias", "marie", "mario"]

      assert_search_results(
        publications,
        expect: [
          title: "The Three Marias",
          authors: "Marie Barrett",
          original_title: "As três Marias",
          original_authors: "Mário de Andrade"
        ]
      )
    end
  end

  describe "all_order/0, search_order/1 and details/2" do
    test "the ordering lists the whole database, each publication once" do
      order = Publication.Index.all_order()

      assert length(order) == length(@publications)
      assert Enum.uniq(order) == order
    end

    test "a page draws no more than a page from the ordering" do
      order = Publication.Index.all_order()
      first = Publication.Index.details(Enum.take(order, Publication.Index.per_page()))

      assert length(first) == Publication.Index.per_page()
      assert length(first) < length(order)
    end

    test "paging the ordering by id yields the whole database, once, in that order" do
      order = Publication.Index.all_order()

      ids =
        order
        |> Enum.chunk_every(Publication.Index.per_page())
        |> Enum.flat_map(fn chunk ->
          chunk |> Publication.Index.details() |> Enum.map(& &1.id)
        end)

      assert ids == order
    end

    test "an id no longer in the database is left out, not shifted or repeated" do
      order = Publication.Index.all_order()

      # A missing id in the middle simply vanishes; the ones around it keep their
      # places, which is how a deletion since the order froze reads as a gap.
      with_hole = List.insert_at(order, div(length(order), 2), -1)

      assert Enum.map(Publication.Index.details(with_hole), & &1.id) == order
    end

    test "a search settles an ordering, and the words it matched on" do
      {order, keywords} = Publication.Index.search_order("Verissimo")

      assert order != []
      refute Enum.empty?(keywords)

      page =
        order
        |> Enum.take(Publication.Index.per_page())
        |> Publication.Index.details("Verissimo")

      assert length(page) <= Publication.Index.per_page()
      assert Enum.map(page, & &1.id) == Enum.take(order, length(page))
    end

    test "a search nothing answers settles no ordering" do
      assert Publication.Index.search_order("zzzzqqqq") == :none
    end

    test "the fuzzy ladder still settles an ordering" do
      {order, keywords} = Publication.Index.search_order("Maries")

      assert "marias" in keywords
      assert order != []
    end

    test "a page carries the reference match that answered a row" do
      {order, keywords} = Publication.Index.search_order("Berkeley")
      page = Publication.Index.details(order, "Berkeley", keywords)

      row = Enum.find(page, &(&1.title == "Posthumous Reminiscences of Brás Cubas"))
      assert row.source_match =~ "Berkeley"
    end

    test "a plain listing carries no reference match" do
      [row | _] =
        Publication.Index.all_order()
        |> Enum.take(1)
        |> Publication.Index.details()

      assert row.source_match == nil
    end
  end

  describe "search/1 by country" do
    test "a country's name finds the records that store its code" do
      assert {:ok, publications, _} = Publication.Index.search("Brazil")

      assert Enum.any?(publications, &String.contains?(&1.countries, "BR"))
    end

    test "a multi-word name finds the country" do
      assert {:ok, publications, _} = Publication.Index.search("United Kingdom")

      refute Enum.empty?(publications)
      assert Enum.any?(publications, &String.contains?(&1.countries, "GB"))
    end

    test "an alternate or translated name finds the country too" do
      assert {:ok, uk, _} = Publication.Index.search("Reino Unido")
      assert Enum.any?(uk, &String.contains?(&1.countries, "GB"))

      assert {:ok, us, _} = Publication.Index.search("USA")
      assert Enum.any?(us, &String.contains?(&1.countries, "US"))
    end

    test "a quoted name finds the country, which the literal path could not do before" do
      assert {:ok, publications, _} = Publication.Index.search(~s("United Kingdom"))

      assert Enum.any?(publications, &String.contains?(&1.countries, "GB"))
    end

    # A country code doubles as a common word (pt "um" is UM, "no" is NO).
    # Indexing names rather than codes keeps such a word in a record's title
    # from dragging in an unrelated country.
    test "a country whose code spells a common word is not pulled by that word" do
      {:ok, bait} =
        %{
          "title" => "A Certain Captain",
          "original_title" => "Um Homem no Mundo",
          "original_authors" => "Autor Teste",
          "authors" => "Test Translator",
          "year" => "1970",
          "countries" => "BR",
          "publishers" => "Editora Teste"
        }
        |> Publication.Codec.nest()
        |> Publication.insert()

      Publication.Index.Refresher.refresh()

      for term <- ["Norway", "United"] do
        assert {:ok, results, _} = Publication.Index.search(term)
        refute Enum.any?(results, &(&1.id == bait.id))
      end
    end
  end

  describe "search/1 spelled out" do
    test "a quoted phrase is asked for as written" do
      assert {:ok, publications, _} = Publication.Index.search(~s("Civil Servant"))

      assert Enum.all?(publications, &(&1.title == "Diary of a Civil Servant"))
    end

    test "a word can be excluded" do
      {:ok, all, _} = Publication.Index.search("Verissimo")
      {:ok, fewer, _} = Publication.Index.search("Verissimo -Noite")

      assert length(fewer) < length(all)
      refute Enum.any?(fewer, &(&1.original_title == "Noite"))
    end
  end

  describe "search/1 with :or" do
    defp ids(publications), do: MapSet.new(publications, & &1.id)

    test "matches either alternative" do
      {:ok, verissimo, _} = Publication.Index.search("Verissimo")
      {:ok, assis, _} = Publication.Index.search("Assis")
      {:ok, either, _} = Publication.Index.search("Verissimo :or Assis")

      refute MapSet.equal?(ids(verissimo), ids(assis))
      assert ids(either) == MapSet.union(ids(verissimo), ids(assis))
    end

    test "the operator is case-insensitive" do
      {:ok, lower, _} = Publication.Index.search("Verissimo :or Assis")
      {:ok, upper, _} = Publication.Index.search("Verissimo :OR Assis")

      assert Enum.map(lower, & &1.id) == Enum.map(upper, & &1.id)
    end

    test "words within an alternative still narrow it" do
      {:ok, verissimo, _} = Publication.Index.search("Verissimo")
      {:ok, erico, _} = Publication.Index.search("Erico Verissimo")
      {:ok, machado, _} = Publication.Index.search("Machado")
      {:ok, either, _} = Publication.Index.search("Erico Verissimo :or Machado")

      # "Erico Verissimo" is narrowed by both its words to a subset of what
      # "Verissimo" alone matches, and the whole term adds the second alternative.
      refute Enum.empty?(erico)
      assert MapSet.subset?(ids(erico), ids(verissimo))
      assert ids(either) == MapSet.union(ids(erico), ids(machado))
    end

    test "a fully misspelled term falls back to fuzzy per alternative" do
      {:ok, fuzzy, _} = Publication.Index.search("Verissimoo :or Machadoo")

      refute Enum.empty?(fuzzy)
      assert Enum.any?(fuzzy, &String.contains?(&1.original_authors, "Verissimo"))
      assert Enum.any?(fuzzy, &String.contains?(&1.original_authors, "Machado"))
    end

    test "the operator answers to Portuguese too" do
      {:ok, english, _} = Publication.Index.search("Verissimo :or Assis")
      {:ok, portuguese, _} = Publication.Index.search("Verissimo :ou Assis")

      refute Enum.empty?(portuguese)
      assert ids(english) == ids(portuguese)
    end

    test "a bare `or` is a word to search for, not an operator" do
      # Which is the point of the colon: a title may well contain "or", and a
      # reader typing it means the word. So it narrows like any other word —
      # here to nothing, no record carrying all three — rather than widening.
      {:ok, widened, _} = Publication.Index.search("Verissimo :or Assis")
      {:ok, literal, _} = Publication.Index.search("Verissimo or Assis")

      assert literal == []
      refute Enum.empty?(widened)
    end
  end

  describe "search/1 with field operators" do
    defp found(term) do
      {:ok, publications, _} = Publication.Index.search(term)
      publications
    end

    test "a field operator asks of that field alone" do
      results = found("title:night")

      refute Enum.empty?(results)
      assert Enum.all?(results, &(String.downcase(&1.title) =~ "night"))
    end

    test "the same word asked of another field answers differently" do
      by_title = found("title:noite")
      by_original = found("original:noite")

      assert Enum.empty?(by_title)
      refute Enum.empty?(by_original)
      assert Enum.all?(by_original, &(String.downcase(&1.original_title) =~ "noite"))
    end

    test "a translator and an original author are told apart" do
      translators = found("translator:barrett")
      authors = found("autor:verissimo")

      refute Enum.empty?(translators)
      assert Enum.all?(translators, &(String.downcase(&1.authors) =~ "barrett"))

      refute Enum.empty?(authors)
      assert Enum.all?(authors, &(String.downcase(&1.original_authors) =~ "verissimo"))
    end

    test "a publisher and a country can be asked for" do
      assert Enum.all?(
               found("publisher:macmillan"),
               &(String.downcase(&1.publishers) =~ "macmillan")
             )

      assert Enum.all?(found("country:GB"), &(&1.countries =~ "GB"))
      refute Enum.empty?(found("editora:macmillan"))
      refute Enum.empty?(found("pais:GB"))
    end

    test "a year is a year, and a span is a span" do
      assert Enum.all?(found("year:1956"), &(&1.year == 1956))
      assert Enum.all?(found("year:1950-1960"), &(&1.year >= 1950 and &1.year <= 1960))
      assert Enum.all?(found("ano:2000-"), &(&1.year >= 2000))
      assert Enum.all?(found("year:-1950"), &(&1.year <= 1950))

      refute Enum.empty?(found("year:1950-1960"))
    end

    test "a minus excludes what it names" do
      all = found("translator:barrett")
      without = found("translator:barrett -country:US")

      refute Enum.empty?(without)
      assert length(without) < length(all)
      refute Enum.any?(without, &(&1.countries =~ "US"))
    end

    test "a quoted value is a phrase, not a set of words" do
      assert Enum.all?(found(~s(title:"time and the wind")), &(&1.title == "Time and the Wind"))
      # The same words in another order are not that phrase.
      assert found(~s(title:"wind and the time")) == []
    end

    test "several words can be asked of one field, in any order" do
      grouped = found("title:(time wind)")

      refute Enum.empty?(grouped)
      assert Enum.all?(grouped, &(&1.title == "Time and the Wind"))
      # Order does not matter, unlike a quoted phrase.
      assert Enum.map(found("title:(wind time)"), & &1.id) == Enum.map(grouped, & &1.id)
      assert found(~s(title:"wind time")) == []
    end

    test "an author is the writer, and a translator the one who rendered it" do
      writers = found("author:verissimo")
      renderers = found("translator:barrett")

      refute Enum.empty?(writers)
      assert Enum.all?(writers, &(String.downcase(&1.original_authors) =~ "verissimo"))

      refute Enum.empty?(renderers)
      assert Enum.all?(renderers, &(String.downcase(&1.authors) =~ "barrett"))
    end

    test "operators narrow the free words beside them" do
      loose = found("night")
      narrowed = found("night country:US")

      refute Enum.empty?(narrowed)
      assert length(narrowed) < length(loose)
      assert Enum.all?(narrowed, &(&1.countries =~ "US"))
    end

    test "operators belong to their own alternative" do
      either = found("country:BR :or country:CA")

      refute Enum.empty?(either)
      assert Enum.all?(either, &(&1.countries =~ "BR" or &1.countries =~ "CA"))
      assert Enum.any?(either, &(&1.countries =~ "BR"))
      assert Enum.any?(either, &(&1.countries =~ "CA"))
    end

    test "an operator alone answers without any words to look for" do
      results = found("year:1956")

      refute Enum.empty?(results)
      assert Enum.all?(results, &(&1.year == 1956))
    end

    test "a misspelled value is forgiven, as a free word is" do
      assert Enum.all?(found("title:nigth"), &(&1.title == "Night"))
      refute Enum.empty?(found("title:nigth"))

      # Inside a bracketed value too, word by word.
      refute Enum.empty?(found("title:(nigth)"))

      # And what resembles nothing still answers nothing.
      assert found("title:zzzzqqqx") == []
    end

    test "a half-typed value still finds the word it could become" do
      assert Enum.all?(found("translator:barr"), &(String.downcase(&1.authors) =~ "barr"))
      refute Enum.empty?(found("translator:barr"))
    end

    test "a prefix that names no field is not an operator" do
      # A colon someone typed is not a failed query: the term is looked for as
      # text, and answers as any text does — including the fuzzy ladder, which
      # is why a word buried in it can still find something.
      assert found("nosuchfield:zzzzqqqqx") == []
      refute Enum.empty?(found("nosuchfield:barrett"))
    end
  end

  describe "search/1 with accents" do
    test "a term written without them finds the words that carry them" do
      {:ok, folded, _} = Publication.Index.search("Angustia")
      {:ok, written, _} = Publication.Index.search("Angústia")

      assert_search_results(folded, expect: [original_title: "Angústia"])
      assert Enum.map(folded, & &1.id) == Enum.map(written, & &1.id)
    end

    test "a term written with them finds what is held without" do
      assert {:ok, publications, _} = Publication.Index.search("Frãulein")

      assert_search_results(publications, expect: [title: "Fraulein"])
    end
  end

  describe "search/1 over a publication's sources" do
    test "finds a publication by a word only its references carry" do
      assert {:ok, publications, _} = Publication.Index.search("Berkeley")

      assert_search_results(publications,
        expect: [title: "Posthumous Reminiscences of Brás Cubas"]
      )
    end

    test "a title outranks a passing mention in someone else's sources" do
      assert {:ok, [first | _], _} = Publication.Index.search("Three Marias")

      assert first.title == "The Three Marias"
    end
  end

  describe "search/1 with a composite term present in the dataset" do
    test "retrieves publications answering every word" do
      term = "Marie Barrett"
      split_term = String.split(term, " ")
      keywords = Enum.map(split_term, &String.downcase/1)

      assert {:ok, publications, ^keywords} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          authors: ["Linton Lemos Barrett", "Marie Barrett"]
        ]
      )
    end
  end

  describe "search/1 with a whole title as the term" do
    # A title is what the publication's own link searches for.
    test "returns the publication the title belongs to, and not the rest" do
      assert {:ok, publications, keywords} =
               Publication.Index.search("Diary of a Civil Servant")

      assert "diary" in keywords
      assert "servant" in keywords

      assert Enum.all?(publications, &(&1.title == "Diary of a Civil Servant"))
    end

    test "each word narrows what the one before it found" do
      {:ok, one_word, _} = Publication.Index.search("Diary")
      {:ok, three_words, _} = Publication.Index.search("Diary Civil Servant")

      assert length(three_words) <= length(one_word)
      assert Enum.any?(three_words, &(&1.title == "Diary of a Civil Servant"))
    end

    test "a word naming nothing does not empty the search" do
      assert {:ok, publications, keywords} =
               Publication.Index.search("Diary zzzzqqq Servant")

      assert "diary" in keywords

      assert Enum.any?(publications, &(&1.title == "Diary of a Civil Servant"))
    end
  end

  describe "search/2 with a single-word term present in the dataset" do
    test "retrieves a subset of all publications attributes, by original author" do
      term = "Verissimo"
      keyword = String.downcase(term)
      attributes = [:title, :original_title, :original_authors, :authors]
      expected_original_authors = ["Erico Verissimo", "Luis Fernando Verissimo"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term, select: attributes)

      assert_search_results(
        publications,
        expect: [
          original_authors: expected_original_authors
        ],
        fields: attributes
      )
    end
  end
end
