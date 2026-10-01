"use strict";


(() => {

    const state = {
        configured: false,
        mount: null,
        socket: null,
        getRoomCode: null,

        active: false,
        submitted: false,
        payload: null,
        score: 0,
        startedAt: 0,
        storyReadyGrace: false,

        timerFrameId: null,
        gameFrameId: null,
        graceTimerId: null,
        cleanup: [],
    };


    const GAME_LABELS = {
        rune_catch: "RUNE CATCH",
        lantern_keep: "LANTERN KEEP",
        relic_scramble: "RELIC SCRAMBLE",
        sigil_memory: "SIGIL MEMORY",
        ward_breaker: "WARD BREAKER",
        shadow_step: "SHADOW STEP",
    };


    function cancelFrame(id) {
        if (id !== null) {
            window.cancelAnimationFrame(id);
        }
    }


    function clearTimers() {
        cancelFrame(state.timerFrameId);
        cancelFrame(state.gameFrameId);

        state.timerFrameId = null;
        state.gameFrameId = null;

        if (state.graceTimerId !== null) {
            window.clearTimeout(state.graceTimerId);
            state.graceTimerId = null;
        }

        for (const cleanup of state.cleanup) {
            cleanup();
        }

        state.cleanup = [];
    }


    function submitScore() {
        if (
            state.submitted
            || !state.payload
            || !state.socket
        ) {
            return;
        }

        state.submitted = true;

        state.socket.emit(
            "submit_intermission_score",
            {
                room_code:
                    state.getRoomCode?.()
                    ?? state.payload.room_code,

                turn_number:
                    state.payload.turn_number,

                game_id:
                    state.payload.game_id,

                score:
                    Math.max(
                        0,
                        Math.round(state.score),
                    ),
            },
        );
    }


    function shell(payload) {
        const panel = document.createElement("div");
        panel.className = "intermission-panel";

        const header = document.createElement("div");
        header.className = "intermission-header";

        const titleWrap = document.createElement("div");

        const kicker = document.createElement("div");
        kicker.className = "intermission-kicker";
        kicker.textContent =
            payload.play_mode === "solo"
                ? "DIRECTOR WORKING // SOLO INTERMISSION"
                : "DIRECTOR WORKING // INTERMISSION";

        const title = document.createElement("strong");
        title.className = "intermission-title";
        title.textContent =
            GAME_LABELS[payload.game_id]
            ?? "INTERMISSION";

        titleWrap.append(kicker, title);

        const timer = document.createElement("div");
        timer.className = "intermission-timer";
        timer.textContent = "WRITING // 0.0s";

        header.append(titleWrap, timer);

        const instructions = document.createElement("div");
        instructions.className = "intermission-instructions";

        const playfield = document.createElement("div");
        playfield.className = "intermission-playfield";

        const footer = document.createElement("div");
        footer.className = "intermission-footer";

        const score = document.createElement("strong");
        score.textContent = "SCORE 000";

        const message = document.createElement("span");
        message.textContent =
            payload.play_mode === "solo"
                ? "KEEP PLAYING // THE NEXT STORY BEAT IS BEING WRITTEN_"
                : "KEEP PLAYING // THE NEXT STORY BEAT IS BEING WRITTEN_";

        footer.append(score, message);

        panel.append(
            header,
            instructions,
            playfield,
            footer,
        );

        state.mount.replaceChildren(panel);
        state.mount.hidden = false;

        return {
            panel,
            timer,
            instructions,
            playfield,
            score,
            message,
        };
    }


    function updateScore(refs) {
        refs.score.textContent =
            "SCORE "
            + String(
                Math.max(
                    0,
                    Math.round(state.score),
                ),
            ).padStart(3, "0");
    }


    function startWritingTimer(refs) {
        state.startedAt = performance.now();

        const tick = now => {
            if (!state.active || state.storyReadyGrace) {
                state.timerFrameId = null;
                return;
            }

            const elapsed =
                Math.max(
                    0,
                    (now - state.startedAt) / 1000,
                );

            refs.timer.textContent =
                `WRITING // ${elapsed.toFixed(1)}s`;

            state.timerFrameId =
                window.requestAnimationFrame(tick);
        };

        state.timerFrameId =
            window.requestAnimationFrame(tick);
    }


    function setInstructions(refs, lines) {
        refs.instructions.replaceChildren();

        const objective = document.createElement("strong");
        objective.textContent = lines[0];

        const controls = document.createElement("span");
        controls.textContent = lines[1];

        const duration = document.createElement("span");
        duration.textContent =
            "PLAY UNTIL THE STORY IS READY — THEN YOU'LL GET A 5 SECOND WARNING.";

        refs.instructions.append(
            objective,
            controls,
            duration,
        );
    }


    function runeCatch(refs) {
        setInstructions(
            refs,
            [
                "OBJECTIVE // CATCH * RUNES FOR +2. OTHER GLYPHS ARE +1. AVOID X (-2).",
                "CONTROLS // CLICK OR TAP A GLYPH BEFORE THE GRID REFRESHES.",
            ],
        );

        const symbols = [
            "+",
            "<>",
            "[]",
            "#",
            "X",
        ];

        function spawn() {
            if (!state.active) {
                return;
            }

            const fragment = document.createDocumentFragment();

            for (let index = 0; index < 12; index += 1) {
                const button = document.createElement("button");

                const symbol =
                    Math.random() < 0.30
                        ? "*"
                        : symbols[
                            Math.floor(
                                Math.random() * symbols.length,
                            )
                        ];

                button.type = "button";
                button.className = "ascii-target";
                button.textContent = symbol;

                button.addEventListener(
                    "click",
                    () => {
                        if (!state.active || button.disabled) {
                            return;
                        }

                        if (symbol === "*") {
                            state.score += 2;
                        } else if (symbol === "X") {
                            state.score =
                                Math.max(0, state.score - 2);
                        } else {
                            state.score += 1;
                        }

                        updateScore(refs);
                        button.disabled = true;
                        button.classList.add("hit");
                    },
                    { passive: true },
                );

                fragment.appendChild(button);
            }

            refs.playfield.replaceChildren(fragment);
        }

        spawn();

        const id = window.setInterval(spawn, 800);
        state.cleanup.push(
            () => window.clearInterval(id),
        );
    }


    function lanternKeep(refs) {
        setInstructions(
            refs,
            [
                "OBJECTIVE // STOP THE | MARKER INSIDE THE CENTER [=====] ZONE.",
                "CONTROLS // CLICK/TAP THE TRACK OR PRESS SPACE. CENTER HITS SCORE MORE.",
            ],
        );

        const track = document.createElement("button");
        track.type = "button";
        track.className = "lantern-track";
        track.setAttribute(
            "aria-label",
            "Stop the moving marker inside the center target",
        );

        const marker = document.createElement("span");
        marker.className = "lantern-marker";
        marker.textContent = "|";

        const sweet = document.createElement("span");
        sweet.className = "lantern-sweet";
        sweet.textContent = "[=====]";

        track.append(sweet, marker);
        refs.playfield.appendChild(track);

        let position = 0;
        let direction = 1;
        let lastTime = performance.now();
        let travelPixels = 1;

        const speed = 0.82;

        const measureTrack = () => {
            travelPixels = Math.max(
                1,
                track.clientWidth
                - marker.offsetWidth,
            );
        };

        measureTrack();

        const resizeObserver =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(measureTrack)
                : null;

        resizeObserver?.observe(track);

        function advance(now) {
            if (!state.active) {
                state.gameFrameId = null;
                return;
            }

            const deltaSeconds =
                Math.min(
                    0.05,
                    Math.max(0, (now - lastTime) / 1000),
                );

            lastTime = now;

            position +=
                direction
                * speed
                * deltaSeconds;

            if (position >= 1) {
                position = 1;
                direction = -1;
            } else if (position <= 0) {
                position = 0;
                direction = 1;
            }

            marker.style.transform =
                `translate3d(${(position * travelPixels).toFixed(2)}px, 0, 0)`;

            state.gameFrameId =
                window.requestAnimationFrame(advance);
        }

        function hit() {
            if (!state.active) {
                return;
            }

            const distance =
                Math.abs(position - 0.5);

            if (distance <= 0.08) {
                state.score += 5;
                refs.message.textContent = "PERFECT // +5_";
            } else if (distance <= 0.16) {
                state.score += 3;
                refs.message.textContent = "GOOD // +3_";
            } else {
                state.score += 1;
                refs.message.textContent = "HIT // +1_";
            }

            updateScore(refs);
        }

        track.addEventListener("click", hit);

        const keydown = event => {
            if (event.code === "Space") {
                event.preventDefault();
                hit();
            }
        };

        document.addEventListener("keydown", keydown);

        state.cleanup.push(
            () => track.removeEventListener("click", hit),
            () => document.removeEventListener("keydown", keydown),
            () => resizeObserver?.disconnect(),
        );

        state.gameFrameId =
            window.requestAnimationFrame(advance);
    }


    function relicScramble(refs) {
        setInstructions(
            refs,
            [
                "OBJECTIVE // FIND THE @ RELIC BEFORE IT JUMPS TO A NEW CELL.",
                "CONTROLS // CLICK OR TAP THE @. EACH FIND SCORES +3.",
            ],
        );

        refs.playfield.classList.add("relic-grid");

        const cells = [];

        for (let index = 0; index < 20; index += 1) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "relic-cell";
            cell.textContent = ".";
            refs.playfield.appendChild(cell);
            cells.push(cell);
        }

        function move() {
            if (!state.active) {
                return;
            }

            for (const cell of cells) {
                cell.textContent =
                    Math.random() < 0.15
                        ? "+"
                        : ".";

                cell.classList.remove("target");
                cell.onclick = null;
            }

            const target =
                cells[
                    Math.floor(
                        Math.random() * cells.length,
                    )
                ];

            target.textContent = "@";
            target.classList.add("target");

            target.onclick = () => {
                if (!state.active) {
                    return;
                }

                state.score += 3;
                updateScore(refs);
                refs.message.textContent = "RELIC FOUND // +3_";
                move();
            };
        }

        move();

        const id = window.setInterval(move, 720);
        state.cleanup.push(
            () => window.clearInterval(id),
        );
    }


    function sigilMemory(refs) {
        setInstructions(
            refs,
            [
                "OBJECTIVE // MEMORIZE THE FLASHING SIGILS, THEN REPEAT THE SEQUENCE.",
                "CONTROLS // CLICK/TAP THE FOUR SIGILS IN ORDER. EACH COMPLETE ROUND SCORES MORE.",
            ],
        );

        refs.playfield.classList.add("sigil-memory-field");

        const symbols = ["△", "○", "□", "◇"];
        const buttons = symbols.map((symbol, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "sigil-pad";
            button.textContent = symbol;
            button.dataset.index = String(index);
            button.disabled = true;
            refs.playfield.appendChild(button);
            return button;
        });

        let sequence = [];
        let inputIndex = 0;
        let showing = false;
        let round = 0;
        let sequenceTimeout = null;

        const setPadsDisabled = disabled => {
            for (const button of buttons) {
                button.disabled = disabled;
            }
        };

        const clearFlash = () => {
            for (const button of buttons) {
                button.classList.remove("is-flashing");
            }
        };

        const playSequence = () => {
            if (!state.active) {
                return;
            }

            showing = true;
            inputIndex = 0;
            setPadsDisabled(true);
            refs.message.textContent = `MEMORIZE // ROUND ${round + 1}_`;

            let step = 0;

            const flashNext = () => {
                if (!state.active) {
                    return;
                }

                clearFlash();

                if (step >= sequence.length) {
                    showing = false;
                    setPadsDisabled(false);
                    refs.message.textContent = "REPEAT THE SEQUENCE_";
                    return;
                }

                const button = buttons[sequence[step]];
                button.classList.add("is-flashing");
                step += 1;

                sequenceTimeout = window.setTimeout(() => {
                    clearFlash();
                    sequenceTimeout = window.setTimeout(flashNext, 170);
                }, 330);
            };

            flashNext();
        };

        const nextRound = () => {
            if (!state.active) {
                return;
            }

            sequence.push(
                Math.floor(Math.random() * buttons.length),
            );
            playSequence();
        };

        buttons.forEach((button, index) => {
            button.addEventListener("click", () => {
                if (!state.active || showing || button.disabled) {
                    return;
                }

                button.classList.add("is-hit");
                window.setTimeout(() => button.classList.remove("is-hit"), 120);

                if (sequence[inputIndex] !== index) {
                    state.score = Math.max(0, state.score - 1);
                    updateScore(refs);
                    refs.message.textContent = "SEQUENCE BROKEN // -1 // TRY AGAIN_";
                    playSequence();
                    return;
                }

                inputIndex += 1;

                if (inputIndex >= sequence.length) {
                    round += 1;
                    const award = Math.min(8, 2 + round);
                    state.score += award;
                    updateScore(refs);
                    refs.message.textContent = `ROUND CLEAR // +${award}_`;
                    setPadsDisabled(true);
                    sequenceTimeout = window.setTimeout(nextRound, 420);
                }
            });
        });

        sequence.push(Math.floor(Math.random() * buttons.length));
        playSequence();

        state.cleanup.push(() => {
            if (sequenceTimeout !== null) {
                window.clearTimeout(sequenceTimeout);
            }
        });
    }


    function wardBreaker(refs) {
        setInstructions(
            refs,
            [
                "OBJECTIVE // BREAK THE LIT WARDS BEFORE THEIR CHARGE BAR EXPIRES.",
                "CONTROLS // CLICK/TAP ONLY THE BRIGHT WARDS. FALSE HITS COST 1 POINT.",
            ],
        );

        refs.playfield.classList.add("ward-grid");

        const cells = [];

        for (let index = 0; index < 16; index += 1) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "ward-cell";
            cell.textContent = "+";
            refs.playfield.appendChild(cell);
            cells.push(cell);
        }

        let activeIndex = -1;
        let charge = 1;
        let lastTime = performance.now();
        let speed = 0.62;

        const activate = () => {
            activeIndex = Math.floor(Math.random() * cells.length);
            charge = 1;

            cells.forEach((cell, index) => {
                cell.classList.toggle("is-live", index === activeIndex);
                cell.textContent = index === activeIndex ? "#" : "+";
                cell.setAttribute("aria-label", index === activeIndex ? "Live ward" : "Dormant ward");
            });
        };

        cells.forEach((cell, index) => {
            cell.addEventListener("click", () => {
                if (!state.active) {
                    return;
                }

                if (index === activeIndex) {
                    const award = charge > 0.65 ? 4 : charge > 0.3 ? 2 : 1;
                    state.score += award;
                    speed = Math.min(1.25, speed + 0.025);
                    updateScore(refs);
                    refs.message.textContent = `WARD BROKEN // +${award}_`;
                    activate();
                } else {
                    state.score = Math.max(0, state.score - 1);
                    updateScore(refs);
                    refs.message.textContent = "FALSE WARD // -1_";
                }
            });
        });

        const advance = now => {
            if (!state.active) {
                state.gameFrameId = null;
                return;
            }

            const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
            lastTime = now;
            charge -= delta * speed;

            refs.playfield.style.setProperty(
                "--ward-charge",
                `${Math.max(0, charge) * 100}%`,
            );

            if (charge <= 0) {
                refs.message.textContent = "WARD DISCHARGED // TOO SLOW_";
                activate();
            }

            state.gameFrameId = window.requestAnimationFrame(advance);
        };

        activate();
        state.gameFrameId = window.requestAnimationFrame(advance);
    }


    function shadowStep(refs) {
        setInstructions(
            refs,
            [
                "OBJECTIVE // MOVE INTO THE SAFE LANE BEFORE THE SHADOW STRIKES.",
                "CONTROLS // CLICK/TAP A LANE OR USE LEFT/RIGHT ARROWS. SURVIVING A STRIKE SCORES +3.",
            ],
        );

        refs.playfield.classList.add("shadow-step-field");

        const lanes = [];
        let playerLane = 1;
        let dangerLane = 0;
        let locked = false;
        let strikeTimer = null;

        for (let index = 0; index < 3; index += 1) {
            const lane = document.createElement("button");
            lane.type = "button";
            lane.className = "shadow-lane";
            lane.dataset.index = String(index);

            const marker = document.createElement("span");
            marker.className = "shadow-player";
            marker.textContent = "@";

            const warning = document.createElement("span");
            warning.className = "shadow-warning";
            warning.textContent = "!";

            lane.append(marker, warning);
            refs.playfield.appendChild(lane);
            lanes.push(lane);
        }

        const render = () => {
            lanes.forEach((lane, index) => {
                lane.classList.toggle("has-player", index === playerLane);
                lane.classList.toggle("is-danger", index === dangerLane);
            });
        };

        const movePlayer = nextLane => {
            if (!state.active || locked) {
                return;
            }

            playerLane = Math.max(0, Math.min(2, nextLane));
            render();
        };

        const scheduleStrike = () => {
            if (!state.active) {
                return;
            }

            locked = false;
            dangerLane = Math.floor(Math.random() * lanes.length);
            refs.message.textContent = "SHADOW CHARGING // MOVE_";
            render();

            strikeTimer = window.setTimeout(() => {
                if (!state.active) {
                    return;
                }

                locked = true;
                lanes[dangerLane].classList.add("is-striking");

                if (playerLane === dangerLane) {
                    state.score = Math.max(0, state.score - 2);
                    refs.message.textContent = "SHADOW HIT // -2_";
                } else {
                    state.score += 3;
                    refs.message.textContent = "CLEAN STEP // +3_";
                }

                updateScore(refs);

                strikeTimer = window.setTimeout(() => {
                    lanes.forEach(lane => lane.classList.remove("is-striking"));
                    scheduleStrike();
                }, 260);
            }, 900);
        };

        lanes.forEach((lane, index) => {
            lane.addEventListener("click", () => movePlayer(index));
        });

        const keydown = event => {
            if (event.code === "ArrowLeft") {
                event.preventDefault();
                movePlayer(playerLane - 1);
            } else if (event.code === "ArrowRight") {
                event.preventDefault();
                movePlayer(playerLane + 1);
            }
        };

        document.addEventListener("keydown", keydown);
        render();
        scheduleStrike();

        state.cleanup.push(
            () => document.removeEventListener("keydown", keydown),
            () => {
                if (strikeTimer !== null) {
                    window.clearTimeout(strikeTimer);
                }
            },
        );
    }


    function finish(reason = "story_ready") {
        if (!state.active) {
            return;
        }

        state.active = false;
        state.storyReadyGrace = false;

        clearTimers();
        submitScore();

        const panel =
            state.mount?.querySelector(
                ".intermission-panel",
            );

        if (panel) {
            panel.classList.add("is-finished");

            const message =
                panel.querySelector(
                    ".intermission-footer span",
                );

            if (message) {
                message.textContent =
                    reason === "error"
                        ? "STORY ERROR // SCORE SAVED_"
                        : "STORY READY // SCORE LOCKED_";
            }
        }
    }


    function start(payload) {
        if (!state.configured || !payload) {
            return;
        }

        clearTimers();

        state.active = true;
        state.submitted = false;
        state.storyReadyGrace = false;
        state.payload = payload;
        state.score = 0;

        const refs = shell(payload);

        if (payload.game_id === "lantern_keep") {
            lanternKeep(refs);
        } else if (payload.game_id === "relic_scramble") {
            relicScramble(refs);
        } else if (payload.game_id === "sigil_memory") {
            sigilMemory(refs);
        } else if (payload.game_id === "ward_breaker") {
            wardBreaker(refs);
        } else if (payload.game_id === "shadow_step") {
            shadowStep(refs);
        } else {
            runeCatch(refs);
        }

        /*
           Deliberately no gameplay duration here.
           The intermission lasts exactly as long as the Director/API call.
           stop("story_ready", 5) owns the only normal end condition.
        */
        startWritingTimer(refs);
    }


    function stop(
        reason = "story_ready",
        graceSeconds = 0,
    ) {
        if (!state.active) {
            return;
        }

        if (
            reason === "story_ready"
            && graceSeconds > 0
            && state.mount
        ) {
            state.storyReadyGrace = true;

            cancelFrame(state.timerFrameId);
            state.timerFrameId = null;

            const panel =
                state.mount.querySelector(
                    ".intermission-panel",
                );

            const timer =
                panel?.querySelector(
                    ".intermission-timer",
                );

            const message =
                panel?.querySelector(
                    ".intermission-footer span",
                );

            if (message) {
                message.textContent =
                    "STORY READY // FINAL 5 SECONDS — KEEP PLAYING_";
            }

            const started = performance.now();

            const updateGrace = now => {
                if (!state.active) {
                    state.timerFrameId = null;
                    return;
                }

                const elapsed =
                    (now - started) / 1000;

                const remaining =
                    Math.max(
                        0,
                        graceSeconds - elapsed,
                    );

                if (timer) {
                    timer.textContent =
                        `STORY READY // ${remaining.toFixed(1)}s`;
                }

                if (remaining <= 0) {
                    state.timerFrameId = null;
                    finish("story_ready");
                    return;
                }

                state.timerFrameId =
                    window.requestAnimationFrame(
                        updateGrace,
                    );
            };

            state.timerFrameId =
                window.requestAnimationFrame(
                    updateGrace,
                );

            return;
        }

        finish(reason);
    }


    function showResult(result) {
        if (!state.mount || !result) {
            return;
        }

        const flash = document.createElement("div");
        flash.className = "intermission-result-flash";

        if (result.solo) {
            const score =
                result.scores?.[0]?.score
                ?? 0;

            flash.textContent =
                `SOLO RUN COMPLETE // SCORE ${String(score).padStart(3, "0")}_`;
        } else if (result.tie) {
            flash.textContent =
                "INTERMISSION TIE // NICE WORK_";
        } else {
            flash.textContent =
                `${String(
                    result.winner_name
                    ?? "PLAYER",
                ).toUpperCase()} WINS THE INTERMISSION_`;
        }

        state.mount.hidden = false;
        state.mount.appendChild(flash);

        window.setTimeout(
            () => {
                flash.remove();

                if (!state.active) {
                    state.mount.hidden = true;
                }
            },
            2600,
        );
    }


    function configure({
        mount,
        socket,
        getRoomCode,
    }) {
        state.mount = mount;
        state.socket = socket;
        state.getRoomCode = getRoomCode;

        state.configured =
            Boolean(mount && socket);

        api.configured =
            state.configured;
    }


    const api = {
        configured: false,
        configure,
        start,
        stop,
        showResult,
    };


    window.TalesIntermission = api;

})();
