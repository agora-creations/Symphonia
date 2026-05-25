defmodule SymphoniaService.SpecWorkspace.Decisions do
  @moduledoc """
  Decision artifact helpers.
  """

  alias SymphoniaService.SpecWorkspace.Store

  def create(repository, attrs \\ %{}), do: Store.create_artifact(repository, "decision", attrs)
end
