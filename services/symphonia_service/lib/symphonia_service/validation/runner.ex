defmodule SymphoniaService.Validation.Runner do
  @moduledoc """
  Runs local validation commands in the prepared task workspace.
  """

  alias SymphoniaService.Validation.Evidence

  @default_timeout_ms 120_000
  @default_max_output_bytes 1_048_576

  def run(repo_path, policy, opts \\ []) when is_binary(repo_path) and is_map(policy) do
    commands = Map.get(policy, "commands", [])

    results =
      case commands do
        [] -> [Evidence.not_configured_result()]
        values -> Enum.map(values, &run_command(repo_path, &1, opts))
      end

    {:ok, results}
  end

  defp run_command(repo_path, item, opts) do
    timeout_ms = Keyword.get(opts, :timeout_ms, @default_timeout_ms)
    max_output_bytes = Keyword.get(opts, :max_output_bytes, @default_max_output_bytes)
    started = System.monotonic_time(:millisecond)
    command = item["command"] |> to_string() |> String.trim()

    base_result = %{
      "id" => item["id"],
      "label" => item["label"],
      "command" => command,
      "required" => item["required"] == true,
      "source" => item["source"],
      "exit_status" => nil,
      "duration_ms" => 0,
      "output" => "",
      "output_truncated" => false
    }

    cond do
      command == "" ->
        finish(base_result, "skipped", nil, "", started, max_output_bytes)

      not File.dir?(repo_path) ->
        finish(
          base_result,
          "failed",
          nil,
          "Validation workspace does not exist: #{repo_path}",
          started,
          max_output_bytes
        )

      true ->
        execute(repo_path, command, base_result, started, timeout_ms, max_output_bytes)
    end
  rescue
    error ->
      %{
        "id" => item["id"],
        "label" => item["label"] || "Validation",
        "command" => item["command"],
        "required" => item["required"] == true,
        "source" => item["source"],
        "status" => "failed",
        "exit_status" => nil,
        "duration_ms" => 0,
        "output" => Exception.message(error),
        "output_truncated" => false,
        "public_detail" =>
          Evidence.sanitize_public_text(
            "#{item["label"] || "Validation"} failed. Review the private run output locally."
          )
      }
  end

  defp execute(repo_path, command, base_result, started, timeout_ms, max_output_bytes) do
    task =
      Task.async(fn ->
        System.cmd("sh", ["-lc", command],
          cd: repo_path,
          stderr_to_stdout: true,
          env: [{"CI", "1"}]
        )
      end)

    case Task.yield(task, timeout_ms) do
      {:ok, {output, 0}} ->
        finish(base_result, "passed", 0, output, started, max_output_bytes)

      {:ok, {output, status}} ->
        finish(base_result, "failed", status, output, started, max_output_bytes)

      {:exit, reason} ->
        finish(base_result, "failed", nil, inspect(reason), started, max_output_bytes)

      nil ->
        Task.shutdown(task, :brutal_kill)

        base_result
        |> finish("timed_out", nil, "", started, max_output_bytes)
        |> Map.put(
          "public_detail",
          Evidence.sanitize_public_text(
            "#{base_result["label"]} timed out after #{timeout_seconds(timeout_ms)} seconds. Review the private run output locally."
          )
        )
    end
  end

  defp finish(result, status, exit_status, output, started, max_output_bytes) do
    duration_ms = System.monotonic_time(:millisecond) - started
    {captured_output, truncated?} = cap_output(output, max_output_bytes)

    result
    |> Map.merge(%{
      "status" => status,
      "exit_status" => exit_status,
      "duration_ms" => duration_ms,
      "output" => captured_output,
      "output_truncated" => truncated?,
      "public_detail" => public_detail(result["label"], status)
    })
  end

  defp cap_output(output, max_output_bytes) do
    output = to_string(output)

    if byte_size(output) > max_output_bytes do
      {binary_part(output, 0, max_output_bytes), true}
    else
      {output, false}
    end
  end

  defp public_detail(label, "passed"), do: Evidence.sanitize_public_text("#{label} passed.")

  defp public_detail(label, "failed"),
    do: Evidence.sanitize_public_text("#{label} failed. Review the private run output locally.")

  defp public_detail(label, "timed_out"),
    do:
      Evidence.sanitize_public_text(
        "#{label} timed out after 120 seconds. Review the private run output locally."
      )

  defp public_detail(label, "skipped"), do: Evidence.sanitize_public_text("#{label} was not run.")

  defp public_detail(_label, "not_configured"),
    do: Evidence.sanitize_public_text("No machine validation command was configured.")

  defp public_detail(label, _status), do: Evidence.sanitize_public_text("#{label} was not run.")

  defp timeout_seconds(timeout_ms), do: max(1, div(timeout_ms + 999, 1000))
end
