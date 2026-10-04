import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { listCharacters, type Character } from "../../services/characters";
import { useAuth } from "../../state/AuthContext";
import { useGameSocket } from "../../state/GameSocketContext";

function normalizedInviteCode(raw: string | undefined) {
  return (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function JoinInvitePage() {
  const { roomCode: rawRoomCode } = useParams();
  const navigate = useNavigate();
  const { status, authenticated } = useAuth();
  const {
    connected,
    adventures,
    latestError,
    clearError,
    joinRoom,
    lastRoomEntry,
    clearRoomEntry,
  } = useGameSocket();

  const roomCode = normalizedInviteCode(rawRoomCode);
  const returnTo = `/join/${encodeURIComponent(roomCode)}`;
  const [heroes, setHeroes] = useState<Character[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [heroError, setHeroError] = useState("");
  const [joining, setJoining] = useState(false);

  const occupiedHeroIds = useMemo(
    () => new Set(adventures.filter((item) => !item.completed).map((item) => item.character_id)),
    [adventures],
  );

  const selectableHeroes = useMemo(
    () => heroes.filter((hero) => !occupiedHeroIds.has(hero.character_id)),
    [heroes, occupiedHeroIds],
  );

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;

    listCharacters()
      .then((response) => {
        if (!alive) return;
        setHeroes(response.characters);
      })
      .catch((reason) => {
        if (!alive) return;
        setHeroError(reason instanceof Error ? reason.message : "Unable to load your Heroes.");
      });

    return () => {
      alive = false;
    };
  }, [authenticated]);

  useEffect(() => {
    if (
      selectedHeroId &&
      selectableHeroes.some((hero) => hero.character_id === selectedHeroId)
    ) {
      return;
    }
    setSelectedHeroId(selectableHeroes[0]?.character_id ?? "");
  }, [selectedHeroId, selectableHeroes]);

  useEffect(() => {
    if (!lastRoomEntry) return;

    const code = lastRoomEntry.room.code;
    const characterId = lastRoomEntry.character_id;
    clearRoomEntry();
    setJoining(false);
    navigate(
      `/game/adventure/${encodeURIComponent(code)}?hero=${encodeURIComponent(characterId)}`,
      { replace: true },
    );
  }, [lastRoomEntry, clearRoomEntry, navigate]);

  useEffect(() => {
    if (latestError) setJoining(false);
  }, [latestError]);

  function enterRoom() {
    if (!connected || !selectedHeroId || roomCode.length !== 6) return;
    clearError();
    setJoining(true);
    joinRoom(selectedHeroId, roomCode);
  }

  if (status === "loading") {
    return <div className="route-loading">READING THE INVITATION_</div>;
  }

  if (roomCode.length !== 6) {
    return (
      <section className="invite-landing panel">
        <header className="panel-heading">BAD INVITATION</header>
        <div className="panel-body invite-landing-body">
          <span className="eyebrow">ROOM CODE INVALID</span>
          <h1>THAT THREAD DOESN'T HAVE A VALID ADDRESS.</h1>
          <p>Ask your partner for a new invite link or a six-character room code.</p>
          <Link className="button button-primary" to={authenticated ? "/game" : "/"}>
            {authenticated ? "OPEN ADVENTURE HALL" : "RETURN HOME"}
          </Link>
        </div>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="invite-landing panel">
        <header className="panel-heading">YOU'VE BEEN INVITED</header>
        <div className="panel-body invite-landing-body">
          <span className="eyebrow">TALES OF TWO // ROOM {roomCode}</span>
          <h1>SOMEBODY IS WAITING FOR YOU IN THE STORY.</h1>
          <p>
            Sign in or create an account. We'll keep this invitation and bring you back
            to room <strong>{roomCode}</strong> afterward.
          </p>
          <div className="invite-auth-actions">
            <Link className="button button-primary" to="/login" state={{ returnTo }}>
              SIGN IN TO JOIN
            </Link>
            <Link className="button" to="/register" state={{ returnTo }}>
              CREATE ACCOUNT
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="invite-landing panel">
      <header className="panel-heading">JOIN THE THREAD</header>
      <div className="panel-body invite-landing-body">
        <div className="invite-room-code">
          <span className="eyebrow">ROOM</span>
          <strong>{roomCode}</strong>
        </div>

        <h1>CHOOSE WHO IS WALKING IN.</h1>
        <p>The room code is already loaded from your invite. Pick an available Hero and enter.</p>

        {heroError || latestError ? (
          <div className="form-error">
            {heroError || latestError}
            {latestError ? (
              <button className="inline-dismiss" type="button" onClick={clearError}>DISMISS</button>
            ) : null}
          </div>
        ) : null}

        {heroes.length === 0 && !heroError ? (
          <div className="system-notice invite-no-hero">
            <strong>YOU NEED A HERO FIRST.</strong>
            <span>Create one, then we'll bring you back to this invitation.</span>
            <Link
              className="button button-primary"
              to={`/game/heroes/new?returnTo=${encodeURIComponent(returnTo)}`}
            >
              CREATE HERO
            </Link>
          </div>
        ) : selectableHeroes.length > 0 ? (
          <div className="join-room-form invite-join-form">
            <label>
              <span>ENTER AS</span>
              <select value={selectedHeroId} onChange={(event) => setSelectedHeroId(event.target.value)}>
                {selectableHeroes.map((hero) => (
                  <option value={hero.character_id} key={hero.character_id}>
                    {hero.name} // LVL {hero.level}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="button button-primary"
              type="button"
              disabled={!connected || !selectedHeroId || joining}
              onClick={enterRoom}
            >
              {joining ? "ENTERING THE THREAD_" : connected ? "JOIN ADVENTURE" : "CONNECTING_"}
            </button>
          </div>
        ) : heroes.length > 0 ? (
          <div className="system-notice invite-no-hero">
            <strong>ALL OF YOUR HEROES ARE ALREADY IN ACTIVE JOURNEYS.</strong>
            <Link className="button" to="/game">OPEN ADVENTURE HALL</Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
