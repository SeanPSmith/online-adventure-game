import {
  Component,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";

interface BoundaryProps {
  children: ReactNode;
  score: number;
  onScoreChange: (score: number) => void;
}

interface BoundaryState {
  failed: boolean;
}

export class IntermissionGameBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    failed: false,
  };

  static getDerivedStateFromError(): BoundaryState {
    return {
      failed: true,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[INTERMISSION GAME ERROR]", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <IntermissionFallback
          score={this.props.score}
          onScoreChange={this.props.onScoreChange}
        />
      );
    }

    return this.props.children;
  }
}

function IntermissionFallback({
  score,
  onScoreChange,
}: {
  score: number;
  onScoreChange: (score: number) => void;
}) {
  const [message, setMessage] = useState("CABINET JAMMED // FALLBACK CHANNEL OPEN_");
  const lockedUntilRef = useRef(0);

  function tap() {
    const now = performance.now();
    if (now < lockedUntilRef.current) return;

    lockedUntilRef.current = now + 300;
    onScoreChange(Math.min(999, score + 1));
    setMessage("SIGNAL CAUGHT // +1_");
  }

  return (
    <div className="intermission-game cabinet-fallback">
      <header className="intermission-game-instructions">
        <strong>THE ARCADE CABINET ATE A GEAR.</strong>
        <span>THE STORY ENGINE IS FINE. THIS GAME IS NOT.</span>
        <span>TAP THE SIGNAL FOR POINTS WHILE THE DIRECTOR FINISHES.</span>
      </header>

      <button
        className="cabinet-fallback-button"
        type="button"
        onClick={tap}
      >
        [ TAP THE SIGNAL ]
      </button>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>SAFE FALLBACK ACTIVE</strong>
      </footer>
    </div>
  );
}
