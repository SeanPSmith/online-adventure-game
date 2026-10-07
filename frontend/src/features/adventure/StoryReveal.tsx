import { useEffect, useMemo, useState } from "react";

interface StoryRevealProps {
  sceneId: string;
  text: string;
  enabled: boolean;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function StoryReveal({ sceneId, text, enabled }: StoryRevealProps) {
  const paragraphs = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);
  const words = useMemo(() => paragraphs.map((paragraph) => paragraph.split(/(\s+)/)), [paragraphs]);
  const totalWords = useMemo(
    () => words.flat().filter((token) => token.trim()).length,
    [words],
  );
  const animate = enabled && !prefersReducedMotion();
  const [visibleWords, setVisibleWords] = useState(animate ? 0 : totalWords);

  useEffect(() => {
    if (!animate) {
      setVisibleWords(totalWords);
      return;
    }

    setVisibleWords(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setVisibleWords(count);
      if (count >= totalWords) window.clearInterval(timer);
    }, 34);
    return () => window.clearInterval(timer);
  }, [sceneId, text, animate, totalWords]);

  let wordIndex = 0;

  return (
    <div
      className={`story-reveal ${animate && visibleWords < totalWords ? "is-unfurling" : ""}`}
      onClick={() => setVisibleWords(totalWords)}
    >
      <span className="sr-only">{text}</span>
      <div aria-hidden="true">
        {words.map((tokens, paragraphIndex) => (
          <p key={`${sceneId}:${paragraphIndex}`}>
            {tokens.map((token, tokenIndex) => {
              if (!token.trim()) return token;
              const current = wordIndex++;
              return (
                <span
                  className={`story-reveal-word ${current < visibleWords ? "is-visible" : ""}`}
                  key={`${current}:${tokenIndex}`}
                >
                  {token}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      {animate && visibleWords < totalWords ? (
        <button className="story-reveal-skip" type="button" onClick={(event) => {
          event.stopPropagation();
          setVisibleWords(totalWords);
        }}>
          REVEAL ALL
        </button>
      ) : null}
    </div>
  );
}
