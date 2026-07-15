defmodule RichardBurton.Fingerprint do
  @moduledoc """
  Computes the fingerprints used as composite-identity keys for publications and
  their shared associations.

  A set-valued attribute (countries, publishers, translators, original authors)
  is collapsed into a single scalar so a Postgres unique constraint can enforce
  set identity — which a many-to-many relationship can't express directly.

  All set fingerprints go through `of_set/1` so the delimiter is defined in one
  place: without a separator, variable-length values collide (e.g. `["AnnBob"]`
  and `["Ann", "Bob"]` both join to `"AnnBob"`). The composite-record fingerprints
  (`OriginalBook`/`TranslatedBook`) instead concatenate fixed-width sub-fingerprints,
  which is already unambiguous, so they don't use this.
  """

  alias RichardBurton.Util

  # Postgres text can never contain a NUL byte, so it's an always-safe separator.
  @separator "\0"

  @doc "Fingerprints an order-independent set of strings."
  def of_set(strings) when is_list(strings) do
    strings
    |> Enum.sort()
    |> Enum.join(@separator)
    |> Util.create_fingerprint()
  end
end
