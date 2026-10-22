import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { listCharacters, type Character } from "../../services/characters";
import { useAuth } from "../../state/AuthContext";
import { useGameSocket } from "../../state/GameSocketContext";

function normalizedInviteCode(raw: string | undefined) {
  return (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

/** Public invitation is deliberately not behind RequireAuth: preserve returnTo. */
export function JoinInvitePage() {
  const { roomCode: rawRoomCode } = useParams();
  const navigate = useNavigate();
  const { status, authenticated } = useAuth();
  const {
    connected, adventures, latestError, clearError,
    joinRoom, lastRoomEntry, clearRoomEntry,
  } = useGameSocket();

  const roomCode = normalizedInviteCode(rawRoomCode);
  const validCode = roomCode.length === 6 && /^[A-Z0-9]{6}$/.test(rawRoomCode?.trim().toUpperCase() ?? "");
  const returnTo = `/join/${encodeURIComponent(roomCode)}`;
  const [heroes, setHeroes] = useState<Character[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [heroError, setHeroError] = useState("");
  const [heroesLoading, setHeroesLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const occupiedHeroIds = useMemo(
    () => new Set(adventures.filter((item) => !item.completed).map((item) => item.character_id)),
    [adventures],
  );
  const selectableHeroes = useMemo(
    () => heroes.filter((hero) => hero.is_alive && hero.hero_status === "active" && !occupiedHeroIds.has(hero.character_id)),
    [heroes, occupiedHeroIds],
  );

  useEffect(() => {
    if (!authenticated || !validCode) return;
    let alive = true;
    setHeroesLoading(true);
    setHeroError("");
    listCharacters()
      .then((response) => { if (alive) setHeroes(response.characters); })
      .catch((reason) => { if (alive) setHeroError(reason instanceof Error ? reason.message : "Unable to load your Heroes."); })
      .finally(() => { if (alive) setHeroesLoading(false); });
    return () => { alive = false; };
  }, [authenticated, validCode]);

  useEffect(() => {
    if (selectedHeroId && selectableHeroes.some((hero) => hero.character_id === selectedHeroId)) return;
    setSelectedHeroId(selectableHeroes[0]?.character_id ?? "");
  }, [selectedHeroId, selectableHeroes]);

  useEffect(() => {
    if (!lastRoomEntry) return;
    const code = lastRoomEntry.room.code;
    const characterId = lastRoomEntry.character_id;
    clearRoomEntry();
    setJoining(false);
    navigate(`/game/adventure/${encodeURIComponent(code)}?hero=${encodeURIComponent(characterId)}`, { replace: true });
  }, [lastRoomEntry, clearRoomEntry, navigate]);

  useEffect(() => { if (latestError || !connected) setJoining(false); }, [latestError, connected]);

  function enterRoom() {
    if (!connected || !selectedHeroId || !validCode || joining) return;
    clearError();
    setJoining(true);
    joinRoom(selectedHeroId, roomCode);
  }

  const invalid = !validCode;
  const pending = status === "loading";
  const title = invalid ? "This path has faded." : !authenticated ? "A story is better shared." : "Your companion awaits.";
  const intro = invalid
    ? "This invitation has no valid room code. Ask your companion to send a fresh link."
    : !authenticated
      ? "Someone invited you into a living adventure. Sign in or create an account and your invitation will still be here."
      : "Choose the Hero who will join this adventure. The story is already waiting for you.";

  return (
    <section className="qpub-invite" aria-label="Join a shared Quillairo adventure">
      <div className="qpub-invite-art">
        <img src="/art/quillairo-public/auth-journey.png" alt="Ink illustration of a traveler gazing toward a distant castle" />
        <div className="qpub-invite-art-note">
          <span className="qpub-overline">A STORY FOR TWO</span>
          <p>Two perspectives.<br />One unforgettable journey.</p>
        </div>
      </div>
      <div className="qpub-invite-content">
        <header className="qpub-invite-heading">
          <span className="qpub-overline">QUILLAIRO · THE INVITATION</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>

        {!invalid && (
          <div className="qpub-invite-code" aria-label={`Invitation room code ${roomCode}`}>
            <span>YOUR ROOM</span><strong>{roomCode}</strong><span>THE CHAPTER IS WAITING</span>
          </div>
        )}

        {pending ? <p className="qpub-invite-status" role="status">Opening your invitation…</p> : invalid ? (
          <div className="qpub-invite-actions">
            <Link className="qpub-button qpub-button-primary" to={authenticated ? "/game" : "/"}>
              {authenticated ? "Open Adventure Hall" : "Return to the homepage"}<span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : !authenticated ? (
          <div className="qpub-invite-actions">
            <Link className="qpub-button qpub-button-primary" to="/login" state={{ returnTo }}>
              Sign in to join <span aria-hidden="true">↗</span>
            </Link>
            <Link className="qpub-button qpub-button-secondary" to="/register" state={{ returnTo }}>
              Create an account <span aria-hidden="true">↗</span>
            </Link>
            <p>We'll return you to room <strong>{roomCode}</strong> after authentication.</p>
          </div>
        ) : (
          <div className="qpub-invite-join">
            {(heroError || latestError) && (
              <div className="qpub-form-error" role="alert">
                <span>{heroError || latestError}</span>
                {latestError && <button type="button" onClick={clearError}>Dismiss</button>}
              </div>
            )}
            {heroesLoading ? (
              <p className="qpub-invite-status" role="status">Gathering your Heroes…</p>
            ) : heroError ? (
              <p className="qpub-invite-status">Please return to the Hero Hall and try again.</p>
            ) : heroes.length === 0 ? (
              <div className="qpub-invite-empty">
                <h2>Your story needs a Hero.</h2>
                <p>Create a character, and we'll keep this invitation for your return.</p>
                <Link className="qpub-button qpub-button-primary" to={`/game/heroes/new?returnTo=${encodeURIComponent(returnTo)}`}>
                  CREATE HERO <span aria-hidden="true">↗</span>
                </Link>
              </div>
            ) : selectableHeroes.length > 0 ? (
              <form className="qpub-invite-hero-form" onSubmit={(event) => { event.preventDefault(); enterRoom(); }}>
                <fieldset className="qpub-invite-hero-fieldset">
                  <legend>WHO WILL ENTER THE STORY?</legend>
                  <div className="qpub-invite-hero-options">
                    {selectableHeroes.map((hero) => (
                      <label className={`qpub-invite-hero ${selectedHeroId === hero.character_id ? "is-selected" : ""}`} key={hero.character_id}>
                        <input type="radio" name="invite-hero" value={hero.character_id} checked={selectedHeroId === hero.character_id} onChange={() => setSelectedHeroId(hero.character_id)} />
                        <span className="qpub-invite-radio" aria-hidden="true" />
                        <span><strong>{hero.name}</strong><small>{hero.archetype || "Wanderer"} · Level {hero.level}</small></span>
                        <span aria-hidden="true">↗</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {!connected && <p className="qpub-invite-status" role="status">Reconnecting to the adventure room…</p>}
                <button className="qpub-button qpub-button-primary qpub-invite-submit" type="submit" disabled={!connected || !selectedHeroId || joining}>
                  {joining ? "Entering the story…" : connected ? "JOIN ADVENTURE" : "CONNECTING…"}<span aria-hidden="true">↗</span>
                </button>
              </form>
            ) : (
              <div className="qpub-invite-empty">
                <h2>All your Heroes are occupied.</h2>
                <p>Only living, active Heroes who aren't already in an adventure can enter.</p>
                <Link className="qpub-button qpub-button-primary" to={`/game/heroes/new?returnTo=${encodeURIComponent(returnTo)}`}>CREATE HERO <span aria-hidden="true">↗</span></Link>
                <Link className="qpub-button qpub-button-secondary" to="/game/heroes">Open Hero Hall <span aria-hidden="true">↗</span></Link>
              </div>
            )}
          </div>
        )}
        <footer className="qpub-invite-foot"><span aria-hidden="true">✦</span> SOME STORIES ARE BETTER SHARED.</footer>
      </div>
    </section>
  );
}
