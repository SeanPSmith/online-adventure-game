import { useEffect, useMemo, useState } from "react";
import { splitPassage, type NarrationCue } from "../../services/storyNarrator";
import { splitSentencesForDisplay, estimateSentenceIndex } from "../../services/storySentenceSync";

interface StoryRevealProps {
  sceneId: string;
  text: string;
  enabled: boolean;
  followNarration?: boolean;
  narrationCue?: NarrationCue | null;
}

/** Emphasize explicit spoken dialogue without changing the authored text. */
export function isDialogueParagraph(text: string): boolean {
  return /^\s*(?:[“"‘]|[—–]\s+|[\w -]{1,32}:\s*[“"])/.test(text);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function StoryReveal({ sceneId, text, enabled, followNarration = false, narrationCue = null }: StoryRevealProps) {
  const paragraphs = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);
  const words = useMemo(() => paragraphs.map((paragraph) => paragraph.split(/(\s+)/)), [paragraphs]);
  const totalWords = useMemo(
    () => words.flat().filter((token) => token.trim()).length,
    [words],
  );
  // Never flip between a fully-rendered sentence view and a fresh word reveal
  // when narration starts/stops. Scene identity alone resets the reveal.
  const animate = enabled && !prefersReducedMotion();
  const syncSentences = useMemo(() => splitSentencesForDisplay(text), [text]);
  const chunks = useMemo(() => splitPassage(text), [text]);
  const activeSentence = followNarration && narrationCue?.kind === "story"
    ? estimateSentenceIndex(text, chunks, narrationCue) : null;
  const [visibleWords, setVisibleWords] = useState(animate ? 0 : totalWords);

  // A new chapter (or an explicit display-preference change) starts the reveal.
  // Voice arrival and audio completion must never restart or hide words.
  useEffect(() => {
    setVisibleWords(animate ? 0 : totalWords);
  }, [sceneId, text, animate, totalWords]);

  // Voice playback never waits for this animation. In silent mode, progress
  // word by word; while tracking the voice, align to the spoken sentence.
  useEffect(() => {
    if (!animate || followNarration || totalWords === 0) return;
    const timer = window.setInterval(() => {
      setVisibleWords((current) => Math.min(totalWords, current + 1));
    }, 34);
    return () => window.clearInterval(timer);
  }, [animate, followNarration, sceneId, text, totalWords]);

  useEffect(() => {
    if (!animate || !followNarration || activeSentence === null) return;
    const spokenWords = syncSentences.slice(0, activeSentence + 1)
      .reduce((count, sentence) => count + (sentence.text.match(/\S+/g)?.length ?? 0), 0);
    setVisibleWords((current) => Math.max(current, Math.min(totalWords, spokenWords)));
  }, [animate, followNarration, activeSentence, syncSentences, totalWords]);

  let wordIndex = 0;

  return (
    <div
      className={`story-reveal ${animate && visibleWords < totalWords ? "is-unfurling" : ""}`}
      onClick={() => setVisibleWords(totalWords)}
    >
      <span className="sr-only">{text}</span>
      <div aria-hidden="true">
        {followNarration ? paragraphs.map((_, paragraphIndex) => (
          <p key={`${sceneId}:synced:${paragraphIndex}`} className={isDialogueParagraph(paragraphs[paragraphIndex]) ? "story-dialogue-paragraph" : undefined}>
            {syncSentences.map((sentence, sentenceIndex) => sentence.paragraph === paragraphIndex ? (
              <span
                key={`${sceneId}:sentence:${sentenceIndex}`}
                className={`story-follow-sentence ${sentenceIndex === activeSentence ? "is-speaking" : ""}`}
              >{sentence.text.split(/(\s+)/).map((token, tokenIndex) => {
                if (!token.trim()) return token;
                const current = wordIndex++;
                return <span key={`${sentenceIndex}:${tokenIndex}`} className={`story-reveal-word ${current < visibleWords ? "is-visible" : ""}`}>{token}</span>;
              })}</span>
            ) : null)}
          </p>
        )) : words.map((tokens, paragraphIndex) => (
          <p key={`${sceneId}:${paragraphIndex}`} className={isDialogueParagraph(paragraphs[paragraphIndex]) ? "story-dialogue-paragraph" : undefined}>
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
