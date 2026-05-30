defmodule SymphoniaService.Runners.ImportLock do
  @moduledoc """
  Simple local per-run import lock for remote patch application.
  """

  alias SymphoniaService.CodingAssistant.RunStore

  def with_lock(run_id, fun) when is_binary(run_id) and is_function(fun, 0) do
    path = lock_path(run_id)
    path |> Path.dirname() |> File.mkdir_p!()

    case File.open(path, [:write, :exclusive]) do
      {:ok, io} ->
        try do
          IO.write(io, "#{DateTime.utc_now() |> DateTime.to_iso8601()}\n")
          fun.()
        after
          File.close(io)
          File.rm(path)
        end

      {:error, :eexist} ->
        {:error, "import_in_progress"}

      {:error, reason} ->
        {:error, "import_lock_unavailable: #{reason}"}
    end
  end

  def active?(run_id) when is_binary(run_id), do: File.exists?(lock_path(run_id))
  def active?(_run_id), do: false

  defp lock_path(run_id) do
    safe =
      run_id
      |> String.replace(~r/[^a-zA-Z0-9._-]/, "-")
      |> String.trim("-")

    Path.join([RunStore.root(), "locks", "#{safe}.lock"])
  end
end
