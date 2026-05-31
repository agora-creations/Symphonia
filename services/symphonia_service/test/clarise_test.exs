defmodule SymphoniaService.ClariseTest do
  use ExUnit.Case

  alias SymphoniaService.Clarise.{
    ArtifactExtractor,
    ChecklistSerializer,
    FeedbackStructurer,
    ReviewNotesBuilder
  }

  test "structures natural feedback into deterministic requested changes" do
    feedback =
      "The card is still too dense. Remove validation from the default card, make the project label smaller, and show retry only when paused."

    assert FeedbackStructurer.structure(feedback) == [
             "Make task cards less dense.",
             "Remove validation from the default card.",
             "Make the project label visually smaller.",
             "Show the retry action only when the task is paused."
           ]
  end

  test "serializes only checklist items for Coding Assistant input" do
    assert ChecklistSerializer.serialize(["Make task cards less dense.", "Remove validation."]) ==
             "Requested changes:\n- Make task cards less dense.\n- Remove validation."
  end

  test "review note preserves original feedback and checklist" do
    note =
      ReviewNotesBuilder.build(
        "Keep the nuance visible.",
        ["Keep the nuance visible."],
        "2026-05-25T10:32:00Z"
      )

    assert note["id"] =~ "review_note_2026_05_25T10_32_00Z_"
    assert note["original_feedback"] == "Keep the nuance visible."
    assert note["requested_changes"] == ["Keep the nuance visible."]
  end

  test "extracts private artifact drafts through Codex App Server" do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-clarise-extractor-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(root)
    fake_app_server = Path.join(root, "fake-app-server.js")
    write_fake_extractor_app_server!(fake_app_server)

    previous_command = System.get_env("SYMPHONIA_CODEX_APP_SERVER_COMMAND")
    previous_timeout = System.get_env("SYMPHONIA_CLARISE_CODEX_TIMEOUT_MS")

    System.put_env("SYMPHONIA_CODEX_APP_SERVER_COMMAND", fake_app_server)
    System.put_env("SYMPHONIA_CLARISE_CODEX_TIMEOUT_MS", "2000")

    on_exit(fn ->
      restore_env("SYMPHONIA_CODEX_APP_SERVER_COMMAND", previous_command)
      restore_env("SYMPHONIA_CLARISE_CODEX_TIMEOUT_MS", previous_timeout)
      File.rm_rf(root)
    end)

    result =
      ArtifactExtractor.extract(%{"path" => root}, %{
        "messages" => [
          %{"role" => "user", "content" => "Create a milestone for Codex extraction."}
        ]
      })

    assert result["source"] == "codex_app_server"
    assert result["plan"]["assistantText"] == "Saving milestone."
    assert [%{"kind" => "milestone"} = draft] = result["plan"]["artifactDrafts"]
    assert draft["metadata"]["private"] == true
    assert draft["metadata"]["source"] == "clarise_chat"
    assert result["plan"]["missingFields"] == []
  end

  defp write_fake_extractor_app_server!(path) do
    File.write!(path, """
    #!/usr/bin/env node
    const readline = require("readline");

    function send(message) {
      process.stdout.write(JSON.stringify(message) + "\\n");
    }

    readline.createInterface({ input: process.stdin }).on("line", (line) => {
      const message = JSON.parse(line);

      if (message.method === "initialize") {
        send({ jsonrpc: "2.0", id: message.id, result: { userAgent: "fake" } });
      } else if (message.method === "thread/start") {
        send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-extract" } } });
      } else if (message.method === "turn/start") {
        const json = {
          assistantText: "Saving milestone.",
          missingFields: [],
          artifactDrafts: [
            {
              kind: "milestone",
              title: "Codex extraction",
              body: "# Milestone - Codex extraction",
              metadata: { title: "Codex extraction", status: "draft", source: "clarise_chat", private: true },
              confirmation: "Created private milestone."
            }
          ]
        };

        send({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-extract", status: "running" } } });
        send({ jsonrpc: "2.0", method: "agent/message/delta", params: { threadId: "thread-extract", turnId: "turn-extract", text: JSON.stringify(json) } });
        send({ jsonrpc: "2.0", method: "turn/completed", params: { threadId: "thread-extract", turn: { id: "turn-extract", status: "completed" } } });
      }
    });
    """)

    File.chmod!(path, 0o700)
  end

  defp restore_env(key, nil), do: System.delete_env(key)
  defp restore_env(key, value), do: System.put_env(key, value)
end
