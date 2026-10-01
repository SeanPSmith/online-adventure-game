"use strict";

(() => {

    const GLITCH_SYMBOLS =
        "!@#$%^&*▓▒░▌▐□■◇◆";

    const state = {
        lastSceneId:
            null,

        unread:
            0,

        baseTitle:
            document.title,

        knownMessages:
            [],

        cursor:
            null,

        cursorReleaseTimer:
            null,
    };


    function byId(
        id,
    ) {

        return document.getElementById(
            id
        );
    }


    function safeSocket() {

        try {

            return (
                typeof socket !== "undefined"
                    ? socket
                    : null
            );

        } catch {

            return null;
        }
    }


    function safeSelectedCharacter() {

        try {

            return (
                typeof selectedCharacter !== "undefined"
                    ? selectedCharacter
                    : null
            );

        } catch {

            return null;
        }
    }


    /* =====================================================
       FULL PAGE / WINDOW LIFE
    ===================================================== */

    function setupPageReveal() {

        document.documentElement.classList.add(
            "tot-enhanced"
        );


        window.requestAnimationFrame(
            () => {

                document.documentElement.classList.add(
                    "tot-page-ready"
                );
            }
        );


        const candidates =
            document.querySelectorAll(
                [
                    ".terminal-panel",
                    ".adventure-workspace",
                    ".my-adventures-section",
                    ".turn-flow-panel",
                ].join(
                    ","
                )
            );


        for (
            const element
            of candidates
        ) {

            if (
                !element.hidden
            ) {

                animateWindowOpen(
                    element
                );
            }
        }


        if (
            "MutationObserver"
            in window
        ) {

            const observer =
                new MutationObserver(
                    mutations => {

                        for (
                            const mutation
                            of mutations
                        ) {

                            if (
                                mutation.type
                                !== "attributes"
                                || mutation.attributeName
                                !== "hidden"
                            ) {

                                continue;
                            }


                            const target =
                                mutation.target;


                            if (
                                !target.hidden
                            ) {

                                animateWindowOpen(
                                    target
                                );
                            }
                        }
                    }
                );


            for (
                const element
                of document.querySelectorAll(
                    ".terminal-panel, .my-adventures-section"
                )
            ) {

                observer.observe(
                    element,
                    {
                        attributes:
                            true,
                    }
                );
            }
        }
    }


    function animateWindowOpen(
        element,
    ) {

        if (
            !element
        ) {

            return;
        }


        element.classList.remove(
            "tot-window-open"
        );


        void element.offsetWidth;


        element.classList.add(
            "tot-window-open"
        );


        const heading =
            element.querySelector(
                ".panel-heading, .scene-title, .section-title"
            );


        if (
            heading
        ) {

            glitchText(
                heading,
                280
            );
        }
    }


    /* =====================================================
       GLITCH TEXT — SHORT, READABLE, NON-DESTRUCTIVE
    ===================================================== */

    function randomGlitchChar() {

        return GLITCH_SYMBOLS[
            Math.floor(
                Math.random()
                * GLITCH_SYMBOLS.length
            )
        ];
    }


    function glitchText(
        element,
        duration =
            260,
    ) {

        if (
            !element
            || element.dataset.glitching
                === "1"
        ) {

            return;
        }


        const original =
            element.textContent;


        if (
            !original
            || original.trim().length
                < 2
        ) {

            return;
        }


        element.dataset.glitching =
            "1";


        const started =
            performance.now();


        function frame(
            now,
        ) {

            const progress =
                Math.min(
                    1,
                    (
                        now
                        - started
                    )
                    / duration
                );


            if (
                progress >= 1
            ) {

                element.textContent =
                    original;

                delete element.dataset.glitching;

                return;
            }


            const intensity =
                (
                    1
                    - progress
                )
                * 0.34;


            element.textContent =
                Array.from(
                    original
                )
                .map(
                    character => {

                        if (
                            /\s/.test(
                                character
                            )
                            || Math.random()
                                > intensity
                        ) {

                            return character;
                        }


                        return randomGlitchChar();
                    }
                )
                .join(
                    ""
                );


            window.requestAnimationFrame(
                frame
            );
        }


        window.requestAnimationFrame(
            frame
        );
    }


    function setupGlitchHover() {

        document.addEventListener(
            "pointerenter",
            event => {

                const target =
                    event.target.closest?.(
                        ".terminal-button, .panel-heading"
                    );


                /*
                   Choice labels stay stable on hover. These are decision
                   surfaces, not decorative UI, so readability wins here.
                */

                if (
                    target?.classList?.contains(
                        "choice-button"
                    )
                    || target?.closest?.(
                        ".choice-button"
                    )
                ) {

                    return;
                }


                if (
                    !target
                ) {

                    return;
                }


                glitchText(
                    target,
                    180
                );
            },
            true
        );
    }


    /* =====================================================
       STORY REVEAL + CANDLE
    ===================================================== */

    function revealCurrentStory(
        gameState,
    ) {

        const sceneId =
            gameState?.scene?.id;


        if (
            !sceneId
            || sceneId
                === state.lastSceneId
        ) {

            updateCandle(
                gameState
            );

            return;
        }


        state.lastSceneId =
            sceneId;


        const targets = [
            byId(
                "resolution-panel"
            ),
            byId(
                "scene-title"
            ),
            byId(
                "scene-art"
            ),
            byId(
                "scene-body"
            ),
            byId(
                "choice-list"
            ),
        ];


        targets.forEach(
            (
                element,
                index,
            ) => {

                if (
                    !element
                ) {

                    return;
                }


                element.classList.remove(
                    "tot-story-reveal"
                );


                void element.offsetWidth;


                element.style.setProperty(
                    "--reveal-delay",
                    `${index * 95}ms`
                );


                element.classList.add(
                    "tot-story-reveal"
                );
            }
        );


        glitchText(
            byId(
                "scene-title"
            ),
            340
        );


        updateCandle(
            gameState
        );
    }


    function ensureCandle() {

        let candle =
            byId(
                "tot-turn-candle"
            );


        if (
            candle
        ) {

            return candle;
        }


        const flow =
            document.querySelector(
                ".turn-flow-panel"
            );


        if (
            !flow
        ) {

            return null;
        }


        candle =
            document.createElement(
                "aside"
            );


        candle.id =
            "tot-turn-candle";

        candle.className =
            "tot-turn-candle";


        flow.appendChild(
            candle
        );


        return candle;
    }


    function candleArt(
        turn,
        maxTurns,
    ) {

        const safeMax =
            Math.max(
                1,
                Number(
                    maxTurns
                    || 10
                )
            );


        const safeTurn =
            Math.max(
                1,
                Math.min(
                    safeMax,
                    Number(
                        turn
                        || 1
                    )
                )
            );


        const remaining =
            Math.max(
                1,
                safeMax
                - safeTurn
                + 1
            );


        const fullHeight =
            8;


        const bodyHeight =
            Math.max(
                1,
                Math.ceil(
                    (
                        remaining
                        / safeMax
                    )
                    * fullHeight
                )
            );


        const wax =
            Array.from(
                {
                    length:
                        bodyHeight,
                },
                (
                    _,
                    index,
                ) => {

                    if (
                        index === 0
                    ) {

                        return "   | |";
                    }


                    if (
                        index
                        % 3
                        === 1
                    ) {

                        return "  |  |";
                    }


                    return "  |##|";
                }
            );


        return [
            "    (",
            "     )",
            "    (",
            "     )",
            "    /\\",
            "   /  \\",
            ...wax,
            "  |____|",
        ]
        .join(
            "\n"
        );
    }


    function updateCandle(
        gameState,
    ) {

        const candle =
            ensureCandle();


        if (
            !candle
        ) {

            return;
        }


        if (
            !gameState?.ai_directed
        ) {

            candle.hidden =
                true;

            return;
        }


        candle.hidden =
            false;


        candle.innerHTML =
            "";


        const pre =
            document.createElement(
                "pre"
            );


        pre.textContent =
            candleArt(
                gameState.turn_number,
                gameState.max_turns
            );


        const label =
            document.createElement(
                "div"
            );


        label.className =
            "tot-candle-label";


        label.textContent =
            (
                `TURN ${gameState.turn_number}`
                + ` / ${gameState.max_turns ?? "?"}`
            );


        candle.append(
            pre,
            label,
        );
    }


    /* =====================================================
       GLOBAL GREEN ARROW CURSOR
    ===================================================== */

    function setupCursor() {

        if (
            window.matchMedia(
                "(pointer: coarse)"
            ).matches
        ) {

            return;
        }


        const cursor =
            document.createElement(
                "div"
            );


        cursor.className =
            "tot-green-cursor";


        cursor.innerHTML =
            `
            <svg
                viewBox="0 0 28 34"
                aria-hidden="true"
            >
                <path
                    d="M3 2 L3 27 L9 21 L14 32 L18 30 L13 19 L24 19 Z"
                ></path>
            </svg>
            `;


        document.body.appendChild(
            cursor
        );


        state.cursor =
            cursor;


        document.addEventListener(
            "pointermove",
            event => {

                cursor.style.transform =
                    (
                        `translate3d(${event.clientX}px, `
                        + `${event.clientY}px, 0) `
                        + "translate(-3px, -2px)"
                    );


                cursor.classList.add(
                    "is-visible"
                );
            }
        );


        document.addEventListener(
            "pointerdown",
            () => {

                window.clearTimeout(
                    state.cursorReleaseTimer
                );


                cursor.classList.remove(
                    "is-release"
                );


                cursor.classList.add(
                    "is-pressed"
                );
            }
        );


        document.addEventListener(
            "pointerup",
            () => {

                cursor.classList.remove(
                    "is-pressed"
                );


                cursor.classList.add(
                    "is-release"
                );


                state.cursorReleaseTimer =
                    window.setTimeout(
                        () => {

                            cursor.classList.remove(
                                "is-release"
                            );
                        },
                        150
                    );
            }
        );


        document.addEventListener(
            "pointercancel",
            () => {

                cursor.classList.remove(
                    "is-pressed",
                    "is-release",
                );
            }
        );


        document.documentElement.addEventListener(
            "mouseleave",
            () => {

                cursor.classList.remove(
                    "is-visible"
                );
            }
        );
    }


    /* =====================================================
       STYLIZED SCROLL POSITION
    ===================================================== */

    function setupScrollRail() {

        const rail =
            document.createElement(
                "div"
            );


        rail.className =
            "tot-scroll-rail";


        const thumb =
            document.createElement(
                "div"
            );


        thumb.className =
            "tot-scroll-rail-thumb";


        thumb.textContent =
            ">";


        rail.appendChild(
            thumb
        );


        document.body.appendChild(
            rail
        );


        let ticking =
            false;


        function update() {

            ticking =
                false;


            const root =
                document.documentElement;


            const maxScroll =
                Math.max(
                    1,
                    root.scrollHeight
                    - window.innerHeight
                );


            const progress =
                Math.min(
                    1,
                    Math.max(
                        0,
                        window.scrollY
                        / maxScroll
                    )
                );


            thumb.style.top =
                `calc(${progress * 100}% - 9px)`;
        }


        function requestUpdate() {

            if (
                ticking
            ) {

                return;
            }


            ticking =
                true;


            window.requestAnimationFrame(
                update
            );
        }


        window.addEventListener(
            "scroll",
            requestUpdate,
            {
                passive:
                    true,
            }
        );


        window.addEventListener(
            "resize",
            requestUpdate
        );


        update();
    }


    /* =====================================================
       CHAT TIMESTAMPS / UNREAD
    ===================================================== */

    function chatPanel() {

        return byId(
            "chat-panel"
        );
    }


    function chatLog() {

        return byId(
            "chat-log"
        );
    }


    function chatInput() {

        return byId(
            "chat-input"
        );
    }


    function chatIsVisible() {

        const panel =
            chatPanel();


        if (
            !panel
            || panel.hidden
        ) {

            return false;
        }


        const rect =
            panel.getBoundingClientRect();


        return (
            rect.bottom > 0
            && rect.top < window.innerHeight
            && document.visibilityState
                === "visible"
        );
    }


    function formatTimestamp(
        value,
    ) {

        if (
            !value
        ) {

            return "";
        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }


        return date.toLocaleTimeString(
            [],
            {
                hour:
                    "numeric",

                minute:
                    "2-digit",
            }
        );
    }


    function ensureChatBadge() {

        const panel =
            chatPanel();


        if (
            !panel
        ) {

            return null;
        }


        let badge =
            panel.querySelector(
                ".tot-chat-badge"
            );


        if (
            badge
        ) {

            return badge;
        }


        const heading =
            panel.querySelector(
                ".panel-heading"
            )
            ?? panel.firstElementChild;


        if (
            !heading
        ) {

            return null;
        }


        badge =
            document.createElement(
                "span"
            );


        badge.className =
            "tot-chat-badge";

        badge.hidden =
            true;


        heading.appendChild(
            badge
        );


        return badge;
    }


    function updateUnreadUi() {

        const badge =
            ensureChatBadge();


        if (
            badge
        ) {

            badge.hidden =
                state.unread <= 0;


            badge.textContent =
                (
                    state.unread > 99
                        ? "99+"
                        : String(
                            state.unread
                        )
                );
        }


        document.title =
            (
                state.unread > 0
                    ? `[${state.unread}] ${state.baseTitle}`
                    : state.baseTitle
            );


        chatPanel()?.classList.toggle(
            "has-unread",
            state.unread > 0
        );
    }


    function clearUnread() {

        if (
            state.unread === 0
        ) {

            return;
        }


        state.unread =
            0;


        updateUnreadUi();
    }


    function isSelfMessage(
        message,
    ) {

        const selected =
            safeSelectedCharacter();


        if (
            !selected
        ) {

            return false;
        }


        if (
            message.character_id
            && selected.character_id
            && message.character_id
                === selected.character_id
        ) {

            return true;
        }


        return (
            String(
                message.player_name
                ?? ""
            )
            === String(
                selected.name
                ?? ""
            )
        );
    }


    function annotateChatRows() {

        const log =
            chatLog();


        if (
            !log
        ) {

            return;
        }


        const rows =
            Array.from(
                log.querySelectorAll(
                    ".chat-message"
                )
            );


        const offset =
            Math.max(
                0,
                state.knownMessages.length
                - rows.length
            );


        rows.forEach(
            (
                row,
                index,
            ) => {

                if (
                    row.querySelector(
                        ".tot-chat-time"
                    )
                ) {

                    return;
                }


                const message =
                    state.knownMessages[
                        index + offset
                    ];


                const timestamp =
                    formatTimestamp(
                        message?.timestamp
                    );


                if (
                    !timestamp
                ) {

                    return;
                }


                const time =
                    document.createElement(
                        "span"
                    );


                time.className =
                    "tot-chat-time";


                time.textContent =
                    timestamp;


                row.appendChild(
                    time
                );
            }
        );
    }


    function setupChatEnhancements() {

        const socketRef =
            safeSocket();


        if (
            !socketRef
        ) {

            return;
        }


        const log =
            chatLog();


        if (
            log
            && "MutationObserver"
            in window
        ) {

            const observer =
                new MutationObserver(
                    annotateChatRows
                );


            observer.observe(
                log,
                {
                    childList:
                        true,

                    subtree:
                        true,
                }
            );
        }


        socketRef.on(
            "chat_history",
            data => {

                state.knownMessages =
                    Array.isArray(
                        data?.messages
                    )
                        ? [
                            ...data.messages
                        ]
                        : [];


                window.setTimeout(
                    annotateChatRows,
                    0
                );
            }
        );


        socketRef.on(
            "chat_message",
            message => {

                state.knownMessages.push(
                    message
                );


                window.setTimeout(
                    annotateChatRows,
                    0
                );


                if (
                    isSelfMessage(
                        message
                    )
                    || chatIsVisible()
                ) {

                    return;
                }


                state.unread +=
                    1;


                updateUnreadUi();
            }
        );


        socketRef.on(
            "game_state",
            gameState => {

                revealCurrentStory(
                    gameState
                );
            }
        );


        socketRef.on(
            "story_advancing",
            () => {

                document.body.classList.add(
                    "tot-story-advancing"
                );
            }
        );


        socketRef.on(
            "turn_resolved",
            () => {

                document.body.classList.remove(
                    "tot-story-advancing"
                );
            }
        );


        socketRef.on(
            "game_error",
            () => {

                document.body.classList.remove(
                    "tot-story-advancing"
                );
            }
        );


        chatPanel()?.addEventListener(
            "pointerdown",
            clearUnread
        );


        chatInput()?.addEventListener(
            "focus",
            clearUnread
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    chatIsVisible()
                ) {

                    clearUnread();
                }
            }
        );


        window.addEventListener(
            "scroll",
            () => {

                if (
                    chatIsVisible()
                ) {

                    clearUnread();
                }
            },
            {
                passive:
                    true,
            }
        );


        updateUnreadUi();
    }


    /* =====================================================
       ASCII QUICK REACTIONS
    ===================================================== */

    const ASCII_REACTIONS = [
        ":)",
        ":D",
        ";)",
        "<3",
        ":P",
        "^_^",
        "o7",
        "ಠ_ಠ",
        "¯\\_(ツ)_/¯",
        "(ง'̀-'́)ง",
        "?!",
        "..."
    ];


    function insertAtCursor(
        input,
        text,
    ) {

        const start =
            input.selectionStart
            ?? input.value.length;


        const end =
            input.selectionEnd
            ?? start;


        const before =
            input.value.slice(
                0,
                start
            );


        const after =
            input.value.slice(
                end
            );


        const spacer =
            (
                before
                && !/\s$/.test(
                    before
                )
            )
                ? " "
                : "";


        input.value =
            (
                before
                + spacer
                + text
                + " "
                + after
            ).slice(
                0,
                Number(
                    input.maxLength
                    || 500
                )
            );


        const caret =
            Math.min(
                input.value.length,
                start
                + spacer.length
                + text.length
                + 1
            );


        input.focus();


        input.setSelectionRange(
            caret,
            caret
        );


        input.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles:
                        true,
                }
            )
        );
    }


    function setupAsciiReactions() {

        const input =
            chatInput();


        if (
            !input
            || byId(
                "ascii-reaction-tray"
            )
        ) {

            return;
        }


        const tray =
            document.createElement(
                "div"
            );


        tray.id =
            "ascii-reaction-tray";

        tray.className =
            "ascii-reaction-tray";


        const label =
            document.createElement(
                "span"
            );


        label.className =
            "ascii-reaction-label";

        label.textContent =
            "QUICK ASCII";


        tray.appendChild(
            label
        );


        for (
            const reaction
            of ASCII_REACTIONS
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";

            button.className =
                "ascii-reaction-button";

            button.textContent =
                reaction;


            button.addEventListener(
                "click",
                () => {

                    insertAtCursor(
                        input,
                        reaction
                    );
                }
            );


            tray.appendChild(
                button
            );
        }


        const row =
            input.closest(
                ".chat-input-row"
            );


        if (
            row
            && row.parentNode
        ) {

            row.parentNode.insertBefore(
                tray,
                row
            );
        }
    }


    /* =====================================================
       BOOT
    ===================================================== */

    function boot() {

        setupPageReveal();

        setupGlitchHover();

        setupCursor();

        setupScrollRail();

        setupChatEnhancements();

        setupAsciiReactions();
    }


    if (
        document.readyState
        === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once:
                    true,
            }
        );

    } else {

        boot();
    }

})();
