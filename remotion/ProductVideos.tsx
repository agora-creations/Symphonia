import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  Github,
  GitPullRequestArrow,
  LockKeyhole,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CSSProperties, FC, ReactNode } from "react";

export const ConnectRepositoryVideo: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = springIn(frame, 0, fps);
  const sheet = springIn(frame, 88, fps, 16, 115);
  const repo = springIn(frame, 208, fps, 16, 130);
  const clickPulse = pulse(frame, 64, 96);
  const emptyOpacity = 1 - fade(frame, 82, 28);
  const sheetOpacity = sheet * (1 - fade(frame, 204, 24));

  return (
    <Stage title="Connect a repository" label="GitHub install-first">
      <div
        style={{
          ...styles.repositoryShell,
          opacity: intro,
          transform: `translateY(${lerp(22, 0, intro)}px) scale(${lerp(0.98, 1, intro)})`,
        }}
      >
        <TopLine icon={<Github size={22} />} title="Repositories" meta="No repository connected yet" />

        <div style={{ ...styles.emptyZone, opacity: emptyOpacity }}>
          <div style={styles.emptyMark}>
            <Github size={34} />
          </div>
          <div style={styles.emptyTitle}>Start from GitHub</div>
          <div style={styles.emptyText}>Choose repositories, then return to Symphonía.</div>
          <button
            style={{
              ...styles.primaryButton,
              transform: `scale(${1 + clickPulse * 0.04})`,
              boxShadow: `0 0 ${12 + clickPulse * 28}px rgba(207, 147, 70, ${
                0.12 + clickPulse * 0.26
              })`,
            }}
          >
            <Github size={18} />
            Connect to GitHub
          </button>
        </div>

        <div
          style={{
            ...styles.installSheet,
            opacity: sheetOpacity,
            transform: `translateY(${lerp(54, 0, sheet)}px) scale(${lerp(0.95, 1, sheet)})`,
          }}
        >
          <div style={styles.sheetHeader}>
            <Github size={20} />
            Install GitHub App
          </div>
          <div style={styles.selectRow}>
            <span>agora-creations/symphonia</span>
            <CheckCircle2 size={20} />
          </div>
          <div style={styles.selectRowMuted}>
            <span>desktop-api.multica.ai</span>
            <span>not selected</span>
          </div>
          <div style={styles.returnPill}>Return to Symphonía</div>
        </div>

        <div
          style={{
            ...styles.connectedRepo,
            opacity: repo,
            transform: `translateY(${lerp(34, 0, repo)}px)`,
          }}
        >
          <div style={styles.repoBadge}>
            <Check size={18} />
          </div>
          <div>
            <div style={styles.repoName}>agora-creations/symphonia</div>
            <div style={styles.repoMeta}>Repository connected</div>
          </div>
          <span style={styles.livePill}>ready</span>
        </div>
      </div>
    </Stage>
  );
};

const milestonePrompt =
  "Clarise, create a milestone for the GitHub connection flow.";
const milestoneReply = "I need the goal, scope, and what done looks like.";
const milestoneAnswer = "Goal: reliable GitHub onboarding. Include callback recovery, repo picker, and task handoff.";
const milestoneFinal = "Milestone created with discussion, requirements, plan, and tasks.";

export const ClariseMilestoneVideo: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = springIn(frame, 0, fps);
  const cursorOn = Math.floor(frame / 11) % 2 === 0;
  const promptSent = frame >= 108;
  const answerSent = frame >= 268;
  const typedPrompt = typeText(milestonePrompt, frame - 30, 1.35);
  const typedReply = typeText(milestoneReply, frame - 148, 1.45);
  const typedAnswer = typeText(milestoneAnswer, frame - 190, 1.55);
  const typedFinal = typeText(milestoneFinal, frame - 332, 1.4);
  const artifact = springIn(frame, 382, fps, 14, 150);

  return (
    <Stage title="Clarise creates a milestone" label="Rough ask to task handoff">
      <div
        style={{
          ...styles.chatShell,
          ...styles.expandedChatShell,
          opacity: intro,
          transform: `translateY(${lerp(24, 0, intro)}px) scale(${lerp(0.985, 1, intro)})`,
        }}
      >
        <ChatHeader subtitle="Milestone assistant" />
        <section style={{ ...styles.chatMessages, ...styles.chatMessagesExpanded }}>
          <ChatBubble role="clarise" delay={14}>
            What should we plan next?
          </ChatBubble>
          <ChatBubble role="user" delay={42}>
            {promptSent ? milestonePrompt : typedPrompt}
            {!promptSent && cursorOn ? <span style={styles.cursor}>|</span> : null}
          </ChatBubble>
          <ThinkingDots start={122} end={148} />
          <ChatBubble role="clarise" delay={146}>
            {typedReply}
            {typedReply.length < milestoneReply.length && frame > 148 && cursorOn ? (
              <span style={styles.cursor}>|</span>
            ) : null}
          </ChatBubble>
          <ChatBubble role="user" delay={190}>
            {answerSent ? milestoneAnswer : typedAnswer}
            {!answerSent && frame > 190 && cursorOn ? <span style={styles.cursor}>|</span> : null}
          </ChatBubble>
          <ThinkingDots start={286} end={328} />
          <ChatBubble role="clarise" delay={328}>
            {typedFinal}
            {typedFinal.length < milestoneFinal.length && frame > 332 && cursorOn ? (
              <span style={styles.cursor}>|</span>
            ) : null}
          </ChatBubble>
          <div
            style={{
              ...styles.artifactStack,
              opacity: artifact,
              transform: `translateY(${lerp(28, 0, artifact)}px) scale(${lerp(0.93, 1, artifact)})`,
            }}
          >
            {["Discussion", "Requirements", "Plan", "Tasks"].map((item, index) => (
              <span key={item} style={{ ...styles.artifactChip, opacity: fade(frame, 392 + index * 18, 18) }}>
                <CheckCircle2 size={14} />
                {item}
              </span>
            ))}
          </div>
        </section>
      </div>
    </Stage>
  );
};

export const TaskToReviewVideo: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = springIn(frame, 0, fps);
  const moveA = eased(frame, 92, 176);
  const moveB = eased(frame, 204, 286);
  const cardX = moveA * 312 + moveB * 312;
  const cardY = Math.sin((frame - 74) / 16) * Math.max(0, moveA + moveB) * 8;
  const handoff = springIn(frame, 282, fps, 16, 140);

  return (
    <Stage title="Task goes from To-do to In Review" label="Codex run with a clear handoff">
      <div style={{ ...styles.boardShell, opacity: intro, transform: `translateY(${lerp(22, 0, intro)}px)` }}>
        <TopLine icon={<ClipboardList size={22} />} title="Tasks" meta="GitHub connection polish" />
        <div style={styles.boardColumns}>
          <BoardColumn title="To-do" count="1" />
          <BoardColumn title="In Progress" count={frame > 110 && frame < 280 ? "1" : "0"} active={frame > 110} />
          <BoardColumn title="In Review" count={frame > 286 ? "1" : "0"} active={frame > 286} />
        </div>

        <div
          style={{
            ...styles.movingTask,
            transform: `translate(${cardX}px, ${cardY}px)`,
          }}
        >
          <div style={styles.taskKey}>SYM-128</div>
          <div style={styles.taskTitle}>Repair GitHub callback recovery</div>
          <div style={styles.taskMetaRow}>
            <span style={styles.taskPill}>{taskStatus(frame)}</span>
            <span style={styles.taskPillMuted}>{taskStep(frame)}</span>
          </div>
        </div>

        <div
          style={{
            ...styles.reviewReceipt,
            opacity: handoff,
            transform: `translateY(${lerp(24, 0, handoff)}px) scale(${lerp(0.96, 1, handoff)})`,
          }}
        >
          <GitPullRequestArrow size={21} />
          <div>
            <div style={styles.receiptTitle}>In Review</div>
            <div style={styles.receiptText}>Branch, summary, and proof are ready.</div>
          </div>
        </div>
      </div>
    </Stage>
  );
};

export const AutomationControlledVideo: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = springIn(frame, 0, fps);
  const toggle = springIn(frame, 86, fps, 13, 160);
  const checklist = springIn(frame, 124, fps, 16, 130);
  const queue = springIn(frame, 246, fps, 16, 130);
  const pulseReady = pulse(frame, 210, 258);

  return (
    <Stage title="Automation on, but controlled" label="Only ready tasks can start">
      <div
        style={{
          ...styles.controlShell,
          opacity: intro,
          transform: `translateY(${lerp(22, 0, intro)}px) scale(${lerp(0.985, 1, intro)})`,
        }}
      >
        <TopLine icon={<ShieldCheck size={22} />} title="Automation" meta="Repository settings" />

        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleTitle}>Codex Automation</div>
            <div style={styles.toggleText}>Automatically start work only when safeguards pass.</div>
          </div>
          <div style={{ ...styles.toggleTrack, background: toggle > 0.5 ? "#173f31" : "#d9d7cf" }}>
            <div style={{ ...styles.toggleKnob, transform: `translateX(${lerp(0, 38, toggle)}px)` }} />
          </div>
        </div>

        <div
          style={{
            ...styles.guardPanel,
            opacity: checklist,
            transform: `translateY(${lerp(28, 0, checklist)}px)`,
          }}
        >
          <GuardItem frame={frame} start={136} icon={<FileText size={17} />} text="Workflow rules exist" />
          <GuardItem frame={frame} start={166} icon={<CircleDot size={17} />} text="Task is eligible" />
          <GuardItem frame={frame} start={196} icon={<LockKeyhole size={17} />} text="User can pause or cancel" />
        </div>

        <div style={styles.automationTasks}>
          <AutomationTask
            title="Repair GitHub callback recovery"
            meta={queue > 0 ? "Queued for Codex" : "Ready"}
            ready
            pulse={pulseReady}
            offset={queue * 18}
          />
          <AutomationTask
            title="Define billing workspace policy"
            meta="Blocked: missing acceptance criteria"
            ready={false}
            pulse={0}
            offset={0}
          />
        </div>

        <div
          style={{
            ...styles.automationReceipt,
            opacity: queue,
            transform: `translateY(${lerp(24, 0, queue)}px)`,
          }}
        >
          <Play size={18} />
          One ready task started. Blocked work stayed untouched.
        </div>
      </div>
    </Stage>
  );
};

const Stage: FC<{ title: string; label: string; children: ReactNode }> = ({ title, label, children }) => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 420], [-180, 180], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

  return (
    <AbsoluteFill style={styles.stage}>
      <div style={styles.grid} />
      <div style={{ ...styles.lightBand, transform: `translateX(${sweep}px) rotate(-8deg)` }} />
      <div style={styles.videoTitle}>
        <span style={styles.videoLabel}>{label}</span>
        <strong style={styles.videoHeading}>{title}</strong>
      </div>
      {children}
    </AbsoluteFill>
  );
};

const TopLine: FC<{ icon: ReactNode; title: string; meta: string }> = ({ icon, title, meta }) => (
  <header style={styles.topLine}>
    <div style={styles.topIcon}>{icon}</div>
    <div>
      <div style={styles.topTitle}>{title}</div>
      <div style={styles.topMeta}>{meta}</div>
    </div>
  </header>
);

const ChatHeader: FC<{ subtitle: string }> = ({ subtitle }) => (
  <header style={styles.chatHeader}>
    <div style={styles.chatAvatar}>
      <Sparkles size={20} strokeWidth={2.2} />
    </div>
    <div>
      <div style={styles.chatName}>Clarise</div>
      <div style={styles.chatSubhead}>{subtitle}</div>
    </div>
    <div style={styles.onlinePill}>
      <span style={styles.statusDot} />
      online
    </div>
  </header>
);

const ChatBubble: FC<{ role: "user" | "clarise"; delay: number; children: ReactNode }> = ({
  role,
  delay,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = springIn(frame, delay, fps, 18, 120);

  return (
    <div
      style={{
        ...styles.chatBubbleRow,
        justifyContent: role === "user" ? "flex-end" : "flex-start",
        opacity: intro,
        transform: `translateY(${lerp(18, 0, intro)}px)`,
      }}
    >
      <div style={{ ...styles.chatBubble, ...(role === "user" ? styles.userBubble : styles.clariseBubble) }}>
        {children}
      </div>
    </div>
  );
};

const ChatComposer: FC<{ text: string; pulseFrame: number }> = ({ text, pulseFrame }) => {
  const frame = useCurrentFrame();
  const sendPulse = pulse(frame, pulseFrame, pulseFrame + 34);

  return (
    <footer style={styles.chatComposer}>
      <div style={styles.chatComposerText}>{text}</div>
      <div
        style={{
          ...styles.sendButton,
          transform: `scale(${1 + sendPulse * 0.1}) rotate(${sendPulse * -10}deg)`,
        }}
      >
        <Send size={18} />
      </div>
    </footer>
  );
};

const ThinkingDots: FC<{ start: number; end: number }> = ({ start, end }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + 10, end - 10, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ ...styles.thinking, opacity }}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            ...styles.thinkingDot,
            transform: `translateY(${Math.sin((frame - start - index * 5) / 6) * 4}px)`,
          }}
        />
      ))}
    </div>
  );
};

const BoardColumn: FC<{ title: string; count: string; active?: boolean }> = ({ title, count, active }) => (
  <section style={{ ...styles.boardColumn, ...(active ? styles.boardColumnActive : null) }}>
    <div style={styles.boardColumnHead}>
      <span>{title}</span>
      <b>{count}</b>
    </div>
  </section>
);

const GuardItem: FC<{ frame: number; start: number; icon: ReactNode; text: string }> = ({
  frame,
  start,
  icon,
  text,
}) => {
  const visible = fade(frame, start, 18);
  return (
    <div style={{ ...styles.guardItem, opacity: visible, transform: `translateY(${lerp(12, 0, visible)}px)` }}>
      <span style={styles.guardIcon}>{icon}</span>
      <span>{text}</span>
      <CheckCircle2 size={18} />
    </div>
  );
};

const AutomationTask: FC<{
  title: string;
  meta: string;
  ready: boolean;
  pulse: number;
  offset: number;
}> = ({ title, meta, ready, pulse, offset }) => (
  <div
    style={{
      ...styles.automationTask,
      borderColor: ready ? "#8fc7a4" : "#ddd7cd",
      transform: `translateX(${offset}px) scale(${1 + pulse * 0.015})`,
      boxShadow: ready && pulse > 0 ? `0 0 ${18 + pulse * 20}px rgba(43, 131, 84, 0.18)` : "none",
    }}
  >
    <span style={{ ...styles.taskReadyDot, background: ready ? "#2f9b63" : "#b9b0a2" }} />
    <div>
      <div style={styles.automationTaskTitle}>{title}</div>
      <div style={ready ? styles.automationTaskMetaReady : styles.automationTaskMeta}>{meta}</div>
    </div>
  </div>
);

const typeText = (text: string, frame: number, charsPerFrame: number) => {
  if (frame <= 0) return "";
  return text.slice(0, Math.min(text.length, Math.floor(frame * charsPerFrame)));
};

const springIn = (
  frame: number,
  start: number,
  fps: number,
  damping = 18,
  stiffness = 120,
) =>
  spring({
    frame: frame - start,
    fps,
    config: { damping, stiffness, mass: 0.82 },
  });

const fade = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const eased = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

const pulse = (frame: number, start: number, end: number) => {
  if (frame < start || frame > end) return 0;
  const t = (frame - start) / (end - start);
  return Math.sin(t * Math.PI);
};

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

const taskStatus = (frame: number) => {
  if (frame < 112) return "To-do";
  if (frame < 286) return "In progress";
  return "In Review";
};

const taskStep = (frame: number) => {
  if (frame < 112) return "Ready";
  if (frame < 176) return "Starting Codex";
  if (frame < 236) return "Preparing branch";
  if (frame < 286) return "Writing handoff";
  return "Review ready";
};

const baseFont =
  "Avenir Next, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

const styles = {
  stage: {
    background: "linear-gradient(135deg, #edf2ef 0%, #f7f5ee 48%, #eef5f6 100%)",
    color: "#151411",
    fontFamily: baseFont,
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(21,20,17,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(21,20,17,0.035) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    opacity: 0.8,
  },
  lightBand: {
    position: "absolute",
    left: 170,
    top: -120,
    width: 340,
    height: 960,
    background: "rgba(255,255,255,0.42)",
    filter: "blur(2px)",
  },
  videoTitle: {
    position: "absolute",
    left: 72,
    top: 34,
    display: "grid",
    gap: 6,
  },
  videoLabel: {
    color: "#5f6f67",
    fontSize: 12,
    fontWeight: 860,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  videoHeading: {
    width: 250,
    color: "#151411",
    fontSize: 24,
    lineHeight: 1.04,
    fontWeight: 880,
    letterSpacing: 0,
  },
  repositoryShell: {
    position: "absolute",
    left: 330,
    top: 88,
    width: 620,
    height: 510,
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(21,20,17,0.12)",
    boxShadow: "0 34px 90px rgba(21,20,17,0.16)",
    overflow: "hidden",
  },
  topLine: {
    height: 82,
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "0 26px",
    borderBottom: "1px solid rgba(21,20,17,0.1)",
  },
  topIcon: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: 15,
    color: "#f8f3e9",
    background: "#151411",
  },
  topTitle: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 860,
    letterSpacing: 0,
  },
  topMeta: {
    marginTop: 5,
    color: "#6c695f",
    fontSize: 13,
    fontWeight: 680,
    letterSpacing: 0,
  },
  emptyZone: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 82,
    bottom: 0,
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 13,
  },
  emptyMark: {
    width: 78,
    height: 78,
    display: "grid",
    placeItems: "center",
    borderRadius: 24,
    color: "#173f31",
    background: "#dcefe4",
  },
  emptyTitle: {
    fontSize: 30,
    fontWeight: 880,
    letterSpacing: 0,
  },
  emptyText: {
    width: 330,
    color: "#716e65",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 1.35,
    fontWeight: 660,
  },
  primaryButton: {
    marginTop: 8,
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 18px",
    border: 0,
    borderRadius: 999,
    color: "#151411",
    background: "#efbd70",
    fontSize: 15,
    fontWeight: 820,
  },
  installSheet: {
    position: "absolute",
    left: 74,
    right: 74,
    bottom: 48,
    padding: 16,
    borderRadius: 22,
    background: "#fbfaf5",
    border: "1px solid rgba(21,20,17,0.14)",
    boxShadow: "0 20px 50px rgba(21,20,17,0.16)",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: 850,
  },
  selectRow: {
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    borderRadius: 14,
    color: "#173f31",
    background: "#dcefe4",
    fontSize: 14,
    fontWeight: 800,
  },
  selectRowMuted: {
    minHeight: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    color: "#817d73",
    fontSize: 12,
    fontWeight: 720,
  },
  returnPill: {
    marginLeft: "auto",
    width: 164,
    minHeight: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    color: "#ffffff",
    background: "#173f31",
    fontSize: 12,
    fontWeight: 830,
  },
  connectedRepo: {
    position: "absolute",
    left: 74,
    right: 74,
    bottom: 58,
    minHeight: 78,
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "0 18px",
    borderRadius: 22,
    color: "#173f31",
    background: "#dcefe4",
    border: "1px solid rgba(23,63,49,0.13)",
  },
  repoBadge: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    color: "#ffffff",
    background: "#2f9b63",
  },
  repoName: {
    fontSize: 17,
    fontWeight: 860,
    letterSpacing: 0,
  },
  repoMeta: {
    marginTop: 4,
    color: "#496b59",
    fontSize: 12,
    fontWeight: 720,
  },
  livePill: {
    marginLeft: "auto",
    padding: "6px 10px",
    borderRadius: 999,
    color: "#173f31",
    background: "#ffffff",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "uppercase",
  },
  chatShell: {
    position: "absolute",
    left: 344,
    top: 56,
    width: 592,
    height: 610,
    display: "grid",
    gridTemplateRows: "82px 1fr 76px",
    border: "1px solid rgba(21,20,17,0.12)",
    borderRadius: 32,
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 34px 90px rgba(21,20,17,0.16)",
    overflow: "hidden",
  },
  expandedChatShell: {
    gridTemplateRows: "82px 1fr",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "0 24px",
    borderBottom: "1px solid rgba(21,20,17,0.1)",
  },
  chatAvatar: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: 16,
    color: "#f8f3e9",
    background: "#151411",
  },
  chatName: {
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 860,
    letterSpacing: 0,
  },
  chatSubhead: {
    marginTop: 5,
    color: "#6c695f",
    fontSize: 12,
    fontWeight: 690,
  },
  onlinePill: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#35644f",
    fontSize: 12,
    fontWeight: 820,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#2f9b63",
  },
  chatMessages: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: 11,
    padding: "22px 24px 20px",
  },
  chatMessagesExpanded: {
    gap: 9,
    paddingBottom: 92,
  },
  chatBubbleRow: {
    display: "flex",
  },
  chatBubble: {
    maxWidth: 406,
    minHeight: 40,
    borderRadius: 21,
    padding: "12px 15px",
    fontSize: 17,
    lineHeight: 1.23,
    fontWeight: 760,
    letterSpacing: 0,
  },
  clariseBubble: {
    color: "#191815",
    background: "#ece7dc",
    borderBottomLeftRadius: 7,
  },
  userBubble: {
    color: "#fffaf0",
    background: "#151411",
    borderBottomRightRadius: 7,
  },
  cursor: {
    display: "inline-block",
    marginLeft: 2,
    opacity: 0.8,
  },
  thinking: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: 74,
    height: 42,
    padding: "0 16px",
    borderRadius: 21,
    background: "#ece7dc",
    borderBottomLeftRadius: 7,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#716e65",
  },
  artifactStack: {
    position: "absolute",
    left: 78,
    right: 78,
    bottom: 24,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  artifactChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minHeight: 30,
    padding: "0 10px",
    borderRadius: 999,
    color: "#173f31",
    background: "#dcefe4",
    fontSize: 11,
    fontWeight: 850,
  },
  chatComposer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px 18px",
    borderTop: "1px solid rgba(21,20,17,0.1)",
  },
  chatComposerText: {
    flex: 1,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    padding: "0 17px",
    borderRadius: 999,
    color: "#746e62",
    background: "#f1eee5",
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  sendButton: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    color: "#151411",
    background: "#efbd70",
  },
  boardShell: {
    position: "absolute",
    left: 128,
    top: 106,
    width: 1024,
    height: 500,
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(21,20,17,0.12)",
    boxShadow: "0 34px 90px rgba(21,20,17,0.16)",
    overflow: "hidden",
  },
  boardColumns: {
    position: "absolute",
    left: 38,
    right: 38,
    top: 116,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
  },
  boardColumn: {
    height: 292,
    borderRadius: 22,
    background: "#f3f1eb",
    border: "1px solid rgba(21,20,17,0.1)",
  },
  boardColumnActive: {
    background: "#eef5f0",
    border: "1px solid rgba(47,155,99,0.24)",
  },
  boardColumnHead: {
    height: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    color: "#4d4a43",
    fontSize: 14,
    fontWeight: 850,
  },
  movingTask: {
    position: "absolute",
    left: 58,
    top: 192,
    width: 276,
    minHeight: 128,
    padding: 16,
    borderRadius: 20,
    color: "#151411",
    background: "#ffffff",
    border: "1px solid rgba(21,20,17,0.13)",
    boxShadow: "0 18px 40px rgba(21,20,17,0.14)",
  },
  taskKey: {
    color: "#2f9b63",
    fontSize: 11,
    fontWeight: 880,
    letterSpacing: 0,
  },
  taskTitle: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 1.08,
    fontWeight: 880,
    letterSpacing: 0,
  },
  taskMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },
  taskPill: {
    padding: "5px 8px",
    borderRadius: 999,
    color: "#173f31",
    background: "#dcefe4",
    fontSize: 10,
    fontWeight: 870,
  },
  taskPillMuted: {
    padding: "5px 8px",
    borderRadius: 999,
    color: "#68645b",
    background: "#f0ede5",
    fontSize: 10,
    fontWeight: 820,
  },
  reviewReceipt: {
    position: "absolute",
    left: 660,
    bottom: 38,
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 314,
    minHeight: 62,
    padding: "0 18px",
    borderRadius: 20,
    color: "#173f31",
    background: "#dcefe4",
    border: "1px solid rgba(23,63,49,0.13)",
  },
  receiptTitle: {
    fontSize: 17,
    fontWeight: 870,
    letterSpacing: 0,
  },
  receiptText: {
    marginTop: 4,
    color: "#496b59",
    fontSize: 12,
    fontWeight: 720,
  },
  controlShell: {
    position: "absolute",
    left: 310,
    top: 82,
    width: 660,
    height: 548,
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(21,20,17,0.12)",
    boxShadow: "0 34px 90px rgba(21,20,17,0.16)",
    overflow: "hidden",
  },
  toggleRow: {
    height: 94,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px",
    borderBottom: "1px solid rgba(21,20,17,0.1)",
  },
  toggleTitle: {
    fontSize: 22,
    fontWeight: 880,
    letterSpacing: 0,
  },
  toggleText: {
    marginTop: 6,
    color: "#6c695f",
    fontSize: 13,
    fontWeight: 680,
  },
  toggleTrack: {
    width: 84,
    height: 46,
    borderRadius: 999,
    padding: 4,
  },
  toggleKnob: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#ffffff",
    boxShadow: "0 4px 14px rgba(21,20,17,0.18)",
  },
  guardPanel: {
    margin: "16px 30px 0",
    display: "grid",
    gap: 8,
  },
  guardItem: {
    minHeight: 36,
    display: "grid",
    gridTemplateColumns: "28px 1fr 24px",
    alignItems: "center",
    gap: 10,
    padding: "0 12px",
    borderRadius: 14,
    color: "#173f31",
    background: "#eef7f1",
    fontSize: 13,
    fontWeight: 800,
  },
  guardIcon: {
    color: "#2f9b63",
    display: "grid",
    placeItems: "center",
  },
  automationTasks: {
    margin: "14px 30px 0",
    display: "grid",
    gap: 8,
  },
  automationTask: {
    minHeight: 54,
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    alignItems: "center",
    gap: 12,
    padding: "0 14px",
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid",
  },
  taskReadyDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  automationTaskTitle: {
    fontSize: 15,
    fontWeight: 850,
    letterSpacing: 0,
  },
  automationTaskMeta: {
    marginTop: 4,
    color: "#7c7468",
    fontSize: 12,
    fontWeight: 720,
  },
  automationTaskMetaReady: {
    marginTop: 4,
    color: "#2d7651",
    fontSize: 12,
    fontWeight: 780,
  },
  automationReceipt: {
    position: "absolute",
    left: 30,
    right: 30,
    bottom: 16,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    borderRadius: 18,
    color: "#151411",
    background: "#efbd70",
    fontSize: 14,
    fontWeight: 840,
  },
} satisfies Record<string, CSSProperties>;
