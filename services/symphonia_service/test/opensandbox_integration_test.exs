defmodule SymphoniaService.OpenSandboxIntegrationTest do
  use ExUnit.Case

  @moduletag :opensandbox_integration
  @live_enabled System.get_env("SYMPHONIA_OPENSANDBOX_INTEGRATION") == "1" and
                  is_binary(System.get_env("SYMPHONIA_OPENSANDBOX_ENDPOINT")) and
                  String.trim(System.get_env("SYMPHONIA_OPENSANDBOX_ENDPOINT") || "") != "" and
                  is_binary(System.get_env("SYMPHONIA_OPENSANDBOX_API_KEY")) and
                  String.trim(System.get_env("SYMPHONIA_OPENSANDBOX_API_KEY") || "") != ""

  if @live_enabled do
    test "live fixture smoke creates, runs, collects, and releases when enabled" do
    root =
      Path.join(System.tmp_dir!(), "symphonia-opensandbox-live-#{System.unique_integer([:positive])}")

    repo_path = Path.join(root, "repo")
    registry_path = Path.join(root, "repositories.json")
    File.mkdir_p!(repo_path)

    try do
      repository = SymphoniaService.RepositoryRegistry.add(registry_path, %{"path" => repo_path, "key" => "SYM"})
      SymphoniaService.Workspace.initialize(repository)

      env_name = "SYMPHONIA_OPENSANDBOX_API_KEY"

      {:ok, _reference} =
        SymphoniaService.Secrets.ReferenceStore.create(registry_path, repository, %{
          "label" => "OpenSandbox API key",
          "scope" => "sandbox.provider",
          "source" => "environment",
          "envName" => env_name
        })

      assert {:ok, smoke} =
               SymphoniaService.Sandbox.OpenSandboxSmoke.run(registry_path, repository, %{
                 "id" => "owner",
                 "name" => "Owner",
                 "role" => "owner"
               })

      assert smoke["status"] == "passed"
      assert smoke["workspaceMode"] == "source_bundle"
      assert smoke["changedFileCount"] == 1
    after
      File.rm_rf(root)
    end
    end
  else
    @tag :skip
    test "live fixture smoke creates, runs, collects, and releases when enabled" do
      :ok
    end
  end
end
