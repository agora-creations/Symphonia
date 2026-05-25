defmodule SymphoniaService.Harness.Daemon do
  @moduledoc """
  Always-on scheduler for enabled repositories.
  """

  use GenServer

  alias SymphoniaService.{CodingAssistant, RepositoryRegistry, TaskStore}
  alias SymphoniaService.Harness.{Automation, Eligibility}

  @max_recent_decisions 50

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  def ensure_started(registry_path \\ SymphoniaService.default_registry_path()) do
    case Process.whereis(__MODULE__) do
      nil ->
        case GenServer.start_link(__MODULE__, [registry_path: registry_path], name: __MODULE__) do
          {:ok, _pid} -> :ok
          {:error, {:already_started, _pid}} -> :ok
        end

      _pid ->
        :ok
    end
  end

  def tick(name \\ __MODULE__), do: GenServer.call(name, :tick, 30_000)
  def status(name \\ __MODULE__), do: GenServer.call(name, :status)

  @impl true
  def init(opts) do
    state = %{
      registry_path: Keyword.get(opts, :registry_path, SymphoniaService.default_registry_path()),
      interval_ms: Keyword.get(opts, :interval_ms, interval_ms()),
      recent_decisions: [],
      claimed: MapSet.new(),
      timer?: Keyword.get(opts, :timer?, true)
    }

    if state.timer?, do: schedule_tick(state.interval_ms)
    {:ok, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply,
     %{
       "running" => true,
       "intervalMs" => state.interval_ms,
       "recentDecisions" => Enum.reverse(state.recent_decisions)
     }, state}
  end

  def handle_call(:tick, _from, state) do
    {decisions, state} = dispatch_once(state)
    {:reply, %{"decisions" => decisions}, state}
  end

  @impl true
  def handle_info(:tick, state) do
    {_decisions, state} = dispatch_once(state)
    if state.timer?, do: schedule_tick(state.interval_ms)
    {:noreply, state}
  end

  defp dispatch_once(state) do
    {decisions, claimed} =
      state.registry_path
      |> RepositoryRegistry.list()
      |> Enum.filter(&Automation.enabled?/1)
      |> Enum.flat_map_reduce(state.claimed, fn repository, claimed ->
        repository
        |> TaskStore.list_tasks()
        |> Enum.map_reduce(claimed, fn task, claimed ->
          dispatch_task(state.registry_path, repository, task, claimed)
        end)
      end)

    decisions = List.flatten(decisions)

    state = %{
      state
      | claimed: claimed,
        recent_decisions: take_recent(decisions ++ state.recent_decisions)
    }

    {decisions, state}
  end

  defp dispatch_task(registry_path, repository, task, claimed) do
    claim_key = "#{repository["key"]}:#{task["key"]}"
    eligibility = Eligibility.explain(repository, task)

    cond do
      MapSet.member?(claimed, claim_key) ->
        {[
           decision(
             repository,
             task,
             "already_claimed",
             false,
             "Task is already claimed by the daemon."
           )
         ], claimed}

      eligibility["eligible"] ->
        claimed = MapSet.put(claimed, claim_key)

        result =
          CodingAssistant.start_harness_run(registry_path, repository, task["key"], %{
            "eligibility_reason" => eligibility["reason"]
          })

        claimed = MapSet.delete(claimed, claim_key)

        {[
           decision(
             repository,
             task,
             "dispatched",
             true,
             "Dispatched run #{result["run"]["id"]}."
           )
         ], claimed}

      true ->
        {[decision(repository, task, eligibility["code"], false, eligibility["reason"])], claimed}
    end
  rescue
    error ->
      {[
         decision(
           repository,
           task,
           "dispatch_error",
           false,
           Exception.message(error)
         )
       ], claimed}
  end

  defp decision(repository, task, code, dispatched?, reason) do
    %{
      "at" => now(),
      "repo" => repository["key"],
      "task" => task["key"],
      "code" => code,
      "dispatched" => dispatched?,
      "reason" => reason
    }
  end

  defp take_recent(decisions) do
    decisions
    |> List.wrap()
    |> Enum.take(@max_recent_decisions)
  end

  defp schedule_tick(interval_ms), do: Process.send_after(self(), :tick, interval_ms)

  defp interval_ms do
    case Integer.parse(System.get_env("SYMPHONIA_HARNESS_DAEMON_INTERVAL_MS") || "") do
      {value, ""} when value > 0 -> value
      _ -> 15_000
    end
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()
end
