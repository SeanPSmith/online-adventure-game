from pathlib import Path


FRONTEND = Path("frontend/src")


def read(relative: str) -> str:
    return (FRONTEND / relative).read_text()


def test_adventure_synopsis_uses_generated_player_synopsis() -> None:
    source = read("pages/game/GameHomePage.tsx")

    assert "metadata?.player_synopsis" in source
    assert "generatedSynopsis(pendingAdventure)" in source
    assert "AI-GENERATED PLAYER SYNOPSIS" in source


def test_adventure_page_exposes_retry_without_reroll_ui() -> None:
    page = read("pages/game/AdventurePage.tsx")
    live = read("state/useLiveAdventure.ts")

    assert "director_retry_required" in page
    assert "live.retryPendingTurn()" in page
    assert 'emit("retry_pending_turn"' in live


def test_return_to_game_uses_last_game_route_memory() -> None:
    adventure = read("pages/game/AdventurePage.tsx")
    account = read("layouts/AccountLayout.tsx")
    memory = read("services/gameRouteMemory.ts")

    assert "rememberGameRoute(`${location.pathname}${location.search}`)" in adventure
    assert "readLastGameRoute()" in account
    assert "tot:last-game-route" in memory
    assert 'clean.startsWith("/game")' in memory


def test_ascii_picker_is_interactive_and_inserts_chat_text() -> None:
    page = read("pages/game/AdventurePage.tsx")

    assert "setAsciiPickerOpen((current) => !current)" in page
    assert "function insertAsciiFace(face: string)" in page
    assert "onClick={() => insertAsciiFace(face)}" in page


def test_director_retry_failure_stays_in_turn_theater_modal() -> None:
    page = read("pages/game/AdventurePage.tsx")
    theater = read("features/adventure/useTurnTheater.ts")

    assert "error: live.error" in page
    assert "!live.game?.director_retry_required" in page
    assert "director-retry-panel" not in page
    assert "game?.director_retry_required ? error" in theater


def test_retry_pending_turn_reuses_frozen_snapshot_without_readiness_recheck() -> None:
    backend = Path("app/main.py").read_text()
    start = backend.index("async def retry_pending_turn")
    end = backend.index("# =========================================================\n# INTERMISSION SCORE", start)
    retry_handler = backend[start:end]

    assert "session.pending_turn_facts" in retry_handler
    assert "resolve_turn(" in retry_handler
    assert "all_players_ready(" not in retry_handler
    assert "The locked turn is incomplete and cannot be retried yet." not in retry_handler


def test_legacy_underfilled_started_room_recovery_is_wired_into_resume_and_choice_flow() -> None:
    backend = Path("app/main.py").read_text()

    resume_start = backend.index("async def resume_adventure")
    resume_end = backend.index("# =========================================================\n# LEAVE ADVENTURE", resume_start)
    resume_handler = backend[resume_start:resume_end]

    choice_start = backend.index("async def submit_choice")
    choice_end = backend.index("# =========================================================\n# QUICK MICRO-EVENT RESPONSE", choice_start)
    choice_handler = backend[choice_start:choice_end]

    assert "recover_legacy_single_player_session(" in resume_handler
    assert "recover_legacy_single_player_session(" in choice_handler
    assert "if not room.has_required_party:" in choice_handler
    assert choice_handler.index("recover_legacy_single_player_session(") < choice_handler.index("if not room.has_required_party:")


def test_adventure_hall_has_server_backed_emergency_exit_controls() -> None:
    home = read("pages/game/GameHomePage.tsx")
    socket_context = read("state/GameSocketContext.tsx")

    assert 'emit("abandon_adventure"' in socket_context
    assert 'emit("leave_adventure"' in socket_context
    assert '"ABANDON FOR GOOD"' in home
    assert '"LEAVE ROOM"' in home
    assert "adventure.director_retry_required" in home
    assert "adventure.director_request_active" in home


def test_resume_watchdog_prevents_infinite_restoring_screen() -> None:
    live = read("state/useLiveAdventure.ts")
    page = read("pages/game/AdventurePage.tsx")

    assert "resumeWatchdog" in live
    assert "12000" in live
    assert "did not finish restoring this room" in live
    assert "RETURN TO ADVENTURE HALL" in page


def test_director_wall_clock_timeout_and_abandon_use_real_task_cancellation() -> None:
    backend = Path("app/main.py").read_text()

    assert "_director_tasks" in backend
    assert "asyncio.create_task(" in backend
    assert "done, _pending = await asyncio.wait(" in backend
    assert "cancel_director_task(" in backend
    assert "late model response cannot recreate/commit a ghost session" in backend


def test_intermission_runtime_uses_arcade_registry_without_changing_server_rotation() -> None:
    runtime = read("features/adventure/IntermissionRuntime.tsx")
    registry = read("features/arcade/ArcadeGameRegistry.tsx")

    assert "liveArcadeGameForServerSlot" in runtime
    assert "const ArcadeGame = arcadeGame.component" in runtime
    for server_game_id in (
        "rune_catch",
        "lantern_keep",
        "relic_scramble",
        "sigil_memory",
        "ward_breaker",
        "shadow_step",
    ):
        assert server_game_id in registry


def test_arcade_micro_engine_exposes_lab_and_timing_sport_cabinets() -> None:
    router = read("router.tsx")
    home = read("pages/game/GameHomePage.tsx")
    registry = read("features/arcade/ArcadeGameRegistry.tsx")
    engine = read("features/arcade/engine/useTimingShotEngine.ts")

    assert 'path: "arcade"' in router
    assert 'to="/game/arcade"' in home
    assert 'id: "bowling"' in registry
    assert 'id: "golf"' in registry
    assert 'id: "projectile_duel"' in registry
    assert 'live: false' in registry
    assert '"aim" | "power" | "modifier" | "resolving"' in engine
    assert "requestAnimationFrame" in engine


def test_author_ai_helper_is_field_and_item_scoped_not_whole_document() -> None:
    author_html = Path("app/web/author/index.html").read_text()
    author_js = Path("app/web/author/author.js").read_text()

    assert 'id="author-ai-dialog"' in author_html
    assert 'id="author-assist-panel"' not in author_html
    assert 'className = "author-ai-pill"' in author_js
    assert 'kind: "field"' in author_js
    assert 'kind: "item"' in author_js
    assert 'section: "document"' not in author_js
    assert 'field_path' in author_js


def test_admin_control_room_exposes_live_analytics_and_arcade_navigation() -> None:
    page = read("pages/admin/AdminPage.tsx")
    service = read("services/admin.ts")
    layout = read("layouts/AccountLayout.tsx")

    assert 'getAdminAnalytics' in page
    assert 'LIVE OPERATIONS' in page
    assert 'POPULAR ADVENTURES' in page
    assert 'TOP PLAYERS // BY TURNS' in page
    assert 'RECENT COMPLETIONS' in page
    assert 'to="/game/arcade"' in page
    assert '"/api/auth/admin/analytics"' in service
    assert '<NavLink to="/game/arcade">ARCADE</NavLink>' in layout


def test_arcade_content_pass_retires_archery_and_adds_motion_cabinets() -> None:
    registry = read("features/arcade/ArcadeGameRegistry.tsx")
    bowling = read("features/arcade/games/BowlingGame.tsx")
    golf = read("features/arcade/games/GolfGame.tsx")
    artillery = read("features/adventure/ProjectileDuelGame.tsx")

    assert 'sigil_memory: "road_racer"' in registry
    assert 'id: "road_racer"' in registry
    assert 'id: "brick_breaker"' in registry
    assert 'id: "data_snake"' in registry
    assert 'id: "light_cycles"' in registry
    assert 'title: "ARCHERY RANGE"' in registry
    archery_start = registry.index('id: "archery"')
    archery_end = registry.index('id: "maze"', archery_start)
    assert 'live: false' in registry[archery_start:archery_end]
    assert "requestAnimationFrame" in bowling
    assert "BALL AWAY" in bowling
    assert "requestAnimationFrame" in golf
    assert "BALL IN FLIGHT" in golf
    assert "const startY = GROUND_Y - 2" in artillery
    assert "for (let t = 0.04" in artillery


def test_arcade_game_feel_pass_adds_forgiving_timing_feedback_and_variants() -> None:
    engine = read("features/arcade/engine/useTimingShotEngine.ts")
    meters = read("features/arcade/engine/TimingShotMeters.tsx")
    feedback = read("features/arcade/engine/ArcadeFeedback.tsx")
    golf = read("features/arcade/games/GolfGame.tsx")
    bowling = read("features/arcade/games/BowlingGame.tsx")
    road = read("features/arcade/games/RoadRacerGame.tsx")
    breaker = read("features/arcade/games/BrickBreakerGame.tsx")
    snake = read("features/arcade/games/SnakeGame.tsx")
    cycles = read("features/arcade/games/LightCyclesGame.tsx")
    artillery = read("features/adventure/ProjectileDuelGame.tsx")

    assert "aimPeriodMs = 2600" in engine
    assert "powerPeriodMs = 2200" in engine
    assert "modifierPeriodMs = 2400" in engine
    assert "timing-shot-target" in meters
    assert "useArcadeFeedback" in feedback

    assert "PAR-3 PIN HUNT" in golf
    assert "drawPixelGolfer" in golf
    assert "TARGET POWER" in golf
    assert "recommendedPower" in golf
    assert "FLAG HUNTING!" in golf
    assert "aimPeriodMs: 3100" in golf

    assert "LaneOil" in bowling
    assert "STRIKE!" in bowling
    assert "powerTarget={0.78}" in bowling
    assert "aimPeriodMs: 3250" in bowling
    assert "drawPixelBowler" in bowling
    assert "Behind-the-bowler animated VGA bowling lane" in bowling
    assert "HOOKING LEFT" in bowling
    assert "knockedPins" in bowling

    assert "ROAD_VARIANTS" in road
    assert "PASS STREAK x5" in road
    assert "BreakerVariant" in breaker
    assert "BOARD CLEARED" in breaker
    assert "SnakeVariant" in snake
    assert "TURBO GRID" in snake
    assert "CycleVariant" in cycles
    assert "YOU WIN" in cycles
    assert "TARGET DOWN" in artillery


def test_gameplay_ui_consolidation_prioritizes_story_hero_dice_and_compact_chat() -> None:
    page = read("pages/game/AdventurePage.tsx")
    layout = read("layouts/GameLayout.tsx")
    styles = read("styles/components.css")

    assert "adventure-command-strip" in page
    assert 'title="HERO // LIVE SHEET"' in page
    assert "hero-stat-segments" in page
    assert "hero-last-check" in page
    assert "hero-dice-readout" in page
    assert "PARTY CHAT // ${live.messages.length}" in page
    assert "choice-meta-tags" in page
    assert "choice-commit-copy" in page
    assert "is-adventure-mode" in layout
    assert ".adventure-command-strip" in styles
    assert ".segmented-meter" in styles


def test_qte_recovery_pass_starts_visible_timer_and_keeps_story_context() -> None:
    modal = read("features/adventure/QuickEventModal.tsx")
    styles = read("styles/components.css")
    game = read("services/game.ts")
    home = read("pages/game/GameHomePage.tsx")
    socket_context = read("state/GameSocketContext.tsx")

    assert 'onChoose("__timeout__")' in modal
    assert "when the QTE is actually rendered" in modal
    assert "qte-reaction-track" in modal
    assert "qte-story-context" in modal
    assert 'key === "arrowleft"' in modal
    assert 'key === "arrowright"' in modal
    assert ".qte-reaction-track" in styles
    assert "story_context: string" in game
    assert "request_adventure_catalog" in game
    assert "refreshCatalog();" in home
    assert 'socket.emit("request_adventure_catalog"' in socket_context


def test_playtest_pass_21_adds_mobile_arcade_readability_finale_and_qte_resolution() -> None:
    adventure = read("pages/game/AdventurePage.tsx")
    runtime = read("features/adventure/IntermissionRuntime.tsx")
    live = read("state/useLiveAdventure.ts")
    qte = read("features/adventure/QuickEventModal.tsx")
    snake = read("features/arcade/games/SnakeGame.tsx")
    cycles = read("features/arcade/games/LightCyclesGame.tsx")
    maze = read("features/adventure/MazeGame.tsx")
    styles = read("styles/components.css")

    assert 'storyPaneRef.current?.scrollTo({ top: 0, behavior: "smooth" })' in adventure
    assert "journey-finale-summary" in adventure
    assert "CLOSE JOURNEY // RETURN TO HALL" in adventure
    assert "finalHero.checks_total" in adventure
    assert "finalHero.xp_earned" in adventure

    assert 'compactActionHud = ["action", "racing", "movement"]' in runtime
    assert "is-action-game" in runtime

    assert "dismissMicroEventResolution" in live
    assert "window.setTimeout" not in live[live.index("if (payload.completed)"):live.index("const onTurnResolved")]
    assert "qte-resolution-callout" in qte
    assert "CONTINUE THE STORY" in qte
    assert "localOutcome.result" in qte

    assert "swipeDirection" in snake
    assert "effectiveStepMs" in snake
    assert "swipeDirection" in cycles
    assert "openAreaFrom" in cycles
    assert "aiStepsSinceTurnRef" in cycles
    assert "swipeDirection" in maze

    assert ".intermission-runtime.is-action-game" in styles
    assert ".qte-resolution-callout" in styles
    assert ".finale-hero-grid" in styles
