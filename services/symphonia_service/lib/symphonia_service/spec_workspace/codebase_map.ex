defmodule SymphoniaService.SpecWorkspace.CodebaseMap do
  @moduledoc """
  Deterministic starter artifact helpers for codebase maps.
  """

  alias SymphoniaService.SpecWorkspace.Store

  def read(repository), do: Store.read_artifact(repository, "codebase_map", "codebase-map")
end
