defmodule SymphoniaService.Sandbox.OpenSandboxError do
  @moduledoc """
  Maps provider/runtime errors to public-safe OpenSandbox reason codes.
  """

  @codes ~w(
    sandbox_not_configured
    sandbox_unreachable
    sandbox_create_failed
    sandbox_prepare_failed
    sandbox_run_failed
    sandbox_result_invalid
    sandbox_timeout
    sandbox_release_failed
    sandbox_auth_failed
    sandbox_resource_exhausted
    sandbox_execd_unreachable
  )

  def codes, do: @codes

  def normalize(reason) do
    reason
    |> raw_code()
    |> map_code()
    |> safe_code()
  end

  def public_message("sandbox_not_configured"), do: "OpenSandbox is not configured."
  def public_message("sandbox_unreachable"), do: "OpenSandbox could not be reached."
  def public_message("sandbox_create_failed"), do: "OpenSandbox could not create a sandbox."
  def public_message("sandbox_prepare_failed"), do: "OpenSandbox could not prepare the workspace."
  def public_message("sandbox_run_failed"), do: "OpenSandbox could not run the fixture command."
  def public_message("sandbox_result_invalid"), do: "OpenSandbox returned an invalid result."
  def public_message("sandbox_timeout"), do: "OpenSandbox timed out."
  def public_message("sandbox_release_failed"), do: "OpenSandbox cleanup needs attention."
  def public_message("sandbox_auth_failed"), do: "OpenSandbox authentication failed."
  def public_message("sandbox_resource_exhausted"), do: "OpenSandbox resources were exhausted."
  def public_message("sandbox_execd_unreachable"), do: "OpenSandbox execution endpoint could not be reached."
  def public_message(_reason), do: "OpenSandbox smoke failed."

  defp raw_code({:error, reason}), do: raw_code(reason)
  defp raw_code(reason) when is_atom(reason), do: Atom.to_string(reason)

  defp raw_code(reason) do
    reason
    |> to_string()
    |> String.replace(~r/[^a-zA-Z0-9._-]/, "_")
    |> String.slice(0, 80)
  end

  defp map_code(reason)
       when reason in [
              "opensandbox_endpoint_missing",
              "opensandbox_api_key_missing",
              "opensandbox_api_key_reference_missing"
            ],
       do: "sandbox_not_configured"

  defp map_code(reason) when reason in ["opensandbox_unauthorized", "opensandbox_forbidden"],
    do: "sandbox_auth_failed"

  defp map_code("opensandbox_execd_endpoint_missing"), do: "sandbox_execd_unreachable"
  defp map_code("opensandbox_request_failed"), do: "sandbox_unreachable"
  defp map_code("opensandbox_conflict"), do: "sandbox_resource_exhausted"
  defp map_code("sandbox_create_timeout"), do: "sandbox_timeout"
  defp map_code("source_bundle_failed"), do: "sandbox_prepare_failed"
  defp map_code("invalid_result"), do: "sandbox_result_invalid"
  defp map_code("missing_patch"), do: "sandbox_result_invalid"
  defp map_code("empty_patch"), do: "sandbox_result_invalid"
  defp map_code("patch_digest_mismatch"), do: "sandbox_result_invalid"
  defp map_code("changed_files_digest_mismatch"), do: "sandbox_result_invalid"
  defp map_code("changed_files_mismatch"), do: "sandbox_result_invalid"
  defp map_code(reason) when reason in @codes, do: reason
  defp map_code(reason), do: reason

  defp safe_code(reason) when reason in @codes, do: reason
  defp safe_code(""), do: "sandbox_run_failed"
  defp safe_code(_reason), do: "sandbox_run_failed"
end
