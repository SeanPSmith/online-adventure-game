import { BrandLockup } from "../../components/brand/BrandLockup";
/** The real pre-chapter lobby, rendered with server-owned readiness/start actions.
 * No story is generated until the host invokes onBeginAdventure.
 */
import { Link } from "react-router";
import type { InkPaper } from "../../features/appearance/inkboundPaper";
import type { ReadinessPlayer, RoomPlayer } from "../../services/game";
import { RoomInviteButton } from "../../components/game/RoomInviteButton";
import "./quillairoLobbyPass6645.css";

export interface InkboundLobbyProps {
  roomCode: string;
  paper: InkPaper;
  title: string;
  synopsis: string;
  fantasyArtwork: boolean;
  playMode: "coop" | "solo";
  players: readonly RoomPlayer[];
  readiness: readonly ReadinessPlayer[];
  playerId: string | null;
  isHost: boolean;
  connected: boolean;
  canBeginAdventure: boolean;
  chapterPreparing: boolean;
  canStartSolo: boolean;
  onStartSolo: () => void;
  narratorEnabled: boolean;
  narratorName: string;
  onToggleNarrator: () => void;
  onBeginAdventure: () => void;
  onClassicView: () => void;
}

export function InkboundLobby(props: InkboundLobbyProps) {
  return <div className="inkbound inkbound-lobby" data-ink-paper={props.paper}>
    <a className="inkbound-skip" href="#inkbound-lobby-main">Skip to adventure readiness</a>
    <header className="ibl-topbar">
      <Link className="ibl-brand" to="/game" aria-label="Quillairo home"><BrandLockup paper={props.paper} /></Link>
      <nav aria-label="Lobby navigation" className="ibl-nav">
        <Link to="/game">Adventure hall</Link>
        <Link to="/game/heroes">Your heroes</Link>
        <button type="button" onClick={props.onClassicView}>Classic view</button>
      </nav>
    </header>
    <main id="inkbound-lobby-main" className="ibl-lobby-main">
      <div className="ibl-lobby-intro">
        <span className="ibl-lobby-kicker">The beginning · Room {props.roomCode}</span>
        <h1>{props.title}</h1>
        <p className="ibl-lobby-subtitle">A new chronicle waits to be written.</p>
      </div>
      {props.fantasyArtwork ? <figure className="ibl-lobby-art">
        <img src="/art/inkbound/north-road-editorial.png" alt="Two adventurers gaze across an ink-washed fantasy valley" />
      </figure> : <div className="ibl-lobby-open-space" aria-hidden="true" />}
      <section className="ibl-lobby-synopsis" aria-labelledby="ibl-lobby-about">
        <span id="ibl-lobby-about" className="ibl-lobby-kicker">The tale ahead</span>
        <p>{props.synopsis || "A new road opens before your Hero. Every choice will shape the tale that follows."}</p>
      </section>
      <section className="ibl-lobby-preparation" aria-label="Party readiness" data-can-begin={props.canBeginAdventure && props.connected ? "yes" : "no"}>
        <div className="ibl-lobby-roster">
          <h2>{props.playMode === "coop" ? "Two travelers, one story" : "The solitary road"}</h2>
          <p>{props.chapterPreparing ? "The Story Director is preparing your first chapter." : props.playMode === "coop" ? "Your adventure starts when the host and party are ready." : "Your first chapter will be written when you begin."}</p>
          <div className="ibl-lobby-party-list">
            {props.players.map((person) => {
              const readiness = props.readiness.find((candidate) => candidate.player_id === person.player_id);
              const online = readiness?.online ?? person.is_online;
              return <div className="ibl-lobby-player" key={person.player_id}>
                <span className="ibl-lobby-player-mark" aria-hidden="true">{online ? "✦" : "◇"}</span>
                <span><strong>{person.player_id === props.playerId ? "You" : person.name}</strong><small>{person.is_host ? "Host" : "Companion"}</small></span>
                <em>{!online ? "Offline" : readiness?.ready ? "Ready" : "Here"}</em>
              </div>;
            })}
            {props.playMode === "coop" && props.players.length < 2 ? <p className="ibl-lobby-absent">An empty place at the table awaits your companion.</p> : null}
          </div>
          {props.playMode === "coop" && props.isHost ? <RoomInviteButton roomCode={props.roomCode} adventureTitle={props.title} className="ibl-lobby-invite" label="Invite your companion →" /> : null}
          {props.canStartSolo && props.isHost && <button type="button" className="ibl-lobby-invite" onClick={props.onStartSolo}>Continue as solo →</button>}
        </div>
        <div className="ibl-lobby-actions">
          <span className="ibl-lobby-kicker">Before the first page</span>
          <button type="button" className="ibl-lobby-narrator" onClick={props.onToggleNarrator} aria-pressed={props.narratorEnabled}>
            <span>Story Time</span><strong>{props.narratorEnabled ? "On" : "Off"}</strong>
          </button>
          {props.narratorEnabled && <p className="ibl-lobby-narrator-name">Voice: {props.narratorName}</p>}
          {props.isHost ? <button type="button" className="ibl-lobby-begin" disabled={!props.connected || !props.canBeginAdventure || props.chapterPreparing} onClick={props.onBeginAdventure}>
            {props.chapterPreparing ? "Writing Chapter One…" : props.canBeginAdventure ? "BEGIN ADVENTURE →" : "AWAITING YOUR PARTY"}
          </button> : <p className="ibl-lobby-wait" role="status">The host will begin when everyone is ready.</p>}
          <p className="ibl-lobby-status" role="status" aria-live="polite">{!props.connected ? "Connection interrupted — waiting to reconnect" : props.chapterPreparing ? "The first chapter is being generated. No choices or dice rolls yet." : props.canBeginAdventure ? "Ready to begin" : "Waiting for the party"}</p>
        </div>
      </section>
    </main>
    <footer className="ibl-footer"><span>Some stories are better shared.</span><span>Room {props.roomCode}</span></footer>
  </div>;
}
