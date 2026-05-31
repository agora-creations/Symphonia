defmodule SymphoniaService.Sandbox.Provider do
  @moduledoc """
  Behaviour for disposable sandbox providers.

  Providers own only the execution workspace lifecycle. They return a patch-bundle
  result; Symphonia remains responsible for import, validation, handoff, and
  review state.
  """

  @callback create(map()) :: {:ok, map()} | {:error, term()}
  @callback prepare(map(), map(), map()) :: {:ok, map()} | {:error, term()}
  @callback run(map(), map(), map()) :: {:ok, map()} | {:error, term()}
  @callback release(map()) :: :ok | {:error, term()}
  @callback readiness(map()) :: map()
end
