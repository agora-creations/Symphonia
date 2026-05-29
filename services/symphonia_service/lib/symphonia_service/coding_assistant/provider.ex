defmodule SymphoniaService.CodingAssistant.Provider do
  @moduledoc """
  Behaviour for Coding Assistant providers.

  Providers receive a repository, task, and run record and return a curated
  handoff. Raw provider logs stay in the run store, not in repository files.
  """

  @type capabilities :: %{optional(String.t()) => boolean()}

  @callback id() :: String.t()
  @callback label() :: String.t()
  @callback capabilities() :: capabilities()
  @callback readiness(opts :: keyword()) :: map()
  @callback preflight(map(), map(), map()) :: :ok | {:error, String.t()}
  @callback run(map(), map(), map(), map()) :: {:ok, map()} | {:error, String.t()}
  @callback classify_failure(reason :: String.t(), context :: map()) :: String.t()
end
