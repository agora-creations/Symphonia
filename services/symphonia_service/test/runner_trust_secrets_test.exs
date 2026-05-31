defmodule SymphoniaService.RunnerTrustSecretsTest do
  use ExUnit.Case

  alias SymphoniaService.Access.AuditLog
  alias SymphoniaService.Runners.{FakeRunner, Pairing, Registry, SelectionPolicy}
  alias SymphoniaService.Secrets.ReferenceStore

  setup do
    root =
      Path.join(System.tmp_dir!(), "symphonia-runner-trust-#{System.unique_integer([:positive])}")

    registry_path = Path.join(root, "repositories.json")
    File.mkdir_p!(root)

    previous_secret = System.get_env("SYMPHONIA_TEST_SECRET")
    System.put_env("SYMPHONIA_TEST_SECRET", "super-secret-value")

    on_exit(fn ->
      restore_env("SYMPHONIA_TEST_SECRET", previous_secret)
      File.rm_rf(root)
    end)

    %{
      registry_path: registry_path,
      owner: %{"id" => "owner", "name" => "Owner", "role" => "owner"},
      maintainer: %{"id" => "maintainer", "name" => "Maintainer", "role" => "maintainer"},
      repository: %{
        "key" => "SYM",
        "remoteExecutionAllowed" => true,
        "allowedRunnerIds" => []
      }
    }
  end

  test "pairing creates pending runner and token rotation/revocation are enforced", %{
    registry_path: registry_path,
    owner: owner,
    maintainer: maintainer,
    repository: repository
  } do
    {:ok, pairing, pairing_token} = Pairing.create(registry_path, owner, %{"name" => "Mac Mini"})
    assert pairing["name"] == "Mac Mini"
    assert pairing_token =~ "sym_pair_"
    refute File.read!(Pairing.path(registry_path)) =~ pairing_token

    {:ok, runner, runner_token} =
      Registry.register(
        registry_path,
        owner,
        FakeRunner.registration_attrs(%{"pairingToken" => pairing_token})
      )

    assert Registry.public(runner)["trustState"] == "pending"
    assert runner_token =~ "sym_runner_"
    refute File.read!(Registry.path(registry_path)) =~ runner_token

    assert {:error, :pairing_token_used} =
             Registry.register(
               registry_path,
               owner,
               FakeRunner.registration_attrs(%{"pairingToken" => pairing_token})
             )

    assert {:error, {403, %{"reasonCode" => "runner_not_trusted"}}} =
             SelectionPolicy.select_for_run(registry_path, repository, maintainer,
               runner_id: runner["id"],
               allow_remote_execution: true
             )

    {:ok, approved, _meta} = Registry.approve(registry_path, runner["id"])
    repository = Map.put(repository, "allowedRunnerIds", [runner["id"]])

    assert {:ok, selected} =
             SelectionPolicy.select_for_run(registry_path, repository, maintainer,
               runner_id: approved["id"],
               allow_remote_execution: true,
               remote_execution: true
             )

    assert selected["id"] == runner["id"]

    {:ok, _rotated, new_token} = Registry.rotate_token(registry_path, runner["id"])
    assert new_token =~ "sym_runner_"
    refute new_token == runner_token

    assert Registry.heartbeat(registry_path, runner["id"], runner_token, %{}) ==
             {:error, :runner_token_rotated}

    assert {:ok, _runner, _transition} =
             Registry.heartbeat(registry_path, runner["id"], new_token, %{
               "capabilities" => FakeRunner.capabilities()
             })

    {:ok, _revoked, _meta} = Registry.revoke(registry_path, runner["id"])

    assert Registry.heartbeat(registry_path, runner["id"], new_token, %{}) ==
             {:error, :runner_revoked}
  end

  test "legacy static-token runners load as pending and require token rotation", %{
    registry_path: registry_path,
    maintainer: maintainer,
    repository: repository
  } do
    legacy_runner = %{
      "id" => "runner_legacy",
      "name" => "Legacy runner",
      "mode" => "remote_runner",
      "enabled" => true,
      "trusted" => true,
      "lastHeartbeatAt" => DateTime.utc_now() |> DateTime.to_iso8601(),
      "capabilities" => FakeRunner.capabilities(),
      "limits" => %{"maxConcurrentRuns" => 1},
      "currentRuns" => 0,
      "tokenHash" => Registry.token_hash("legacy-token")
    }

    File.mkdir_p!(Path.dirname(Registry.path(registry_path)))
    File.write!(Registry.path(registry_path), JSON.encode!(%{"runners" => [legacy_runner]}))

    {:ok, migrated} = Registry.get(registry_path, "runner_legacy")
    public = Registry.public(migrated)

    assert public["trustState"] == "pending"
    assert public["tokenState"] == "rotated"
    assert public["requiresTokenRotation"]
    assert Registry.heartbeat(registry_path, "runner_legacy", "legacy-token", %{}) ==
             {:error, :runner_token_rotated}

    {:ok, approved, _meta} = Registry.approve(registry_path, "runner_legacy")
    repository = Map.put(repository, "allowedRunnerIds", [approved["id"]])

    assert {:error, {403, %{"reasonCode" => "runner_token_rotated"}}} =
             SelectionPolicy.select_for_run(registry_path, repository, maintainer,
               runner_id: approved["id"],
               allow_remote_execution: true,
               remote_execution: true
             )

    {:ok, _rotated, token} = Registry.rotate_token(registry_path, "runner_legacy")

    assert {:ok, _selected} =
             SelectionPolicy.select_for_run(registry_path, repository, maintainer,
               runner_id: approved["id"],
               allow_remote_execution: true,
               remote_execution: true
             )

    assert {:ok, _runner, _transition} = Registry.heartbeat(registry_path, "runner_legacy", token, %{})
  end

  test "secret references expose configured metadata but never values or audit env names", %{
    registry_path: registry_path,
    repository: repository,
    owner: owner
  } do
    {:ok, reference} =
      ReferenceStore.create(registry_path, repository, %{
        "label" => "GitHub checkout token",
        "scope" => "repo.checkout",
        "source" => "environment",
        "envName" => "SYMPHONIA_TEST_SECRET"
      })

    assert reference["configured"]
    assert reference["envName"] == "SYMPHONIA_TEST_SECRET"
    refute JSON.encode!(reference) =~ "super-secret-value"

    event =
      AuditLog.record(registry_path, repository, %{
        "actor" => owner,
        "action" => "secret_reference.created",
        "target" => %{"type" => "secret_reference", "id" => reference["id"]},
        "result" => "completed",
        "metadata" => %{
          "secretScope" => "repo.checkout",
          "secretSource" => "environment",
          "envName" => "SYMPHONIA_TEST_SECRET",
          "token" => "sym_runner_secret",
          "reasonCode" => "created"
        }
      })

    encoded = JSON.encode!(event)
    assert event["metadata"] == %{
             "reasonCode" => "created",
             "secretScope" => "repo.checkout",
             "secretSource" => "environment"
           }

    refute encoded =~ "SYMPHONIA_TEST_SECRET"
    refute encoded =~ "super-secret-value"
    refute encoded =~ "sym_runner_secret"
  end

  defp restore_env(key, nil), do: System.delete_env(key)
  defp restore_env(key, value), do: System.put_env(key, value)
end
