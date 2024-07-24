defmodule RichardBurton.LinkedSchema do
  defmacro __using__(opts) do
    assoc = Keyword.fetch!(opts, :assoc)

    conflict_target =
      Keyword.fetch!(opts, :conflict_target)
      |> normalize_conflict_target()

    quote do
      @before_compile unquote(__MODULE__)
      @link_assoc unquote(assoc)
      @link_conflict_target unquote(conflict_target)
    end
  end

  defmacro __before_compile__(_env) do
    quote do
      def maybe_insert!(attrs) do
        %__MODULE__{}
        |> changeset(attrs)
        |> RichardBurton.Repo.maybe_insert!(@link_conflict_target)
      end

      def link(changeset = %{valid?: false}), do: changeset

      def link(changeset = %{valid?: true}) do
        record = changeset |> get_change(@link_assoc) |> apply_linked_change()

        Ecto.Changeset.put_assoc(changeset, @link_assoc, record)
      end

      defp apply_linked_change(changes) when is_list(changes) do
        changes
        |> Enum.reject(fn %{action: action} -> action == :replace end)
        |> Enum.map(&Ecto.Changeset.apply_changes/1)
        |> Enum.map(&maybe_insert!/1)
      end

      defp apply_linked_change(changes),
        do: [changes] |> apply_linked_change() |> hd()
    end
  end

  defp normalize_conflict_target(value) when is_list(value), do: value
  defp normalize_conflict_target(value), do: [value]
end
