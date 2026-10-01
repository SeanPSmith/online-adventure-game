"use strict";


/* =========================================================
   STYLE LOADER
========================================================= */

const adventureUiStylesheet =
    document.createElement(
        "link"
    );


adventureUiStylesheet.rel =
    "stylesheet";


adventureUiStylesheet.href =
    "/static/adventure_ui.css?v=063";


document.head.appendChild(
    adventureUiStylesheet
);


const intermissionStylesheet =
    document.createElement(
        "link"
    );

intermissionStylesheet.rel =
    "stylesheet";

intermissionStylesheet.href =
    "/static/intermission_games.css?v=005";

document.head.appendChild(
    intermissionStylesheet
);


const experienceStylesheet =
    document.createElement(
        "link"
    );

experienceStylesheet.rel =
    "stylesheet";

experienceStylesheet.href =
    "/static/experience_polish.css?v=003";

document.head.appendChild(
    experienceStylesheet
);


const intermissionScript =
    document.createElement(
        "script"
    );

intermissionScript.src =
    "/static/intermission_games.js?v=005";

intermissionScript.defer =
    true;

document.head.appendChild(
    intermissionScript
);


const experienceScript =
    document.createElement(
        "script"
    );

experienceScript.src =
    "/static/experience_polish.js?v=003";

experienceScript.defer =
    true;

document.head.appendChild(
    experienceScript
);


const heroHubStylesheet =
    document.createElement(
        "link"
    );

heroHubStylesheet.rel =
    "stylesheet";

heroHubStylesheet.href =
    "/static/hero_hub.css?v=006";

document.head.appendChild(
    heroHubStylesheet
);


const heroHubScript =
    document.createElement(
        "script"
    );

heroHubScript.src =
    "/static/hero_hub.js?v=007";

heroHubScript.defer =
    true;

document.head.appendChild(
    heroHubScript
);


/* =========================================================
   OLD STORAGE CLEANUP
========================================================= */

localStorage.removeItem(
    "tot.adventureSummary"
);

localStorage.removeItem(
    "tot.exitedToLobby"
);


/* =========================================================
   DOM
========================================================= */

const adventureStatusPanel =
    document.getElementById(
        "status"
    )
    ?.closest(
        ".status-panel"
    );


const adventureAccountPanel =
    document.getElementById(
        "account-panel"
    );


const adventureRoomPanel =
    document.getElementById(
        "room-panel"
    );


const adventureGamePanel =
    document.getElementById(
        "game-panel"
    );


const adventureChatPanel =
    document.getElementById(
        "chat-panel"
    );


const adventureCharacterPanel =
    document.getElementById(
        "character-panel"
    );


const adventureLobbyPanel =
    document.getElementById(
        "lobby-panel"
    );


const adventureBuilderPanel =
    document.getElementById(
        "character-builder-panel"
    );


/* =========================================================
   STATE
========================================================= */

let adventures =
    [];


let adventureCatalog =
    [];


let selectedAdventureId =
    "old_chapel";


let activeAdventure =
    null;


let adventurePlayerIsHost =
    false;


let locallySelectedChoiceId =
    null;


let locallyChoiceLocked =
    false;


let lockCountdownTimer =
    null;


let turnTransitionRecoveryTimer =
    null;


let activeLockCountdownTurn =
    null;


let activeIntermissionTurn =
    null;


let lastGameSceneId =
    null;


let lastGameTurnNumber =
    null;


let storyAdvancing =
    false;


let storyReadyGraceTimer =
    null;


let directorRetryPromptOpen =
    false;


let latestTurnFlowState =
    null;

let latestChoiceState =
    null;


let reconnectRoomCode =
    null;


let reconnectAttemptTimer =
    null;


let reconnectAttemptCount =
    0;


let pendingAdventureEntryMode =
    null;


let pendingAdventureEntryAdventure =
    null;


let adventureEntryShownForRoom =
    null;


let pendingIntermissionPayload =
    null;

// Story generation begins immediately when the final required Hero locks.
// If the server announces the live Director request during the dramatic
// three-second lock countdown, hold the intermission payload until that
// countdown finishes instead of replacing the countdown early.
let queuedIntermissionPayload =
    null;

// If the Director returns unusually quickly, finish the opening lock
// countdown before beginning the closing STORY READY countdown.
let queuedStoryReadySeconds =
    0;

let latestIntermissionStats =
    [];

let latestIntermissionResult =
    null;


/* =========================================================
   MODAL
========================================================= */

const modalBackdrop =
    document.createElement(
        "div"
    );


modalBackdrop.className =
    "game-modal-backdrop";


modalBackdrop.hidden =
    true;


const modalWindow =
    document.createElement(
        "section"
    );


modalWindow.className =
    "game-modal";


modalWindow.setAttribute(
    "role",
    "dialog"
);


modalWindow.setAttribute(
    "aria-modal",
    "true"
);


const modalHeader =
    document.createElement(
        "div"
    );


modalHeader.className =
    "game-modal-header";


const modalKicker =
    document.createElement(
        "div"
    );


modalKicker.className =
    "game-modal-kicker";


modalKicker.textContent =
    "SYSTEM MESSAGE";


const modalTitle =
    document.createElement(
        "div"
    );


modalTitle.className =
    "game-modal-title";


modalHeader.append(
    modalKicker,
    modalTitle,
);


const modalBody =
    document.createElement(
        "div"
    );


modalBody.className =
    "game-modal-body";


const modalActions =
    document.createElement(
        "div"
    );


modalActions.className =
    "game-modal-actions";


const modalCancelButton =
    document.createElement(
        "button"
    );


modalCancelButton.type =
    "button";


modalCancelButton.className =
    "terminal-button game-modal-cancel";


const modalConfirmButton =
    document.createElement(
        "button"
    );


modalConfirmButton.type =
    "button";


modalConfirmButton.className =
    "terminal-button primary game-modal-confirm";


modalActions.append(
    modalCancelButton,
    modalConfirmButton,
);


modalWindow.append(
    modalHeader,
    modalBody,
    modalActions,
);


modalBackdrop.appendChild(
    modalWindow
);


document.body.appendChild(
    modalBackdrop
);


let activeModalResolver =
    null;


function closeGameModal(
    result,
) {

    if (
        !activeModalResolver
    ) {

        return;
    }


    const resolver =
        activeModalResolver;


    activeModalResolver =
        null;


    modalBackdrop.hidden =
        true;


    modalWindow.classList.remove(
        "choice-inspector-modal"
    );


    document.body.classList.remove(
        "modal-open"
    );


    resolver(
        result
    );
}


function showGameModal({

    title =
        "CONFIRM",

    message =
        "",

    confirmLabel =
        "CONFIRM",

    cancelLabel =
        "CANCEL",

    danger =
        false,

    hideCancel =
        false,

} = {}) {

    if (
        activeModalResolver
    ) {

        closeGameModal(
            false
        );
    }


    modalWindow.classList.remove(
        "choice-inspector-modal"
    );


    modalKicker.textContent =
        "SYSTEM MESSAGE";

    modalTitle.textContent =
        title;


    modalBody.textContent =
        message;


    modalConfirmButton.textContent =
        confirmLabel;


    modalCancelButton.textContent =
        cancelLabel;


    modalCancelButton.hidden =
        hideCancel;


    modalConfirmButton.classList.toggle(
        "danger",
        danger
    );


    modalBackdrop.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );


    window.setTimeout(
        () => {

            modalConfirmButton.focus();

        },
        0
    );


    return new Promise(
        resolve => {

            activeModalResolver =
                resolve;
        }
    );
}


modalCancelButton.addEventListener(
    "click",
    () => {

        closeGameModal(
            false
        );
    }
);


modalConfirmButton.addEventListener(
    "click",
    () => {

        closeGameModal(
            true
        );
    }
);


/* =========================================================
   QUICK MICRO-EVENT
========================================================= */

const microEventBackdrop = document.createElement("div");
microEventBackdrop.className = "micro-event-backdrop";
microEventBackdrop.hidden = true;

const microEventWindow = document.createElement("section");
microEventWindow.className = "micro-event-window";
microEventWindow.setAttribute("role", "dialog");
microEventWindow.setAttribute("aria-modal", "true");

const microEventKicker = document.createElement("div");
microEventKicker.className = "micro-event-kicker";
microEventKicker.textContent = "BETWEEN THE BEATS";

const microEventTitle = document.createElement("h3");
microEventTitle.className = "micro-event-title";

const microEventPrompt = document.createElement("p");
microEventPrompt.className = "micro-event-prompt";

const microEventOptions = document.createElement("div");
microEventOptions.className = "micro-event-options";

const microEventStatus = document.createElement("div");
microEventStatus.className = "micro-event-status";

microEventWindow.append(
    microEventKicker,
    microEventTitle,
    microEventPrompt,
    microEventOptions,
    microEventStatus,
);
microEventBackdrop.appendChild(microEventWindow);
document.body.appendChild(microEventBackdrop);

let microEventSubmitting = false;
let microEventResolvedHold = false;

function localPlayerIdForState(state = latestChoiceState) {
    const ownCharacterId = selectedCharacter?.character_id ?? null;
    if (!ownCharacterId) return activeAdventure?.player_id ?? null;

    const player = (state?.readiness ?? []).find(
        item => item?.character_id === ownCharacterId
    );

    return player?.player_id ?? activeAdventure?.player_id ?? null;
}

function renderPendingMicroEvent(state = latestChoiceState) {
    const event = state?.pending_micro_event ?? null;

    // Phase-B contract: newly generated turn content must not visually leak
    // through the intermission/story-ready curtain. Reconnects with no active
    // transition still open the pending event immediately.
    if (event && storyAdvancing) {
        return;
    }

    if (!event) {
        if (!microEventResolvedHold) {
            microEventBackdrop.hidden = true;
            document.body.classList.remove("micro-event-open");
        }
        microEventSubmitting = false;
        return;
    }

    const ownPlayerId = localPlayerIdForState(state);
    const responses = event?.responses ?? {};
    const alreadyAnswered = Boolean(
        ownPlayerId && Object.prototype.hasOwnProperty.call(responses, ownPlayerId)
    );

    microEventTitle.textContent = String(event.title ?? "QUICK EVENT").toUpperCase();
    microEventPrompt.textContent = String(event.prompt ?? "Something changes between story beats.");
    microEventOptions.replaceChildren();

    for (const option of (event.options ?? [])) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "micro-event-option";
        button.disabled = alreadyAnswered || microEventSubmitting;
        button.dataset.optionId = option.id;

        const label = document.createElement("strong");
        label.textContent = String(option.label ?? "RESPOND").toUpperCase();

        const description = document.createElement("span");
        description.textContent = String(option.description ?? "");

        button.append(label, description);
        microEventOptions.appendChild(button);
    }

    const responseCount = Object.keys(responses).length;
    const required = Math.max(1, (state?.readiness ?? []).length);

    microEventStatus.textContent = alreadyAnswered
        ? (
            state?.play_mode === "solo"
                ? "REACTION LOCKED // CONTINUING STORY_"
                : `REACTION LOCKED // WAITING FOR PARTNER (${responseCount}/${required})_`
        )
        : "CHOOSE YOUR INSTINCT // THIS DOES NOT USE A FULL TURN_";

    microEventBackdrop.hidden = false;
    document.body.classList.add("micro-event-open");
}

microEventOptions.addEventListener("click", event => {
    const button = event.target.closest(".micro-event-option");
    if (!button || button.disabled || microEventSubmitting || !currentRoomCode) return;

    const optionId = button.dataset.optionId;
    if (!optionId) return;

    microEventSubmitting = true;
    for (const optionButton of microEventOptions.querySelectorAll(".micro-event-option")) {
        optionButton.disabled = true;
    }
    microEventStatus.textContent = "LOCKING REACTION_";

    socket.emit("submit_micro_event_choice", {
        room_code: currentRoomCode,
        option_id: optionId,
    });
});

function showMicroEventResolution(event) {
    if (!event) return;

    microEventResolvedHold = true;
    microEventSubmitting = false;
    microEventOptions.replaceChildren();
    microEventTitle.textContent = String(event.title ?? "QUICK EVENT").toUpperCase();
    microEventPrompt.textContent = String(
        event.resolution ?? "The moment passes, but the choice becomes part of the story."
    );
    microEventStatus.textContent = "STORY FACT RECORDED_";
    microEventBackdrop.hidden = false;
    document.body.classList.add("micro-event-open");

    window.setTimeout(() => {
        microEventResolvedHold = false;
        microEventBackdrop.hidden = true;
        document.body.classList.remove("micro-event-open");
    }, 1300);
}


modalBackdrop.addEventListener(
    "click",
    event => {

        if (
            event.target
            === modalBackdrop
        ) {

            closeGameModal(
                false
            );
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            modalBackdrop.hidden
        ) {

            return;
        }


        if (
            event.key
            === "Escape"
        ) {

            closeGameModal(
                false
            );
        }
    }
);


/* =========================================================
   HEADER UTILITY MENUS
========================================================= */

const headerAccountMenu =
    document.getElementById(
        "account-menu"
    );


const headerSessionMenu =
    document.getElementById(
        "session-menu"
    );


if (
    headerAccountMenu
) {

    const accountMenuAccount =
        document.createElement(
            "button"
        );


    accountMenuAccount.type =
        "button";

    accountMenuAccount.className =
        "header-dropdown-action info";

    accountMenuAccount.textContent =
        "MY ACCOUNT";


    accountMenuAccount.addEventListener(
        "click",
        () => {

            closeHeaderDropdowns();


            if (
                typeof window.totOpenAccountManager
                === "function"
            ) {

                window.totOpenAccountManager();
            }
        }
    );


    const accountMenuHero =
        document.createElement(
            "button"
        );


    accountMenuHero.type =
        "button";

    accountMenuHero.className =
        "header-dropdown-action";

    accountMenuHero.textContent =
        "HERO HOME";


    accountMenuHero.addEventListener(
        "click",
        () => {

            closeHeaderDropdowns();


            selectedCharacterSummary
            ?.click();
        }
    );


    headerAccountMenu.append(
        accountMenuAccount,
        accountMenuHero,
    );


    if (
        typeof currentUserHasPermission
        === "function"
        && currentUserHasPermission(
            "author"
        )
    ) {

        const authorLink =
            document.createElement(
                "a"
            );


        authorLink.className =
            (
                "header-dropdown-action "
                + "continue"
            );

        authorLink.href =
            "/author";

        authorLink.textContent =
            "AUTHOR PORTAL";


        headerAccountMenu.appendChild(
            authorLink
        );
    }


    const accountMenuLogout =
        document.createElement(
            "button"
        );


    accountMenuLogout.type =
        "button";

    accountMenuLogout.className =
        "header-dropdown-action danger";

    accountMenuLogout.textContent =
        "LOG OUT";


    accountMenuLogout.addEventListener(
        "click",
        () => {

            closeHeaderDropdowns();


            logoutButton
            ?.click();
        }
    );


    headerAccountMenu.appendChild(
        accountMenuLogout
    );
}


if (
    headerSessionMenu
    && adventureRoomPanel
) {

    headerSessionMenu.appendChild(
        adventureRoomPanel
    );
}


/* =========================================================
   HEADER DROPDOWN TOGGLES
========================================================= */

const headerAccountMenuButton =
    document.getElementById(
        "account-menu-button"
    );


const headerSessionMenuButton =
    document.getElementById(
        "session-menu-button"
    );


function setHeaderDropdownOpen(
    button,
    menu,
    open,
) {

    if (
        !button
        || !menu
    ) {

        return;
    }


    menu.hidden =
        !open;


    button.setAttribute(
        "aria-expanded",
        open
            ? "true"
            : "false"
    );
}


function closeHeaderDropdowns() {

    setHeaderDropdownOpen(
        headerAccountMenuButton,
        headerAccountMenu,
        false,
    );


    setHeaderDropdownOpen(
        headerSessionMenuButton,
        headerSessionMenu,
        false,
    );
}


headerAccountMenuButton
?.addEventListener(
    "click",
    event => {

        event.stopPropagation();


        const willOpen =
            Boolean(
                headerAccountMenu?.hidden
            );


        closeHeaderDropdowns();


        setHeaderDropdownOpen(
            headerAccountMenuButton,
            headerAccountMenu,
            willOpen,
        );
    }
);


headerSessionMenuButton
?.addEventListener(
    "click",
    event => {

        event.stopPropagation();


        const willOpen =
            Boolean(
                headerSessionMenu?.hidden
            );


        closeHeaderDropdowns();


        setHeaderDropdownOpen(
            headerSessionMenuButton,
            headerSessionMenu,
            willOpen,
        );
    }
);


headerAccountMenu
?.addEventListener(
    "click",
    event => {

        event.stopPropagation();
    }
);


headerSessionMenu
?.addEventListener(
    "click",
    event => {

        event.stopPropagation();
    }
);


document.addEventListener(
    "click",
    closeHeaderDropdowns
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key
            === "Escape"
        ) {

            closeHeaderDropdowns();
        }
    }
);


/*
   System status remains intentionally hidden from players.
   Add .dev-mode to <body> in the browser console if needed.
*/


/* =========================================================
   WORKSPACE
========================================================= */
/* =========================================================
   WORKSPACE
========================================================= */

const adventureWorkspace =
    document.createElement(
        "div"
    );


adventureWorkspace.className =
    "adventure-workspace";


const adventureSidebar =
    document.createElement(
        "aside"
    );


adventureSidebar.className =
    "adventure-sidebar";


if (
    adventureGamePanel
    && adventureGamePanel.parentNode
) {

    adventureGamePanel
    .parentNode
    .insertBefore(
        adventureWorkspace,
        adventureGamePanel
    );


    adventureWorkspace.append(
        adventureGamePanel,
        adventureSidebar,
    );


    if (
        adventureChatPanel
    ) {

        adventureSidebar.appendChild(
            adventureChatPanel
        );
    }
}



/* =========================================================
   PARTY CHAT CONTROLS // COLLAPSE + ASCII EMOTES
========================================================= */

if (
    adventureChatPanel
) {

    const chatHeading =
        adventureChatPanel.querySelector(
            ".panel-heading"
        );

    if (
        chatHeading
    ) {

        const title =
            document.createElement(
                "span"
            );

        title.textContent =
            "PARTY CHAT";


        const controls =
            document.createElement(
                "span"
            );

        controls.className =
            "chat-panel-controls";


        const collapse =
            document.createElement(
                "button"
            );

        collapse.type =
            "button";

        collapse.className =
            "chat-collapse-button";

        collapse.textContent =
            "[−]";

        collapse.setAttribute(
            "aria-label",
            "Collapse party chat"
        );

        collapse.setAttribute(
            "aria-expanded",
            "true"
        );


        collapse.addEventListener(
            "click",
            () => {

                const collapsed =
                    adventureChatPanel.classList.toggle(
                        "is-collapsed"
                    );

                collapse.textContent =
                    collapsed
                        ? "[+]"
                        : "[−]";

                collapse.setAttribute(
                    "aria-expanded",
                    String(!collapsed)
                );
            }
        );


        controls.appendChild(
            collapse
        );


        chatHeading.replaceChildren(
            title,
            controls,
        );
    }


    const chatInputRow =
        adventureChatPanel.querySelector(
            ".chat-input-row"
        );

    const chatInput =
        adventureChatPanel.querySelector(
            "#chat-input"
        );

    const sendButton =
        adventureChatPanel.querySelector(
            "#send-chat-button"
        );


    if (
        chatInputRow
        && chatInput
        && sendButton
    ) {

        const asciiButton =
            document.createElement(
                "button"
            );

        asciiButton.type =
            "button";

        asciiButton.className =
            "chat-ascii-button";

        asciiButton.textContent =
            ":-)";

        asciiButton.setAttribute(
            "aria-label",
            "Open ASCII emotes"
        );


        const picker =
            document.createElement(
                "div"
            );

        picker.className =
            "chat-ascii-picker";

        picker.hidden =
            true;


        const faces = [
            ":-)", ":-D", ";-)", ":-P", ":-(", ":-/",
            ":-|", ":O", "XD", "T_T", "^_^", "-_-",
            "o_O", "O_o", ":3", "<3", "</3", "._.",
            "(>_<)", "(._.)", "(¬_¬)", "ಠ_ಠ", "ಥ_ಥ",
            "ಠ‿ಠ", "(•_•)", "(⌐■_■)", "¯\\_(ツ)_/¯",
            "(ง'̀-'́)ง", "(づ｡◕‿‿◕｡)づ", "ʕ•ᴥ•ʔ",
            "(•̀ᴗ•́)و", "(☞ﾟヮﾟ)☞", "☜(ﾟヮﾟ☜)",
            "(╯°□°）╯︵ ┻━┻", "┬─┬ ノ( ゜-゜ノ)",
        ];


        for (
            const face
            of faces
        ) {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "chat-ascii-option";

            button.textContent =
                face;


            button.addEventListener(
                "click",
                () => {

                    const start =
                        chatInput.selectionStart
                        ?? chatInput.value.length;

                    const end =
                        chatInput.selectionEnd
                        ?? chatInput.value.length;

                    const prefix =
                        (
                            start > 0
                            && !/\s$/.test(
                                chatInput.value.slice(
                                    0,
                                    start
                                )
                            )
                        )
                            ? " "
                            : "";

                    chatInput.value =
                        (
                            chatInput.value.slice(
                                0,
                                start
                            )
                            + prefix
                            + face
                            + chatInput.value.slice(
                                end
                            )
                        );

                    picker.hidden =
                        true;

                    chatInput.focus();
                }
            );


            picker.appendChild(
                button
            );
        }


        asciiButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                picker.hidden =
                    !picker.hidden;
            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    picker.hidden
                    || picker.contains(event.target)
                    || event.target === asciiButton
                ) {
                    return;
                }

                picker.hidden =
                    true;
            }
        );


        chatInputRow.insertBefore(
            asciiButton,
            sendButton,
        );

        chatInputRow.appendChild(
            picker
        );
    }
}


/* =========================================================
   TURN FLOW / INTERMISSION UX
========================================================= */

const turnFlowPanel =
    document.createElement(
        "section"
    );

turnFlowPanel.className =
    "turn-flow-panel";


const turnFlowPhase =
    document.createElement(
        "div"
    );

turnFlowPhase.className =
    "turn-flow-phase";

turnFlowPhase.textContent =
    "CHOOSING ACTIONS_";


const turnFlowPlayers =
    document.createElement(
        "div"
    );

turnFlowPlayers.className =
    "turn-flow-players";


const turnFlowSheetButton =
    document.createElement(
        "button"
    );

turnFlowSheetButton.type =
    "button";

turnFlowSheetButton.className =
    "turn-flow-sheet-button";

turnFlowSheetButton.textContent =
    "CHARACTER SHEET";


const turnFlowHeader =
    document.createElement(
        "div"
    );

turnFlowHeader.className =
    "turn-flow-header";


turnFlowHeader.append(
    turnFlowPhase,
    turnFlowSheetButton,
);


turnFlowPanel.append(
    turnFlowHeader,
    turnFlowPlayers,
);


if (
    adventureSidebar
) {

    adventureSidebar.prepend(
        turnFlowPanel
    );
}


const choiceCommitPanel =
    document.createElement(
        "div"
    );

choiceCommitPanel.className =
    "choice-commit-panel";


const choiceCommitStatus =
    document.createElement(
        "div"
    );

choiceCommitStatus.className =
    "choice-commit-status";

choiceCommitStatus.textContent =
    "SELECT AN ACTION_";


const choiceCommitButton =
    document.createElement(
        "button"
    );

choiceCommitButton.type =
    "button";

choiceCommitButton.className =
    "terminal-button primary choice-commit-button";

choiceCommitButton.textContent =
    "LOCK IN CHOICE";

choiceCommitButton.disabled =
    true;


choiceCommitPanel.append(
    choiceCommitStatus,
    choiceCommitButton,
);


if (
    choiceListElement
    && choiceListElement.parentNode
) {

    choiceListElement.parentNode.insertBefore(
        choiceCommitPanel,
        choiceListElement.nextSibling,
    );
}


const turnTransitionOverlay =
    document.createElement(
        "section"
    );

turnTransitionOverlay.className =
    "turn-transition-overlay";

turnTransitionOverlay.hidden =
    true;

turnTransitionOverlay.innerHTML =
    `
    <div class="turn-transition-content">
        <div class="turn-transition-stage">
            <div class="turn-transition-kicker">CHOICES LOCKED</div>
            <div class="turn-transition-count">5</div>
            <div class="turn-transition-copy">THE STORY IS ABOUT TO MOVE_</div>
        </div>
        <div class="turn-transition-game-slot"></div>
    </div>
    `;

document.body.appendChild(
    turnTransitionOverlay
);


function renderChoiceCommitState() {

    const selectedButton =
        locallySelectedChoiceId
            ? choiceListElement?.querySelector(
                `.choice-button[data-choice-id="${CSS.escape(locallySelectedChoiceId)}"]`
            )
            : null;

    const selectedLabel =
        selectedButton
            ?.querySelector(
                ".choice-label"
            )
            ?.textContent
            ?.replace(
                /^\[\d+\]\s*/,
                ""
            )
            ?? null;

    if (locallyChoiceLocked) {

        choiceCommitStatus.textContent =
            selectedLabel
                ? `LOCKED // ${selectedLabel}`
                : "CHOICE LOCKED_";

        choiceCommitButton.textContent =
            "LOCKED";

        choiceCommitButton.disabled =
            true;

        return;
    }

    if (latestChoiceState?.pending_micro_event) {

        choiceCommitStatus.textContent =
            "QUICK EVENT // RESPOND BEFORE THE NEXT ACTION_";

        choiceCommitButton.textContent =
            "LOCKED";

        choiceCommitButton.disabled =
            true;

        return;
    }

    if (storyAdvancing) {

        choiceCommitStatus.textContent =
            "TURN RESOLVING_";

        choiceCommitButton.textContent =
            "LOCKED";

        choiceCommitButton.disabled =
            true;

        return;
    }

    choiceCommitStatus.textContent =
        selectedLabel
            ? `SELECTED // ${selectedLabel}`
            : "SELECT AN ACTION_";

    choiceCommitButton.textContent =
        "LOCK IN CHOICE";

    choiceCommitButton.disabled =
        !locallySelectedChoiceId;
}


choiceCommitButton.addEventListener(
    "click",
    () => {

        if (
            locallyChoiceLocked
            || storyAdvancing
            || latestChoiceState?.pending_micro_event
            || !locallySelectedChoiceId
        ) {

            return;
        }

        choiceCommitButton.disabled =
            true;

        choiceCommitStatus.textContent =
            "LOCKING CHOICE_";

        socket.emit(
            "submit_choice",
            {
                choice_id:
                    locallySelectedChoiceId,
            }
        );
    }
);


function hideTurnTransitionOverlay(
    { revealStory = false } = {},
) {

    if (lockCountdownTimer) {

        window.clearInterval(
            lockCountdownTimer
        );

        lockCountdownTimer =
            null;
    }

    turnTransitionOverlay.classList.add(
        "is-closing"
    );

    window.setTimeout(
        () => {
            turnTransitionOverlay.hidden =
                true;

            turnTransitionOverlay.classList.remove(
                "is-blackout",
                "is-visible",
                "is-game",
                "is-story-ready",
                "is-closing",
            );

            activeLockCountdownTurn =
                null;

            activeIntermissionTurn =
                null;

            if (revealStory) {
                window.dispatchEvent(
                    new CustomEvent(
                        "tot:turn-reveal-ready",
                        {
                            detail: {
                                room_code:
                                    currentRoomCode,
                            },
                        },
                    )
                );
            }
        },
        420,
    );
}


function asciiCountdownNumber(
    value,
) {

    const glyphs = {
        3: [
            "33333",
            "    3",
            " 3333",
            "    3",
            "33333",
        ],
        2: [
            "22222",
            "    2",
            "22222",
            "2    ",
            "22222",
        ],
        1: [
            "  11 ",
            " 111 ",
            "  11 ",
            "  11 ",
            "11111",
        ],
        0: [
            "00000",
            "0   0",
            "0   0",
            "0   0",
            "00000",
        ],
    };

    const normalized =
        Math.max(
            0,
            Math.min(
                3,
                Math.ceil(
                    Number(value) || 0
                )
            )
        );

    return (
        glyphs[normalized]
        ?? glyphs[0]
    ).join("\n");
}


function showStoryReadyCountdown(
    seconds = 3,
) {

    const duration =
        Math.max(
            1,
            Number(seconds) || 3,
        );

    const kicker =
        turnTransitionOverlay.querySelector(
            ".turn-transition-kicker"
        );

    const count =
        turnTransitionOverlay.querySelector(
            ".turn-transition-count"
        );

    const copy =
        turnTransitionOverlay.querySelector(
            ".turn-transition-copy"
        );

    turnTransitionOverlay.hidden =
        false;

    turnTransitionOverlay.classList.add(
        "is-visible",
        "is-game",
        "is-story-ready",
    );

    turnTransitionOverlay.classList.remove(
        "is-blackout",
        "is-closing",
    );

    if (kicker) {
        kicker.textContent =
            "STORY READY";
    }

    if (copy) {
        copy.textContent =
            "NEXT STORY BEAT READY // KEEP PLAYING UNTIL ZERO_";
    }

    const started =
        performance.now();

    const tick =
        () => {
            const elapsed =
                (
                    performance.now()
                    - started
                ) / 1000;

            const remaining =
                Math.max(
                    0,
                    duration - elapsed,
                );

            if (count) {
                count.hidden = false;
                count.textContent =
                    asciiCountdownNumber(
                        remaining
                    );
            }

            if (remaining <= 0) {
                if (lockCountdownTimer) {
                    window.clearInterval(
                        lockCountdownTimer
                    );
                    lockCountdownTimer = null;
                }

                hideTurnTransitionOverlay({
                    revealStory: true,
                });
            }
        };

    if (lockCountdownTimer) {
        window.clearInterval(
            lockCountdownTimer
        );
    }

    tick();

    lockCountdownTimer =
        window.setInterval(
            tick,
            80,
        );
}


function startTurnLockCountdown(
    data,
) {

    if (
        !roomPayloadMatchesActive(
            data
        )
    ) {

        return;
    }

    const countdownTurn =
        Number(
            data?.turn_number
            ?? 0
        );

    if (
        countdownTurn > 0
        && activeLockCountdownTurn
            === countdownTurn
        && !turnTransitionOverlay.hidden
        && lockCountdownTimer
    ) {

        return;
    }

    activeLockCountdownTurn =
        countdownTurn || null;

    if (lockCountdownTimer) {

        window.clearInterval(
            lockCountdownTimer
        );
    }

    const duration =
        Math.max(
            1,
            Number(
                data?.duration_seconds
                ?? 3
            )
        );

    const countElement =
        turnTransitionOverlay.querySelector(
            ".turn-transition-count"
        );

    const copyElement =
        turnTransitionOverlay.querySelector(
            ".turn-transition-copy"
        );

    const started =
        performance.now();

    turnTransitionOverlay.hidden =
        false;

    turnTransitionOverlay.classList.add(
        "is-visible"
    );

    turnTransitionOverlay.classList.remove(
        "is-blackout",
        "is-game",
        "is-story-ready",
        "is-closing",
    );

    if (countElement) {
        countElement.hidden = false;
    }

    if (copyElement) {
        copyElement.hidden = false;
    }

    const kickerElement =
        turnTransitionOverlay.querySelector(
            ".turn-transition-kicker"
        );

    if (kickerElement) {
        kickerElement.textContent =
            "CHOICES LOCKED";
    }

    const gameSlot =
        turnTransitionOverlay.querySelector(
            ".turn-transition-game-slot"
        );

    if (gameSlot) {
        gameSlot.hidden = true;
    }

    const tick =
        () => {

            const elapsed =
                (
                    performance.now()
                    - started
                ) / 1000;

            const remaining =
                Math.max(
                    0,
                    duration - elapsed
                );

            if (countElement) {

                countElement.textContent =
                    asciiCountdownNumber(
                        remaining
                    );
            }

            if (remaining <= 0) {

                if (lockCountdownTimer) {

                    window.clearInterval(
                        lockCountdownTimer
                    );

                    lockCountdownTimer =
                        null;
                }

                const queuedReady =
                    queuedStoryReadySeconds;

                queuedStoryReadySeconds =
                    0;

                if (queuedReady > 0) {
                    queuedIntermissionPayload =
                        null;
                    storyAdvancing = true;
                    showStoryReadyCountdown(
                        queuedReady
                    );
                    return;
                }

                const queued =
                    queuedIntermissionPayload;

                queuedIntermissionPayload =
                    null;

                if (queued) {
                    startIntermission(queued);
                    return;
                }

                turnTransitionOverlay.classList.add(
                    "is-blackout"
                );

                if (copyElement) {

                    copyElement.textContent =
                        "THE MACHINATIONS BEGIN_";
                }
            }
        };

    tick();

    lockCountdownTimer =
        window.setInterval(
            tick,
            80,
        );
}


/* =========================================================
   IN-ADVENTURE CHARACTER SHEET MODAL
========================================================= */

const characterSheetBackdrop =
    document.createElement(
        "section"
    );

characterSheetBackdrop.className =
    "character-sheet-backdrop";

characterSheetBackdrop.hidden =
    true;

characterSheetBackdrop.innerHTML =
    `
    <div
        class="character-sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-sheet-title"
    >
        <div class="character-sheet-header">
            <div>
                <div class="eyebrow">CURRENT HERO // LIVE SHEET</div>
                <h2 id="character-sheet-title">CHARACTER SHEET</h2>
            </div>

            <button
                type="button"
                class="character-sheet-close"
                aria-label="Close character sheet"
            >
                ×
            </button>
        </div>

        <div class="character-sheet-content"></div>
    </div>
    `;


document.body.appendChild(
    characterSheetBackdrop
);


const characterSheetContent =
    characterSheetBackdrop.querySelector(
        ".character-sheet-content"
    );


const characterSheetClose =
    characterSheetBackdrop.querySelector(
        ".character-sheet-close"
    );


function activeCharacterEffects() {

    const state =
        latestTurnFlowState
        ?? {};


    const candidates = [
        state.character_effects,
        state.status_effects,
        state.effects,
    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            Array.isArray(
                candidate
            )
        ) {

            return candidate;
        }
    }


    return [];
}


function escapeSheetText(
    value,
) {

    return String(
        value
        ?? ""
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );
}


function formatSheetValues(
    values,
) {

    if (
        !values
        || typeof values
            !== "object"
    ) {

        return (
            '<div class="character-sheet-empty">—</div>'
        );
    }


    const entries =
        Object.entries(
            values
        );


    if (
        entries.length === 0
    ) {

        return (
            '<div class="character-sheet-empty">—</div>'
        );
    }


    return entries
    .map(
        (
            [
                key,
                value,
            ]
        ) =>
            (
                `<div class="character-sheet-stat-row">`
                + `<span>${escapeSheetText(
                    String(
                        key
                    )
                    .replaceAll(
                        "_",
                        " "
                    )
                    .toUpperCase()
                )}</span>`
                + `<strong>${escapeSheetText(
                    value
                )}</strong>`
                + `</div>`
            )
    )
    .join(
        ""
    );
}


async function openCharacterSheetModal() {

    if (
        !currentRoomCode
        || !selectedCharacter
    ) {

        return;
    }


    let character =
        selectedCharacter;


    try {

        if (
            typeof apiRequest
            === "function"
        ) {

            character =
                await apiRequest(
                    `/api/characters/${selectedCharacter.character_id}`,
                    {
                        method:
                            "GET",
                    }
                );


            const index =
                characters.findIndex(
                    item =>
                        item.character_id
                        === character.character_id
                );


            if (
                index >= 0
            ) {

                characters[
                    index
                ] = character;
            }


            selectedCharacter =
                character;
        }

    } catch (
        error
    ) {

        console.warn(
            "[CHARACTER SHEET] Could not refresh character from server.",
            error
        );
    }


    const effects =
        activeCharacterEffects();


    const effectsMarkup =
        (
            effects.length > 0
                ? effects
                    .map(
                        effect =>
                            (
                                `<div class="character-sheet-effect">`
                                + `<strong>${escapeSheetText(compactEffectName(effect)).toUpperCase()}</strong>`
                                + `${effectMechanicalMeta(effect) ? `<small>${escapeSheetText(effectMechanicalMeta(effect))}</small>` : ``}`
                                + `${effect?.description ? `<span>${escapeSheetText(effect.description)}</span>` : ``}`
                                + `</div>`
                            )
                    )
                    .join(
                        ""
                    )
                : (
                    `<div class="character-sheet-effect none">`
                    + `NONE ACTIVE`
                    + `</div>`
                )
        );


    characterSheetContent.innerHTML =
        `
        <div class="character-sheet-vitals">
            <div>
                <span>HERO</span>
                <strong>${escapeSheetText(
                    character.name
                    ?? "HERO"
                ).toUpperCase()}</strong>
            </div>

            <div>
                <span>LEVEL</span>
                <strong>${escapeSheetText(
                    character.level
                    ?? 1
                )}</strong>
            </div>

            <div>
                <span>HP</span>
                <strong>${escapeSheetText(
                    character.health
                    ?? 0
                )}/${escapeSheetText(
                    character.max_health
                    ?? 0
                )}</strong>
            </div>

            <div>
                <span>XP</span>
                <strong>${escapeSheetText(
                    character.experience
                    ?? 0
                )}</strong>
            </div>
        </div>

        <div class="character-sheet-sections">
            <section>
                <div class="character-sheet-label">CURRENT STATS</div>
                <div class="character-sheet-values">
                    ${formatSheetValues(
                        character.stats
                    )}
                </div>
            </section>

            <section>
                <div class="character-sheet-label">CURRENT SKILLS</div>
                <div class="character-sheet-values">
                    ${formatSheetValues(
                        character.skills
                    )}
                </div>
            </section>
        </div>

        <section class="character-sheet-effects">
            <div class="character-sheet-label">ACTIVE EFFECTS</div>
            ${effectsMarkup}
        </section>
        `;


    characterSheetBackdrop.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );


    characterSheetClose.focus();
}


function closeCharacterSheetModal() {

    characterSheetBackdrop.hidden =
        true;


    document.body.classList.remove(
        "modal-open"
    );
}


turnFlowSheetButton.addEventListener(
    "click",
    openCharacterSheetModal
);


characterSheetClose.addEventListener(
    "click",
    closeCharacterSheetModal
);


characterSheetBackdrop.addEventListener(
    "click",
    event => {

        if (
            event.target
            === characterSheetBackdrop
        ) {

            closeCharacterSheetModal();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
            && !characterSheetBackdrop.hidden
        ) {

            closeCharacterSheetModal();
        }
    }
);


const intermissionMount =
    document.createElement(
        "section"
    );

intermissionMount.className =
    "intermission-mount";

intermissionMount.hidden =
    true;


const turnTransitionGameSlot =
    turnTransitionOverlay.querySelector(
        ".turn-transition-game-slot"
    );


if (turnTransitionGameSlot) {
    turnTransitionGameSlot.appendChild(
        intermissionMount
    );
}


/*
   Turn recap belongs at the beginning of the NEXT story beat.
   Reuse the existing resolution panel/rendering rather than
   duplicating any roll or narrative presentation code.
*/

if (
    resolutionPanel
    && sceneTitleElement
) {

    adventureGamePanel.insertBefore(
        resolutionPanel,
        sceneTitleElement
    );


    resolutionPanel.classList.add(
        "turn-recap-panel"
    );


    const heading =
        resolutionPanel.querySelector(
            ".resolution-heading"
        );


    if (
        heading
    ) {

        heading.textContent =
            "PREVIOUS TURN // ACTIONS + ROLLS";
    }
}


function roomPayloadMatchesActive(
    payload,
) {

    const payloadRoomCode =
        payload?.room_code
        ?? payload?.code
        ?? null;


    return Boolean(
        currentRoomCode
        && payloadRoomCode
        && payloadRoomCode
            === currentRoomCode
    );
}


function intermissionPayloadFromGameState(
    state,
) {

    const pending =
        state?.pending_intermission
        ?? {};

    const turnNumber =
        Math.max(
            1,
            Number(
                state?.turn_number
                ?? 1
            ) || 1,
        );

    const fallbackGameIds = [
        "rune_catch",
        "lantern_keep",
        "relic_scramble",
        "sigil_memory",
        "ward_breaker",
        "shadow_step",
    ];

    return {
        room_code:
            state?.room_code,

        turn_number:
            turnNumber,

        game_id:
            pending.game_id
            ?? fallbackGameIds[
                (turnNumber - 1)
                % fallbackGameIds.length
            ],

        play_mode:
            pending.play_mode
            ?? state?.play_mode
            ?? "coop",

        intermission_stats:
            Array.isArray(
                pending.intermission_stats
            )
                ? pending.intermission_stats
                : [],

        recovered_from_state:
            true,
    };
}


function allRequiredHeroesLocked(
    state,
) {

    const readiness =
        Array.isArray(
            state?.readiness
        )
            ? state.readiness
            : [];

    const requiredPlayers =
        Math.max(
            1,
            Number(
                state?.required_players
                ?? (
                    state?.play_mode
                        === "solo"
                        ? 1
                        : 2
                )
            ) || 1,
        );

    return (
        readiness.length
            >= requiredPlayers
        && readiness.filter(
            player =>
                Boolean(
                    player?.ready
                )
        ).length
            >= requiredPlayers
    );
}


async function showDirectorRetryPrompt(
    message =
        "The Story Director did not finish this turn in time.",
) {

    if (
        directorRetryPromptOpen
        || !currentRoomCode
    ) {
        return;
    }

    directorRetryPromptOpen =
        true;

    hideTurnTransitionOverlay();

    const retry = await showGameModal({
        title:
            "STORY DIRECTOR DELAYED",

        message:
            (
                String(message || "").trim()
                + "\n\nYour locked choices and dice results are preserved. "
                + "Retrying will continue from those exact results."
            ),

        confirmLabel:
            "RETRY STORY GENERATION",

        cancelLabel:
            "WAIT",
    });

    directorRetryPromptOpen =
        false;

    if (
        retry
        && currentRoomCode
    ) {

        setStatus(
            "RETRYING STORY DIRECTOR_"
        );

        socket.emit(
            "retry_pending_turn",
            {
                room_code:
                    currentRoomCode,
            }
        );
    }
}


function recoverTurnTransitionFromGameState(
    state,
) {

    if (
        !roomPayloadMatchesActive(
            state
        )
        || state?.director_complete
    ) {

        return;
    }

    if (
        state?.turn_pending
        && state?.director_retry_required
    ) {

        if (turnTransitionRecoveryTimer) {
            window.clearTimeout(
                turnTransitionRecoveryTimer
            );
            turnTransitionRecoveryTimer =
                null;
        }

        if (storyAdvancing) {
            stopIntermission(
                "error"
            );
        }

        hideTurnTransitionOverlay();

        showDirectorRetryPrompt(
            "The previous Director request is no longer active."
        );

        return;
    }

    if (state?.turn_pending) {

        if (turnTransitionRecoveryTimer) {
            window.clearTimeout(
                turnTransitionRecoveryTimer
            );
            turnTransitionRecoveryTimer =
                null;
        }

        const recoveredPayload =
            intermissionPayloadFromGameState(
                state
            );

        if (
            lockCountdownTimer
            && !turnTransitionOverlay.classList.contains(
                "is-game"
            )
            && !turnTransitionOverlay.classList.contains(
                "is-story-ready"
            )
        ) {
            queuedIntermissionPayload =
                recoveredPayload;
            storyAdvancing = true;
            renderChoiceCommitState();
            return;
        }

        if (
            turnTransitionOverlay.hidden
            || (
                !turnTransitionOverlay.classList.contains(
                    "is-game"
                )
                && !turnTransitionOverlay.classList.contains(
                    "is-story-ready"
                )
            )
        ) {

            startIntermission(
                recoveredPayload
            );
        }

        return;
    }

    if (
        !allRequiredHeroesLocked(
            state
        )
        || storyAdvancing
        || !turnTransitionOverlay.hidden
    ) {

        if (turnTransitionRecoveryTimer) {
            window.clearTimeout(
                turnTransitionRecoveryTimer
            );
            turnTransitionRecoveryTimer =
                null;
        }

        return;
    }

    /*
       ``turn_lock_countdown`` normally arrives immediately after the
       authoritative game-state broadcast.  Give that event a brief
       chance to drive the UI first; if it is missed, recover from the
       durable readiness state instead of leaving the player stranded.
    */
    if (!turnTransitionRecoveryTimer) {

        turnTransitionRecoveryTimer =
            window.setTimeout(
                () => {

                    turnTransitionRecoveryTimer =
                        null;

                    if (
                        turnTransitionOverlay.hidden
                        && latestTurnFlowState
                        && allRequiredHeroesLocked(
                            latestTurnFlowState
                        )
                        && !latestTurnFlowState.turn_pending
                    ) {

                        startTurnLockCountdown(
                            {
                                room_code:
                                    latestTurnFlowState.room_code,

                                turn_number:
                                    latestTurnFlowState.turn_number,

                                duration_seconds:
                                    3,

                                play_mode:
                                    latestTurnFlowState.play_mode,

                                recovered_from_state:
                                    true,
                            }
                        );
                    }
                },
                250,
            );
    }
}


function intermissionApi() {

    return (
        window.TalesIntermission
        ?? null
    );
}


function configureIntermission() {

    const api =
        intermissionApi();


    if (
        !api
        || api.configured
    ) {

        return;
    }


    api.configure({

        mount:
            intermissionMount,

        socket,

        getRoomCode:
            () => currentRoomCode,
    });


    if (
        pendingIntermissionPayload
    ) {

        api.start(
            pendingIntermissionPayload
        );

        pendingIntermissionPayload =
            null;
    }
}


intermissionScript.addEventListener(
    "load",
    configureIntermission
);


function renderTurnFlow(
    state,
) {

    latestTurnFlowState = {
        ...(state ?? {}),

        readiness:
            (
                state?.readiness
                ?? []
            )
            .map(
                player => ({
                    ...player,
                })
            ),
    };


    const readiness =
        latestTurnFlowState.readiness;


    updateSoloStartAvailability(
        latestTurnFlowState
    );


    latestIntermissionStats =
        state?.intermission_stats
        ?? latestIntermissionStats;


    latestIntermissionResult =
        state?.last_intermission_result
        ?? latestIntermissionResult;


    turnFlowPlayers.replaceChildren();


    for (
        const player
        of readiness
    ) {


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "turn-flow-player";


        if (
            selectedCharacter
            && player.character_id
                === selectedCharacter.character_id
        ) {

            card.classList.add(
                "is-you"
            );
        }


        const name =
            document.createElement(
                "strong"
            );


        name.textContent =
            player.name.toUpperCase();


        const status =
            document.createElement(
                "span"
            );


        status.className =
            (
                !player.online
                    ? "is-offline"
                    : player.ready
                        ? "is-ready"
                        : "is-thinking"
            );


        status.textContent =
            !player.online
                ? "OFFLINE"
                : player.ready
                    ? "READY"
                    : "THINKING";


        name.className =
            "turn-flow-label";


        status.classList.add(
            "turn-flow-value"
        );


        card.append(
            name,
            status,
        );


        turnFlowPlayers.appendChild(
            card
        );
    }


    /*
       Compact 2x2 status instrument.
       Co-op: P1 / P2 / DIRECTOR / ROOM.
       Solo: Hero / TURN / DIRECTOR / ROOM.
    */

    if (
        readiness.length < 2
    ) {

        const turnCell =
            document.createElement(
                "div"
            );

        turnCell.className =
            "turn-flow-player turn-flow-system";

        turnCell.innerHTML =
            (
                `<strong class="turn-flow-label">TURN</strong>`
                + `<span class="turn-flow-value">${String(
                    state?.turn_number
                    ?? "--"
                ).padStart(2, "0")}</span>`
            );

        turnFlowPlayers.appendChild(
            turnCell
        );
    }


    const directorCell =
        document.createElement(
            "div"
        );

    directorCell.className =
        "turn-flow-player turn-flow-system";

    directorCell.innerHTML =
        (
            `<strong class="turn-flow-label">DIRECTOR</strong>`
            + `<span class="turn-flow-value">${
                state?.director_complete
                    ? "COMPLETE"
                    : (
                        storyAdvancing
                        || state?.turn_pending
                    )
                        ? "WRITING"
                        : "READY"
            }</span>`
        );


    const roomCell =
        document.createElement(
            "div"
        );

    roomCell.className =
        "turn-flow-player turn-flow-system";

    roomCell.innerHTML =
        (
            `<strong class="turn-flow-label">ROOM</strong>`
            + `<span class="turn-flow-value">${
                String(
                    state?.play_mode
                    ?? "CO-OP"
                ).toUpperCase()
            }</span>`
        );


    turnFlowPlayers.append(
        directorCell,
        roomCell,
    );


    if (
        state?.director_complete
    ) {

        turnFlowPhase.textContent =
            "ADVENTURE COMPLETE_";

        return;
    }


    if (
        storyAdvancing
        || state?.turn_pending
    ) {

        turnFlowPhase.textContent =
            (
                `STORY ADVANCING // `
                + `TURN ${String(
                    state?.turn_number
                    ?? ""
                ).padStart(
                    2,
                    "0"
                )} IS LOCKED AND BEING WRITTEN_`
            );

        return;
    }


    if (state?.pending_micro_event) {

        turnFlowPhase.textContent =
            "QUICK EVENT // REACT BEFORE THE NEXT TURN_";

        return;
    }


    const online =
        readiness.filter(
            player =>
                player.online
        );


    const ready =
        online.filter(
            player =>
                player.ready
        );


    if (
        latestTurnFlowState.play_mode
        === "solo"
    ) {

        turnFlowPhase.textContent =
            ready.length > 0
                ? "CHOICE LOCKED // RESOLVING_"
                : "CHOOSING ACTION_";

    } else if (
        online.length >= 2
        && ready.length
            === online.length
    ) {

        turnFlowPhase.textContent =
            "BOTH READY // LOCKING CHOICES_";

    } else if (
        ready.length > 0
    ) {

        turnFlowPhase.textContent =
            "WAITING FOR PARTNER_";

    } else {

        turnFlowPhase.textContent =
            "CHOOSING ACTIONS_";
    }
}


function showLocalChoiceLockedTransition() {

    if (
        !latestTurnFlowState
    ) {

        turnFlowPhase.textContent =
            activeAdventure?.play_mode === "solo"
                ? "CHOICE LOCKED // RESOLVING_"
                : "WAITING FOR PARTNER_";

        return;
    }


    const readiness =
        latestTurnFlowState.readiness
        ?? [];


    let foundLocalPlayer =
        false;


    for (
        const player
        of readiness
    ) {

        if (
            selectedCharacter
            && player.character_id
                === selectedCharacter.character_id
        ) {

            player.ready =
                true;

            foundLocalPlayer =
                true;
        }
    }


    if (
        foundLocalPlayer
    ) {

        renderTurnFlow(
            latestTurnFlowState
        );

    } else {

        turnFlowPhase.textContent =
            activeAdventure?.play_mode === "solo"
                ? "CHOICE LOCKED // RESOLVING_"
                : "WAITING FOR PARTNER_";
    }
}


function startIntermission(
    data,
) {

    // The Director request is allowed to begin immediately on the server,
    // but the opening lock countdown owns the modal for its full three
    // seconds. Queue the game payload until that theatrical countdown ends.
    if (
        lockCountdownTimer
        && !turnTransitionOverlay.classList.contains(
            "is-game"
        )
        && !turnTransitionOverlay.classList.contains(
            "is-story-ready"
        )
    ) {
        queuedIntermissionPayload =
            data;
        storyAdvancing = true;
        renderChoiceCommitState();
        return;
    }

    const intermissionTurn =
        Number(
            data?.turn_number
            ?? 0
        );

    if (
        intermissionTurn > 0
        && activeIntermissionTurn
            === intermissionTurn
        && storyAdvancing
        && !turnTransitionOverlay.hidden
    ) {

        return;
    }

    activeIntermissionTurn =
        intermissionTurn || null;

    if (lockCountdownTimer) {
        window.clearInterval(
            lockCountdownTimer
        );
        lockCountdownTimer = null;
    }

    storyAdvancing =
        true;

    renderChoiceCommitState();

    turnTransitionOverlay.hidden =
        false;

    turnTransitionOverlay.classList.add(
        "is-visible",
        "is-blackout",
    );

    turnTransitionOverlay.classList.remove(
        "is-story-ready",
        "is-closing",
    );


    turnFlowPhase.textContent =
        (
            `STORY ADVANCING // `
            + `TURN ${String(
                data.turn_number
            ).padStart(
                2,
                "0"
            )} IS BEING WRITTEN_`
        );


    for (
        const button
        of choiceListElement
        .querySelectorAll(
            ".choice-button"
        )
    ) {

        button.disabled =
            true;
    }


    window.setTimeout(
        () => {
            const kicker =
                turnTransitionOverlay.querySelector(
                    ".turn-transition-kicker"
                );

            const count =
                turnTransitionOverlay.querySelector(
                    ".turn-transition-count"
                );

            const copy =
                turnTransitionOverlay.querySelector(
                    ".turn-transition-copy"
                );

            const gameSlot =
                turnTransitionOverlay.querySelector(
                    ".turn-transition-game-slot"
                );

            if (kicker) {
                kicker.textContent =
                    data.play_mode === "solo"
                        ? "THE STORY TURNS // SOLO INTERMISSION"
                        : "THE STORY TURNS // INTERMISSION";
            }

            if (count) {
                count.hidden = true;
            }

            if (copy) {
                copy.textContent =
                    "THE DIRECTOR IS WORKING BEHIND THE CURTAIN_";
            }

            if (gameSlot) {
                gameSlot.hidden = false;
            }

            turnTransitionOverlay.classList.remove(
                "is-blackout"
            );

            turnTransitionOverlay.classList.add(
                "is-game"
            );
        },
        360,
    );


    configureIntermission();


    const api =
        intermissionApi();


    if (
        api?.configured
    ) {

        api.start(
            data
        );

    } else {

        pendingIntermissionPayload =
            data;
    }
}


function stopIntermission(
    reason =
        "story_ready",

    graceSeconds =
        0,
) {

    if (
        reason === "story_ready"
        && graceSeconds > 0
        && lockCountdownTimer
        && !turnTransitionOverlay.classList.contains(
            "is-game"
        )
        && !turnTransitionOverlay.classList.contains(
            "is-story-ready"
        )
    ) {
        queuedStoryReadySeconds =
            graceSeconds;
        storyAdvancing = true;
        return;
    }

    const api =
        intermissionApi();


    if (
        storyReadyGraceTimer
    ) {

        window.clearTimeout(
            storyReadyGraceTimer
        );

        storyReadyGraceTimer =
            null;
    }


    if (
        api?.configured
    ) {

        api.stop(
            reason,
            graceSeconds,
        );
    }


    if (
        reason === "story_ready"
        && graceSeconds > 0
    ) {

        storyAdvancing =
            true;

        showStoryReadyCountdown(
            graceSeconds
        );


        turnFlowPhase.textContent =
            (
                "STORY READY // "
                + `TRANSITIONING IN ${graceSeconds.toFixed(0)}s_`
            );


        storyReadyGraceTimer =
            window.setTimeout(
                () => {

                    storyAdvancing =
                        false;

                    storyReadyGraceTimer =
                        null;


                    if (
                        latestTurnFlowState
                    ) {

                        renderTurnFlow(
                            latestTurnFlowState
                        );

                        renderPendingMicroEvent(
                            latestTurnFlowState
                        );
                    }
                },
                graceSeconds
                * 1000,
            );


        return;
    }


    storyAdvancing =
        false;
}


/* =========================================================
   MY ADVENTURES
========================================================= */

const myAdventuresSection =
    document.createElement(
        "section"
    );


myAdventuresSection.className =
    (
        "my-adventures-section "
        + "dashboard-section "
        + "active-stories-section"
    );


const myAdventuresHeading =
    document.createElement(
        "div"
    );


myAdventuresHeading.className =
    "section-title";


myAdventuresHeading.textContent =
    "> CONTINUE YOUR STORY_";


const myAdventuresList =
    document.createElement(
        "div"
    );


myAdventuresList.className =
    "my-adventures-list";


myAdventuresSection.append(
    myAdventuresHeading,
    myAdventuresList,
);


const myAdventuresMount =
    document.getElementById(
        "my-adventures-mount"
    );


if (
    myAdventuresMount
) {

    myAdventuresMount.appendChild(
        myAdventuresSection
    );

} else if (
    adventureLobbyPanel
) {

    adventureLobbyPanel.prepend(
        myAdventuresSection
    );
}


/* =========================================================
   ADVENTURE PICKER
========================================================= */

const adventurePickerSection =
    document.createElement(
        "section"
    );


adventurePickerSection.className =
    (
        "my-adventures-section "
        + "dashboard-section "
        + "available-stories-section"
    );


const adventurePickerHeading =
    document.createElement(
        "div"
    );


adventurePickerHeading.className =
    "section-title";


adventurePickerHeading.textContent =
    "> AVAILABLE ADVENTURES_";


const adventurePickerList =
    document.createElement(
        "div"
    );


adventurePickerList.className =
    "my-adventures-list";


adventurePickerSection.append(
    adventurePickerHeading,
    adventurePickerList,
);


const adventurePickerMount =
    document.getElementById(
        "adventure-picker-mount"
    );


if (
    adventurePickerMount
) {

    adventurePickerMount.appendChild(
        adventurePickerSection
    );

} else if (
    myAdventuresSection.parentNode
) {

    myAdventuresSection.insertAdjacentElement(
        "afterend",
        adventurePickerSection
    );
}


function cleanAdventureMetaValue(
    value,
) {

    const text =
        String(
            value
            ?? ""
        )
        .trim();


    if (
        !text
        || text.toLowerCase() === "none"
        || text.toLowerCase() === "null"
    ) {

        return "";
    }


    return text;
}


function adventureDisplayMeta(
    definition,
) {

    const metadata =
        (
            definition.metadata
            && typeof definition.metadata === "object"
        )
            ? definition.metadata
            : {};


    const generated =
        metadata.generated === true;


    const items =
        [];


    const primaryType =
        cleanAdventureMetaValue(
            metadata.primary_type
        );


    const secondaryType =
        cleanAdventureMetaValue(
            metadata.secondary_type
        );


    const tone =
        cleanAdventureMetaValue(
            metadata.tone
        );


    const targetLength =
        cleanAdventureMetaValue(
            metadata.target_length
        );


    const difficulty =
        cleanAdventureMetaValue(
            metadata.difficulty
        );


    if (primaryType) {

        items.push(
            primaryType.toUpperCase()
        );
    }


    if (
        secondaryType
        && secondaryType.toLowerCase()
            !== primaryType.toLowerCase()
    ) {

        items.push(
            secondaryType.toUpperCase()
        );
    }


    if (tone) {

        items.push(
            tone.toUpperCase()
        );
    }


    if (targetLength) {

        items.push(
            `${targetLength.toUpperCase()} LENGTH`
        );
    }


    if (difficulty) {

        items.push(
            `${difficulty.toUpperCase()} DIFFICULTY`
        );
    }


    return {
        generated,
        items,
        worldTitle:
            cleanAdventureMetaValue(
                metadata.world_title
            ),

        briefTitle:
            cleanAdventureMetaValue(
                metadata.brief_title
            ),

        worldVersion:
            metadata.world_version_number
            ?? null,

        briefVersion:
            metadata.brief_version_number
            ?? null,
    };
}


function buildAdventureSourceLabel(
    displayMeta,
) {

    if (!displayMeta.generated) {

        return "";
    }


    const parts =
        [];


    if (displayMeta.worldTitle) {

        parts.push(
            displayMeta.worldVersion
                ? `${displayMeta.worldTitle} v${displayMeta.worldVersion}`
                : displayMeta.worldTitle
        );

    } else if (displayMeta.worldVersion) {

        parts.push(
            `WORLD v${displayMeta.worldVersion}`
        );
    }


    if (displayMeta.briefTitle) {

        parts.push(
            displayMeta.briefVersion
                ? `${displayMeta.briefTitle} v${displayMeta.briefVersion}`
                : displayMeta.briefTitle
        );

    } else if (displayMeta.briefVersion) {

        parts.push(
            `BRIEF v${displayMeta.briefVersion}`
        );
    }


    return parts.join(
        " // "
    );
}


const synopsisBackdrop =
    document.createElement(
        "div"
    );


synopsisBackdrop.className =
    "synopsis-backdrop";


synopsisBackdrop.hidden =
    true;


synopsisBackdrop.innerHTML =
    `
    <section class="synopsis-modal" role="dialog" aria-modal="true">
        <button class="synopsis-close" type="button" aria-label="Close">×</button>

        <div class="synopsis-layout">
            <pre class="synopsis-ascii" data-crt-glitch>
          /\                 /\
         /  \      /\       /  \
        / /\ \    /  \     / /\ \
       / /  \ \__/ /\ \___/ /  \ \
      /_/    \____/  \_____/    \_\
           _     _     _
         _/ \___/ \___/ \_
        /               __\
       /____     _______/
            \___/
            </pre>

            <div class="synopsis-copy">
                <div class="synopsis-heading-row">
                    <div class="eyebrow">ADVENTURE SYNOPSIS</div>
                    <div class="synopsis-generated-badge" hidden>
                        GENERATED
                    </div>
                </div>

                <h2 class="synopsis-title"></h2>

                <div class="synopsis-tags"></div>

                <div
                    class="synopsis-source"
                    hidden
                ></div>

                <p class="synopsis-description"></p>

                <div class="synopsis-hero">
                    HERO
                    <strong class="synopsis-hero-name">NONE</strong>
                </div>

                <div class="synopsis-actions">
                    <button class="terminal-button synopsis-cancel" type="button">
                        BACK
                    </button>

                    <button class="terminal-button primary synopsis-begin" type="button">
                        BEGIN ADVENTURE
                    </button>
                </div>
            </div>
        </div>
    </section>
    `;


document.body.appendChild(
    synopsisBackdrop
);


const synopsisTitle =
    synopsisBackdrop.querySelector(
        ".synopsis-title"
    );


const synopsisTags =
    synopsisBackdrop.querySelector(
        ".synopsis-tags"
    );


const synopsisDescription =
    synopsisBackdrop.querySelector(
        ".synopsis-description"
    );


const synopsisGeneratedBadge =
    synopsisBackdrop.querySelector(
        ".synopsis-generated-badge"
    );


const synopsisSource =
    synopsisBackdrop.querySelector(
        ".synopsis-source"
    );


const synopsisHeroName =
    synopsisBackdrop.querySelector(
        ".synopsis-hero-name"
    );


const synopsisBeginButton =
    synopsisBackdrop.querySelector(
        ".synopsis-begin"
    );


function closeSynopsis() {

    synopsisBackdrop.hidden =
        true;

    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   ADVENTURE ENTRY / RESUME RECAP
========================================================= */

const adventureEntryBackdrop =
    document.createElement(
        "section"
    );

adventureEntryBackdrop.className =
    "adventure-entry-backdrop";

adventureEntryBackdrop.hidden =
    true;

adventureEntryBackdrop.innerHTML =
    `
    <div
        class="adventure-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adventure-entry-title"
    >
        <div class="adventure-entry-kicker"></div>

        <h2
            id="adventure-entry-title"
            class="adventure-entry-title"
        ></h2>

        <div class="adventure-entry-meta"></div>

        <div class="adventure-entry-recap"></div>

        <button
            type="button"
            class="terminal-button primary adventure-entry-continue"
        >
            CONTINUE
        </button>
    </div>
    `;


document.body.appendChild(
    adventureEntryBackdrop
);


const adventureEntryKicker =
    adventureEntryBackdrop.querySelector(
        ".adventure-entry-kicker"
    );

const adventureEntryTitle =
    adventureEntryBackdrop.querySelector(
        ".adventure-entry-title"
    );

const adventureEntryMeta =
    adventureEntryBackdrop.querySelector(
        ".adventure-entry-meta"
    );

const adventureEntryRecap =
    adventureEntryBackdrop.querySelector(
        ".adventure-entry-recap"
    );

const adventureEntryContinue =
    adventureEntryBackdrop.querySelector(
        ".adventure-entry-continue"
    );


function closeAdventureEntry() {

    /*
       The recap sits over an already-restored authoritative game_state.
       Ensure the actual workspace is visible before revealing it.
    */

    if (
        currentRoomCode
    ) {

        showAdventureWorkspace({
            resetScroll: true,
        });
    }


    adventureEntryBackdrop.hidden =
        true;


    document.body.classList.remove(
        "adventure-entry-open"
    );


    pendingAdventureEntryMode =
        null;

    pendingAdventureEntryAdventure =
        null;


    /*
       Fresh-room creation and resume now converge on one authoritative
       state sync after the entry modal closes. This prevents a first-turn
       race where the opening scene was visible before the latest solo /
       readiness state had reached the choice controls.
    */
    if (
        currentRoomCode
        && socket.connected
    ) {

        socket.emit(
            "sync_adventure_state",
            {
                room_code:
                    currentRoomCode,
            }
        );
    }


    choiceListElement
    ?.querySelector(
        ".choice-button"
    )
    ?.focus();
}


adventureEntryContinue.addEventListener(
    "click",
    closeAdventureEntry
);


function showAdventureEntry(
    state,
    mode,
) {

    if (
        !state
        || !state.room_code
    ) {

        return;
    }


    const title =
        String(
            state.adventure_title
            ?? pendingAdventureEntryAdventure
                ?.adventure_title
            ?? "ADVENTURE"
        ).trim()
        || "ADVENTURE";


    const turnNumber =
        Number(
            state.turn_number
            ?? 1
        );


    const sceneTitle =
        String(
            state.scene?.title
            ?? "CURRENT SCENE"
        ).trim()
        || "CURRENT SCENE";


    const isResume =
        mode === "resume"
        || turnNumber > 1;


    adventureEntryKicker.textContent =
        isResume
            ? "PREVIOUSLY ON TALES OF TWO"
            : "NEW ADVENTURE";


    adventureEntryTitle.textContent =
        title.toUpperCase();


    adventureEntryMeta.textContent =
        isResume
            ? (
                `TURN ${String(
                    turnNumber
                ).padStart(
                    3,
                    "0"
                )}`
                + ` // ${sceneTitle.toUpperCase()}`
            )
            : sceneTitle.toUpperCase();


    const recap =
        String(
            state.last_resolution
            ?? ""
        ).trim();


    if (
        isResume
    ) {

        adventureEntryRecap.textContent =
            recap
                ? recap
                : (
                    "Your story is waiting at the exact point "
                    + "where you left it."
                );


        adventureEntryContinue.textContent =
            (
                "CONTINUE TURN "
                + String(
                    turnNumber
                ).padStart(
                    3,
                    "0"
                )
            );

    } else {

        adventureEntryRecap.textContent =
            (
                "The opening scene is ready. "
                + "Both players can enter together when you're ready."
            );


        adventureEntryContinue.textContent =
            "LET'S GO";
    }


    adventureEntryBackdrop.hidden =
        false;


    document.body.classList.add(
        "adventure-entry-open"
    );


    adventureEntryShownForRoom =
        state.room_code;


    window.setTimeout(
        () => {

            adventureEntryContinue.focus();
        },
        0
    );
}


function maybeShowAdventureEntry(
    state,
) {

    if (
        !state
        || state.room_code
            !== currentRoomCode
    ) {

        return;
    }


    if (
        !pendingAdventureEntryMode
    ) {

        return;
    }


    /*
       The regular game_state has already rendered underneath this modal.
       That means CONTINUE reveals the exact authoritative current turn,
       rather than rebuilding or guessing the adventure state client-side.
    */

    showAdventureEntry(
        state,
        pendingAdventureEntryMode,
    );
}


/* =========================================================
   HEADER / CHAT GEOMETRY
========================================================= */

function syncGameHeaderHeight() {

    const header =
        document.querySelector(
            ".game-header"
        );


    const height =
        header
            ?.getBoundingClientRect()
            .height
        ?? 0;


    document.documentElement
    .style.setProperty(
        "--game-header-height",
        `${Math.ceil(
            height
        )}px`
    );


    /*
       Size chat to the viewport space actually available when it first
       appears below the header. Sticky itself uses top:10px after scrolling.
    */

    window.requestAnimationFrame(
        () => {

            const chatTop =
                adventureChatPanel
                ?.getBoundingClientRect()
                .top;


            if (
                Number.isFinite(
                    chatTop
                )
            ) {

                document.documentElement
                .style.setProperty(
                    "--chat-initial-top",
                    `${Math.max(
                        10,
                        Math.ceil(
                            chatTop
                        )
                    )}px`
                );
            }
        }
    );
}


syncGameHeaderHeight();


window.addEventListener(
    "resize",
    syncGameHeaderHeight
);


if (
    "ResizeObserver"
    in window
) {

    const header =
        document.querySelector(
            ".game-header"
        );


    if (
        header
    ) {

        new ResizeObserver(
            syncGameHeaderHeight
        )
        .observe(
            header
        );
    }
}


function openAdventureSynopsis(
    definition,
) {

    /*
       Keep this modal deliberately defensive. The adventure picker should
       never open an empty BEGIN ADVENTURE window because one optional piece
       of generated metadata is malformed or absent.
    */

    const resolvedDefinition =
        (
            definition
            && typeof definition
                === "object"
        )
            ? definition
            : null;


    if (
        !resolvedDefinition
    ) {

        return;
    }


    selectedAdventureId =
        String(
            resolvedDefinition.adventure_id
            ?? ""
        );


    const title =
        String(
            resolvedDefinition.title
            ?? "UNTITLED ADVENTURE"
        ).trim()
        || "UNTITLED ADVENTURE";


    const description =
        String(
            resolvedDefinition.description
            ?? ""
        ).trim()
        || "A new story waits.";


    synopsisTitle.textContent =
        title;


    synopsisDescription.textContent =
        description;


    const tags =
        Array.isArray(
            resolvedDefinition.tags
        )
            ? resolvedDefinition.tags
            : [];


    let displayMeta = {
        generated:
            false,

        items:
            [],

        worldTitle:
            "",

        worldVersion:
            "",

        briefTitle:
            "",

        briefVersion:
            "",
    };


    try {

        displayMeta =
            adventureDisplayMeta(
                resolvedDefinition
            );

    } catch (
        error
    ) {

        console.warn(
            "[SYNOPSIS] Optional adventure metadata could not be rendered.",
            error
        );
    }


    const synopsisMeta =
        [
            ...(
                Array.isArray(
                    displayMeta.items
                )
                    ? displayMeta.items
                    : []
            ),

            ...tags.map(
                tag =>
                    String(
                        tag
                    )
                    .trim()
                    .toUpperCase()
            )
            .filter(
                Boolean
            ),
        ];


    synopsisTags.textContent =
        synopsisMeta.length
            ? Array.from(
                new Set(
                    synopsisMeta
                )
            )
            .join(
                "  //  "
            )
            : "TWO PLAYER ADVENTURE";


    synopsisGeneratedBadge.hidden =
        !Boolean(
            displayMeta.generated
        );


    let sourceLabel =
        "";


    try {

        sourceLabel =
            buildAdventureSourceLabel(
                displayMeta
            )
            || "";

    } catch (
        error
    ) {

        console.warn(
            "[SYNOPSIS] Optional source label could not be rendered.",
            error
        );
    }


    synopsisSource.hidden =
        !sourceLabel;


    synopsisSource.textContent =
        sourceLabel
            ? `SOURCE // ${sourceLabel}`
            : "";


    const hero =
        (
            typeof selectedCharacter
            !== "undefined"
        )
            ? selectedCharacter
            : null;


    synopsisHeroName.textContent =
        hero
            ? (
                `${String(
                    hero.name
                    ?? "HERO"
                ).toUpperCase()}`
                + ` // LVL ${hero.level ?? 1}`
            )
            : "SELECT A HERO FIRST";


    let heroAlreadyInAdventure =
        false;


    try {

        heroAlreadyInAdventure =
            Boolean(
                selectedCharacterAdventure()
            );

    } catch (
        error
    ) {

        console.warn(
            "[SYNOPSIS] Could not inspect current hero adventure state.",
            error
        );
    }


    synopsisBeginButton.disabled =
        (
            !hero
            || heroAlreadyInAdventure
        );


    synopsisBeginButton.onclick =
        () => {

            if (
                synopsisBeginButton.disabled
            ) {

                return;
            }


            closeSynopsis();


            if (
                createRoomButton
            ) {

                createRoomButton.click();
            }
        };


    /*
       Show only after all required content is populated.
    */

    synopsisBackdrop.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );


    /*
       Re-render the picker after opening so selection styling can update
       without affecting the modal contents we just populated.
    */

    renderAdventurePicker();


    window.setTimeout(
        () => {

            synopsisBeginButton.focus();

        },
        0
    );
}


synopsisBackdrop.querySelector(
    ".synopsis-close"
)
.addEventListener(
    "click",
    closeSynopsis
);


synopsisBackdrop.querySelector(
    ".synopsis-cancel"
)
.addEventListener(
    "click",
    closeSynopsis
);


synopsisBackdrop.addEventListener(
    "click",
    event => {

        if (
            event.target
            === synopsisBackdrop
        ) {

            closeSynopsis();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            !synopsisBackdrop.hidden
            && event.key === "Escape"
        ) {

            closeSynopsis();
        }
    }
);


function renderAdventurePicker() {

    adventurePickerList.replaceChildren();


    if (
        adventureCatalog.length
        === 0
    ) {

        adventurePickerSection.hidden =
            true;

        return;
    }


    adventurePickerSection.hidden =
        false;


    for (
        const definition
        of adventureCatalog
    ) {

        const card =
            document.createElement(
                "article"
            );


        card.className =
            (
                "adventure-card "
                + "catalog-adventure-card"
            );


        const main =
            document.createElement(
                "div"
            );


        main.className =
            "adventure-card-main";


        const title =
            document.createElement(
                "div"
            );


        title.className =
            "adventure-card-title";


        title.textContent =
            definition.title;


        const displayMeta =
            adventureDisplayMeta(
                definition
            );


        const titleRow =
            document.createElement(
                "div"
            );


        titleRow.className =
            "adventure-card-title-row";


        titleRow.appendChild(
            title
        );


        if (
            displayMeta.generated
        ) {

            card.classList.add(
                "is-generated"
            );


            const generatedBadge =
                document.createElement(
                    "span"
                );


            generatedBadge.className =
                "adventure-generated-badge";


            generatedBadge.textContent =
                "GENERATED";


            titleRow.appendChild(
                generatedBadge
            );
        }


        const description =
            document.createElement(
                "div"
            );


        description.className =
            "adventure-card-description";


        description.textContent =
            definition.description;


        const chips =
            document.createElement(
                "div"
            );


        chips.className =
            "adventure-card-chips";


        const tagItems =
            Array.isArray(
                definition.tags
            )
                ? definition.tags
                    .map(
                        tag =>
                            String(tag)
                            .toUpperCase()
                    )
                : [];


        const chipItems =
            Array.from(
                new Set(
                    [
                        ...displayMeta.items,
                        ...tagItems,
                    ]
                )
            )
            .slice(
                0,
                6
            );


        for (
            const item
            of chipItems
        ) {

            const chip =
                document.createElement(
                    "span"
                );


            chip.className =
                "adventure-meta-chip";


            chip.textContent =
                item;


            chips.appendChild(
                chip
            );
        }


        const sourceLabel =
            buildAdventureSourceLabel(
                displayMeta
            );


        const source =
            document.createElement(
                "div"
            );


        source.className =
            "adventure-card-source";


        source.hidden =
            !sourceLabel;


        source.textContent =
            sourceLabel
                ? `SOURCE // ${sourceLabel}`
                : "";


        main.append(
            titleRow,
            description,
            chips,
            source,
        );


        const actions =
            document.createElement(
                "div"
            );


        actions.className =
            "adventure-card-actions";


        const selectButton =
            document.createElement(
                "button"
            );


        selectButton.type =
            "button";


        selectButton.className =
            (
                definition.adventure_id
                === selectedAdventureId
            )
                ? "terminal-button primary"
                : "terminal-button info";


        selectButton.textContent =
            "VIEW";


        selectButton.disabled =
            Boolean(
                selectedCharacterAdventure()
            );


        selectButton.addEventListener(
            "click",
            () => {

                openAdventureSynopsis(
                    definition
                );
            }
        );


        card.tabIndex =
            0;


        card.setAttribute(
            "role",
            "button"
        );


        card.addEventListener(
            "dblclick",
            () => {

                openAdventureSynopsis(
                    definition
                );
            }
        );


        card.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                    || event.key === " "
                ) {

                    event.preventDefault();

                    openAdventureSynopsis(
                        definition
                    );
                }
            }
        );


        actions.appendChild(
            selectButton
        );


        card.append(
            main,
            actions,
        );


        adventurePickerList.appendChild(
            card
        );
    }
}


/* =========================================================
   LOBBY BLOCKER
========================================================= */

const adventureBlockerMessage =
    document.createElement(
        "div"
    );


adventureBlockerMessage.className =
    "adventure-blocker-message";


adventureBlockerMessage.hidden =
    true;


if (
    createRoomButton
    && createRoomButton.parentNode
) {

    createRoomButton.parentNode.insertBefore(
        adventureBlockerMessage,
        createRoomButton.nextSibling
    );
}


/* =========================================================
   LIVE HERO HUD
========================================================= */

let lastHeroXpGain = 0;
let lastHeroStatusNotice = "";

const heroHud = document.createElement("section");
heroHud.className = "live-hero-hud";
heroHud.hidden = true;

let pendingLevelUpCelebration = null;
let levelUpAutoCloseTimer = null;
let pendingEffectCelebrations = [];
let effectCelebrationTimer = null;

const effectAcquiredOverlay = document.createElement("div");
effectAcquiredOverlay.className = "hero-effect-acquired-overlay";
effectAcquiredOverlay.hidden = true;
effectAcquiredOverlay.setAttribute("role", "status");
effectAcquiredOverlay.setAttribute("aria-live", "polite");
document.body.appendChild(effectAcquiredOverlay);

const levelUpOverlay = document.createElement("div");
levelUpOverlay.className = "hero-level-up-overlay";
levelUpOverlay.hidden = true;
levelUpOverlay.setAttribute("role", "dialog");
levelUpOverlay.setAttribute("aria-modal", "true");
levelUpOverlay.setAttribute("aria-label", "Hero level up");
document.body.appendChild(levelUpOverlay);

let pendingFinalePayload = null;
let finaleReturnPending = false;
let finaleCountdownTimer = null;

const journeyEndPanel = document.createElement("section");
journeyEndPanel.className = "journey-end-panel";
journeyEndPanel.hidden = true;
journeyEndPanel.innerHTML = `
    <div class="journey-end-line">*** THE LAST WORD HAS BEEN SPOKEN ***</div>
    <div class="journey-end-copy">The road behind you is now legend. When you are ready, seal this tale and behold the chronicle of your journey.</div>
    <button type="button" class="terminal-button primary journey-end-button">END THE JOURNEY</button>
`;

const finaleOverlay = document.createElement("div");
finaleOverlay.className = "journey-finale-overlay";
finaleOverlay.hidden = true;
finaleOverlay.setAttribute("role", "dialog");
finaleOverlay.setAttribute("aria-modal", "true");
finaleOverlay.setAttribute("aria-label", "Adventure finale");
document.body.appendChild(finaleOverlay);

function finaleAsciiNumber(value) {
    const glyphs = {
        3: ["██████", "     █", " █████", "     █", "██████"],
        2: ["██████", "     █", "██████", "█     ", "██████"],
        1: ["  ██  ", " ███  ", "  ██  ", "  ██  ", "██████"],
    };
    return (glyphs[value] ?? [String(value)]).join("\n");
}

function finaleAdvancementMarkup(hero) {
    const selectedId = String(selectedCharacter?.character_id ?? "");
    if (!hero || String(hero.character_id ?? "") !== selectedId || hero.is_alive === false) return "";

    const statPoints = Math.max(0, Number(hero.unspent_stat_points ?? 0));
    const skillPoints = Math.max(0, Number(hero.unspent_skill_points ?? 0));
    const earnedStats = Math.max(0, Number(hero.advancement_stat_points_earned ?? 0));
    const earnedSkills = Math.max(0, Number(hero.advancement_skill_points_earned ?? 0));
    if (!statPoints && !skillPoints && !earnedStats && !earnedSkills) return "";

    const statCap = Math.max(1, Number(hero.advancement_stat_cap ?? 6));
    const skillCap = Math.max(1, Number(hero.advancement_skill_cap ?? 5));
    const statOptions = Object.entries(hero.stats ?? {})
        .filter(([, value]) => Number(value) < statCap)
        .map(([key, value]) => `<option value="${escapeSheetText(key)}">${escapeSheetText(key.toUpperCase())} ${Number(value)} → ${Number(value) + 1}</option>`)
        .join("");
    const skillOptions = Object.entries(hero.skills ?? {})
        .filter(([, value]) => Number(value) < skillCap)
        .map(([key, value]) => `<option value="${escapeSheetText(key)}">${escapeSheetText(key.toUpperCase())} ${Number(value)} → ${Number(value) + 1}</option>`)
        .join("");

    return `
        <section class="journey-advancement" data-character-id="${escapeSheetText(hero.character_id ?? "")}">
            <div class="journey-advancement-kicker">*** HERO ASCENDANCY ***</div>
            <div class="journey-advancement-copy">THE ROAD HAS TEMPERED YOU. SHAPE WHAT YOU HAVE BECOME_</div>
            <div class="journey-advancement-earned">THIS JOURNEY // +${earnedStats} STAT POINT${earnedStats === 1 ? "" : "S"} // +${earnedSkills} SKILL POINT${earnedSkills === 1 ? "" : "S"}</div>
            ${statPoints > 0 ? `
                <div class="journey-advancement-row">
                    <label>STAT POINTS // ${statPoints}</label>
                    <select class="journey-advance-stat" ${statOptions ? "" : "disabled"}>${statOptions || `<option>ALL STATS AT CAP</option>`}</select>
                    <button type="button" class="terminal-button journey-advance-stat-button" ${statOptions ? "" : "disabled"}>RAISE STAT</button>
                </div>` : ``}
            ${skillPoints > 0 ? `
                <div class="journey-advancement-row">
                    <label>SKILL POINTS // ${skillPoints}</label>
                    <select class="journey-advance-skill" ${skillOptions ? "" : "disabled"}>${skillOptions || `<option>ALL SKILLS AT CAP</option>`}</select>
                    <button type="button" class="terminal-button journey-advance-skill-button" ${skillOptions ? "" : "disabled"}>RAISE SKILL</button>
                </div>` : ``}
            <div class="journey-advancement-status" aria-live="polite"></div>
        </section>
    `;
}

function bindFinaleAdvancement(finale) {
    const panel = finaleOverlay.querySelector(".journey-advancement");
    if (!panel) return;
    const characterId = panel.dataset.characterId;
    const status = panel.querySelector(".journey-advancement-status");

    const spend = async (kind) => {
        const select = panel.querySelector(kind === "stat" ? ".journey-advance-stat" : ".journey-advance-skill");
        const key = select?.value;
        if (!characterId || !key) return;
        panel.querySelectorAll("button, select").forEach(node => { node.disabled = true; });
        if (status) status.textContent = "THE CHRONICLE ACCEPTS YOUR CHOICE...";
        try {
            const body = kind === "stat" ? { stats: { [key]: 1 }, skills: {} } : { stats: {}, skills: { [key]: 1 } };
            const updated = await apiRequest(`/api/characters/${characterId}/advance`, {
                method: "POST",
                body: JSON.stringify(body),
            });
            if (selectedCharacter && String(selectedCharacter.character_id) === String(characterId)) {
                Object.assign(selectedCharacter, updated);
            }
            const hero = (finale.heroes ?? []).find(item => String(item.character_id) === String(characterId));
            if (hero) {
                hero.unspent_stat_points = Number(updated.unspent_stat_points ?? 0);
                hero.unspent_skill_points = Number(updated.unspent_skill_points ?? 0);
                hero.stats = { ...(updated.stats ?? hero.stats ?? {}) };
                hero.skills = { ...(updated.skills ?? hero.skills ?? {}) };
            }
            renderJourneyFinale(finale);
        } catch (error) {
            panel.querySelectorAll("button, select").forEach(node => { node.disabled = false; });
            if (status) status.textContent = `THE RITUAL FALTERS // ${String(error?.message ?? error)}`;
        }
    };

    panel.querySelector(".journey-advance-stat-button")?.addEventListener("click", () => spend("stat"));
    panel.querySelector(".journey-advance-skill-button")?.addEventListener("click", () => spend("skill"));
}

function renderJourneyFinale(payload) {
    const finale = payload ?? {};
    const heroes = Array.isArray(finale.heroes) ? finale.heroes : [];
    const heroCards = heroes.map(hero => {
        const levelUps = Array.isArray(hero.level_ups) ? hero.level_ups : [];
        const death = hero?.death_record && typeof hero.death_record === "object" ? hero.death_record : null;
        const lifeState = hero?.is_alive === false ? "FALLEN" : "SURVIVED";
        const deathLine = death
            ? `<div class="journey-finale-fate fallen">FALLEN // TURN ${Number(death.turn_number ?? 0)} // ${escapeSheetText(death.cause ?? "THE ROAD CLAIMED THIS HERO")}</div>`
            : `<div class="journey-finale-fate survived">SURVIVED // ${Number(hero.health ?? 0)}/${Number(hero.max_health ?? 0)} HP</div>`;
        const timeline = [
            `<span>START // LVL ${Number(hero.starting_level ?? 1)}</span>`,
            ...levelUps.map(item => `<span>TURN ${Number(item.turn ?? 0)} // LVL ${Number(item.from_level ?? 1)} &gt; ${Number(item.to_level ?? 1)}</span>`),
            `<span>${lifeState} // LVL ${Number(hero.ending_level ?? hero.starting_level ?? 1)}</span>`,
        ].join("");
        return `
            <article class="journey-finale-hero">
                <div class="journey-finale-hero-head">
                    <strong>${escapeSheetText(hero.character_name ?? "HERO").toUpperCase()}</strong>
                    <span class="journey-rank">RANK ${escapeSheetText(hero.rank ?? "-")}</span>
                </div>
                <div class="journey-finale-progression">LVL ${Number(hero.starting_level ?? 1)} &gt;&gt;&gt; LVL ${Number(hero.ending_level ?? 1)} // +${Number(hero.xp_earned ?? 0)} XP</div>
                ${deathLine}
                <div class="journey-finale-stats">
                    <span>CHECKS ${Number(hero.checks_total ?? 0)}</span>
                    <span>SUCCESS ${Number(hero.success_rate ?? 0)}%</span>
                    <span>CRIT+ ${Number(hero.critical_successes ?? 0)}</span>
                    <span>CRIT- ${Number(hero.critical_failures ?? 0)}</span>
                </div>
                <div class="journey-finale-timeline">${timeline}</div>
            </article>
        `;
    }).join("");

    finaleOverlay.innerHTML = `
        <section class="journey-finale-card">
            <div class="journey-finale-kicker">*** THE CHRONICLE IS COMPLETE ***</div>
            <h2>${escapeSheetText(finale.adventure_title ?? "A TALE NOW TOLD")}</h2>
            <div class="journey-finale-ending">${escapeSheetText(finale.ending_label ?? "AND SO THE ROAD ENDS")}</div>
            <div class="journey-finale-party-rank">PARTY RENOWN // ${escapeSheetText(finale.party_rank ?? "-")}</div>
            <div class="journey-finale-meta">${Number(finale.turn_count ?? 0)} TURNS SURVIVED // ${escapeSheetText(String(finale.play_mode ?? "coop").toUpperCase())}</div>
            <div class="journey-finale-resolution">${escapeSheetText(finale.final_resolution ?? "")}</div>
            <div class="journey-finale-heroes">${heroCards}</div>
            ${finaleAdvancementMarkup(heroes.find(hero => String(hero.character_id ?? "") === String(selectedCharacter?.character_id ?? "")))}
            <button type="button" class="terminal-button primary journey-return-button">RETURN TO THE HALL OF ADVENTURES</button>
        </section>
    `;

    bindFinaleAdvancement(finale);

    finaleOverlay.querySelector(".journey-return-button")?.addEventListener("click", event => {
        const button = event.currentTarget;
        if (finaleReturnPending) return;

        const roomCode = String(finale.room_code ?? activeAdventure?.room_code ?? "").trim();
        const characterId = String(
            selectedCharacter?.character_id
            ?? activeAdventure?.character_id
            ?? ""
        ).trim();

        finaleReturnPending = true;
        if (button) {
            button.disabled = true;
            button.textContent = "CLOSING THE CHRONICLE...";
        }

        if (roomCode && characterId) {
            socket.emit("leave_adventure", {
                room_code: roomCode,
                character_id: characterId,
            });
            return;
        }

        // Defensive fallback for legacy finale payloads without room identity.
        finaleReturnPending = false;
        finaleOverlay.classList.add("is-closing");
        window.setTimeout(() => {
            finaleOverlay.hidden = true;
            finaleOverlay.classList.remove("is-visible", "is-closing");
            journeyEndPanel.hidden = true;
            pendingFinalePayload = null;
            exitToLobby();
            if (typeof loadCharacters === "function") {
                loadCharacters().catch(error => console.error("[CHARACTER REFRESH]", error));
            }
        }, 320);
    }, { once: true });
}

function beginJourneyFinale() {
    if (!pendingFinalePayload || finaleCountdownTimer) return;
    finaleOverlay.hidden = false;
    finaleOverlay.classList.add("is-visible");
    let remaining = 3;

    const renderCountdown = () => {
        finaleOverlay.innerHTML = `
            <section class="journey-finale-countdown">
                <div>SEALING THE CHRONICLE_</div>
                <pre>${finaleAsciiNumber(remaining)}</pre>
            </section>
        `;
    };

    renderCountdown();
    finaleCountdownTimer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            window.clearInterval(finaleCountdownTimer);
            finaleCountdownTimer = null;
            renderJourneyFinale(pendingFinalePayload);
            return;
        }
        renderCountdown();
    }, 1000);
}

journeyEndPanel.querySelector(".journey-end-button")?.addEventListener("click", beginJourneyFinale);

function hideLevelUpCelebration() {
    if (levelUpAutoCloseTimer) {
        window.clearTimeout(levelUpAutoCloseTimer);
        levelUpAutoCloseTimer = null;
    }

    levelUpOverlay.classList.add("is-closing");
    window.setTimeout(() => {
        levelUpOverlay.hidden = true;
        levelUpOverlay.classList.remove("is-visible", "is-closing");
        levelUpOverlay.replaceChildren();
    }, 320);
}

function showPendingLevelUpCelebration() {
    if (!pendingLevelUpCelebration) return;

    const payload = pendingLevelUpCelebration;
    pendingLevelUpCelebration = null;

    const before = Math.max(1, Number(payload.level_before ?? 1));
    const after = Math.max(before, Number(payload.level_after ?? payload.level ?? before));
    const gained = Math.max(0, Number(payload.xp_gained ?? 0));
    const needed = Math.max(0, Number(payload.xp_needed_for_next_level ?? 0));

    levelUpOverlay.innerHTML = `
        <section class="hero-level-up-card">
            <div class="hero-level-up-kicker">*** HERO PROGRESSION EVENT ***</div>
            <pre class="hero-level-up-ascii" aria-hidden="true"> _      _______     _______ _      \n| |    | ____\ \   / / ____| |     \n| |    |  _|  \ \ / /|  _| | |     \n| |___ | |___  \ V / | |___| |___  \n|_____||_____|  \_/  |_____|_____| \n              U P</pre>
            <div class="hero-level-up-levels">LVL ${before} <span>&gt;&gt;&gt;</span> LVL ${after}</div>
            <div class="hero-level-up-xp">+${gained} XP // ${needed} XP TO NEXT LEVEL</div>
            <div class="hero-level-up-copy">YOUR HERO HAS GROWN STRONGER_</div>
            <button type="button" class="terminal-button hero-level-up-continue">CONTINUE</button>
        </section>
    `;

    const continueButton = levelUpOverlay.querySelector(".hero-level-up-continue");
    continueButton?.addEventListener("click", hideLevelUpCelebration, { once: true });

    levelUpOverlay.hidden = false;
    window.requestAnimationFrame(() => {
        levelUpOverlay.classList.add("is-visible");
        continueButton?.focus();
    });

    levelUpAutoCloseTimer = window.setTimeout(
        hideLevelUpCelebration,
        6500,
    );
}

window.addEventListener(
    "tot:turn-reveal-ready",
    () => {
        if (!pendingLevelUpCelebration) return;
        window.setTimeout(
            showPendingLevelUpCelebration,
            700,
        );
    },
);

function asciiMeter(percent, width = 18) {
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = Math.round((safe / 100) * width);
    return `[${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}]`;
}

function heroProgressionFallback(character) {
    const level = Math.max(1, Number(character?.level ?? 1));
    const xp = Math.max(0, Number(character?.experience ?? 0));
    const floor = Number(character?.xp_level_floor ?? (50 * (level - 1) * level));
    const next = Number(character?.xp_next_level ?? (50 * level * (level + 1)));
    const span = Math.max(1, next - floor);
    const into = Math.max(0, xp - floor);
    return {
        current: xp,
        next,
        needed: Math.max(0, Number(character?.xp_needed_for_next_level ?? (next - xp))),
        percent: Math.max(0, Math.min(100, Number(character?.xp_progress_percent ?? ((into / span) * 100)))),
        multiplier: Math.max(1, Number(character?.xp_level_multiplier ?? Math.min(1.75, 1 + ((level - 1) * 0.04)))),
    };
}

function compactEffectName(effect) {
    if (!effect || typeof effect !== "object") {
        return "STORY CONSEQUENCE";
    }

    const rawName = String(effect.name ?? effect.label ?? "").trim();
    const description = String(effect.description ?? "").trim();
    const usableName = rawName
        && rawName.length <= 48
        && rawName.split(/\s+/).length <= 7
        && rawName.toLowerCase() !== description.toLowerCase();

    if (usableName) return rawName;

    const statEntry = Object.entries(effect.stat_modifiers ?? {})
        .find(([, value]) => Number(value) !== 0);
    if (statEntry) {
        const [target, value] = statEntry;
        return `${String(target).replaceAll("_", " ")} ${Number(value) > 0 ? "BOON" : "STRAIN"}`;
    }

    const skillEntry = Object.entries(effect.skill_modifiers ?? {})
        .find(([, value]) => Number(value) !== 0);
    if (skillEntry) {
        const [target, value] = skillEntry;
        return `${String(target).replaceAll("_", " ")} ${Number(value) > 0 ? "EDGE" : "HINDRANCE"}`;
    }

    const category = String(effect.category ?? "").trim().toLowerCase();
    if (category === "injury") return "LINGERING INJURY";
    if (category === "blessing") return "LINGERING BLESSING";
    if (category === "curse") return "LINGERING CURSE";
    if (category === "reputation") return "REPUTATION MARK";
    return "STORY CONSEQUENCE";
}

function effectMechanicalMeta(effect) {
    if (!effect || typeof effect !== "object") return "";
    const statEntries = Object.entries(effect.stat_modifiers ?? {}).filter(([, value]) => Number(value) !== 0);
    const skillEntries = Object.entries(effect.skill_modifiers ?? {}).filter(([, value]) => Number(value) !== 0);
    const mechanic = [...statEntries, ...skillEntries][0];
    const mechanicText = mechanic
        ? `${String(mechanic[0]).replaceAll("_", " ").toUpperCase()} ${Number(mechanic[1]) > 0 ? "+" : ""}${Number(mechanic[1])}`
        : "";
    const remainingTurns = effect.remaining_turns;
    const remainingChecks = effect.remaining_checks;
    const permanence = String(effect.permanence ?? "active").toUpperCase();
    const durationText = remainingTurns !== null && remainingTurns !== undefined
        ? `${Math.max(0, Number(remainingTurns) || 0)} TURN${Number(remainingTurns) === 1 ? "" : "S"}`
        : (remainingChecks !== null && remainingChecks !== undefined
            ? `${Math.max(0, Number(remainingChecks) || 0)} CHECK${Number(remainingChecks) === 1 ? "" : "S"}`
            : (mechanicText ? "PERMANENT" : permanence));
    return [mechanicText, durationText].filter(Boolean).join(" // ");
}

function hideEffectAcquiredOverlay() {
    if (effectCelebrationTimer) {
        window.clearTimeout(effectCelebrationTimer);
        effectCelebrationTimer = null;
    }
    effectAcquiredOverlay.classList.remove("show", "boon", "bane");
    window.setTimeout(() => {
        effectAcquiredOverlay.hidden = true;
        if (pendingEffectCelebrations.length > 0) showNextEffectCelebration();
    }, 260);
}

function showNextEffectCelebration() {
    if (!effectAcquiredOverlay.hidden || pendingEffectCelebrations.length === 0) return;
    const effect = pendingEffectCelebrations.shift();
    const modifierEntries = [
        ...Object.entries(effect?.stat_modifiers ?? {}),
        ...Object.entries(effect?.skill_modifiers ?? {}),
    ].filter(([, value]) => Number(value) !== 0);
    const modifier = modifierEntries.length ? Number(modifierEntries[0][1]) : 0;
    const kind = modifier < 0 ? "bane" : "boon";
    const heading = modifier < 0 ? "A BANE TAKES HOLD" : "A BOON IS EARNED";
    const name = compactEffectName(effect).toUpperCase();
    const meta = effectMechanicalMeta(effect);
    effectAcquiredOverlay.classList.add(kind);
    effectAcquiredOverlay.innerHTML = `
        <div class="hero-effect-acquired-card">
            <div class="hero-effect-acquired-kicker">${heading}</div>
            <div class="hero-effect-acquired-name">${escapeSheetText(name)}</div>
            <div class="hero-effect-acquired-meta">${escapeSheetText(meta)}</div>
            ${effect?.description ? `<div class="hero-effect-acquired-desc">${escapeSheetText(effect.description)}</div>` : ``}
        </div>
    `;
    effectAcquiredOverlay.hidden = false;
    requestAnimationFrame(() => effectAcquiredOverlay.classList.add("show"));
    effectCelebrationTimer = window.setTimeout(hideEffectAcquiredOverlay, 3200);
}

function queueEffectCelebrations(effects, { afterLevelUp = false } = {}) {
    const list = Array.isArray(effects) ? effects.filter(Boolean).slice(0, 1) : [];
    if (!list.length) return;
    pendingEffectCelebrations.push(...list);
    const delay = afterLevelUp ? 7600 : 850;
    window.setTimeout(() => {
        if (turnTransitionOverlay.hidden) showNextEffectCelebration();
    }, delay);
}

window.addEventListener("tot:turn-reveal-ready", () => {
    if (pendingEffectCelebrations.length === 0) return;
    const delay = pendingLevelUpCelebration ? 7600 : 850;
    window.setTimeout(showNextEffectCelebration, delay);
});

function activePersistentHeroEffects(character) {
    const effects = Array.isArray(character?.effects) ? character.effects : [];
    return effects.filter(effect => effect && effect.active !== false);
}

function renderLiveHeroHud(character = selectedCharacter) {
    if (!character || !currentRoomCode) {
        heroHud.hidden = true;
        return;
    }

    const hp = Math.max(0, Number(character.health ?? 0));
    const maxHp = Math.max(1, Number(character.max_health ?? 1));
    const hpPercent = (hp / maxHp) * 100;
    const hpCondition = hp <= 0
        ? "fallen"
        : (hpPercent <= 25 ? "critical" : (hpPercent <= 50 ? "wounded" : "steady"));
    const hpConditionLabel = hp <= 0
        ? "FALLEN"
        : (hpPercent <= 25 ? "CRITICAL CONDITION" : (hpPercent <= 50 ? "WOUNDED" : ""));
    const progression = heroProgressionFallback(character);
    const effects = activePersistentHeroEffects(character);
    const nearLevel = progression.needed > 0 && progression.percent >= 80;
    const statFxTotal = (statKey) => Math.max(-4, Math.min(4, effects.reduce((sum, effect) => {
        const value = Number(effect?.stat_modifiers?.[statKey] ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
    }, 0)));
    const coreStats = [
        ["STR", "strength", character?.stats?.strength],
        ["AGI", "agility", character?.stats?.agility],
        ["INT", "intellect", character?.stats?.intellect],
        ["PER", "perception", character?.stats?.perception],
        ["PRE", "presence", character?.stats?.presence],
        ["WIL", "willpower", character?.stats?.willpower],
    ].map(([label, key, value]) => {
        const fx = statFxTotal(key);
        const fxText = fx === 0 ? "" : ` <em class="hero-stat-fx ${fx > 0 ? "positive" : "negative"}">(${fx > 0 ? "+" : ""}${fx} FX)</em>`;
        return `<span><b>${label}</b> ${escapeSheetText(Number(value ?? 0))}${fxText}</span>`;
    }).join("");

    const effectMarkup = effects.length
        ? effects.slice(0, 3).map(effect => {
            const label = escapeSheetText(compactEffectName(effect)).toUpperCase();
            const meta = effectMechanicalMeta(effect);
            return `<span class="hero-hud-effect" title="${escapeSheetText(effect.description ?? label)}">${label}<small>${escapeSheetText(meta)}</small></span>`;
        }).join("")
        : `<span class="hero-hud-effect none">CLEAR // NO ACTIVE EFFECTS</span>`;

    heroHud.innerHTML = `
        <div class="hero-hud-frame-line">╔═ HERO STATUS ═════════════════════════════════════════════════════╗</div>
        <div class="hero-hud-main">
            <div class="hero-hud-identity">
                <strong>${escapeSheetText(character.name ?? "HERO").toUpperCase()}</strong>
                <span>LVL ${escapeSheetText(character.level ?? 1)}</span>
                ${nearLevel ? `<em>LEVEL UP NEAR</em>` : ``}
            </div>
            <div class="hero-hud-meter hero-hud-health ${hpCondition}">
                <span>HP ${hp}/${maxHp}${hpConditionLabel ? ` // ${hpConditionLabel}` : ``}</span>
                <code>${asciiMeter(hpPercent)}</code>
            </div>
            <div class="hero-hud-meter xp">
                <span>XP ${progression.current}/${progression.next}</span>
                <code>${asciiMeter(progression.percent)}</code>
                <small>${progression.needed} XP TO NEXT LEVEL // XP RATE x${progression.multiplier.toFixed(2)}${lastHeroXpGain > 0 ? ` // +${lastHeroXpGain} LAST TURN` : ``}</small>
            </div>
        </div>
        <div class="hero-hud-core">
            <b>CORE&gt;</b>
            <div>${coreStats}</div>
        </div>
        <div class="hero-hud-effects">
            <b>ACTIVE EFFECTS&gt;</b>
            <div>${effectMarkup}${effects.length > 3 ? `<span class="hero-hud-effect more">+${effects.length - 3} MORE</span>` : ``}</div>
        </div>
        ${lastHeroStatusNotice ? `<div class="hero-hud-status-notice">${escapeSheetText(lastHeroStatusNotice)}</div>` : ``}
        <div class="hero-hud-frame-line">╚════════════════════════════════════════════════════════════════════╝</div>
    `;
    heroHud.hidden = false;
}

function applyHeroProgressionPayload(payload) {
    if (!payload || !selectedCharacter) return;
    const local = Object.values(payload).find(item => item?.character_id === selectedCharacter.character_id);
    if (!local) return;

    selectedCharacter = {
        ...selectedCharacter,
        level: local.level ?? selectedCharacter.level,
        experience: local.experience ?? selectedCharacter.experience,
        xp_current: local.xp_current ?? local.experience ?? selectedCharacter.experience,
        xp_level_floor: local.xp_level_floor,
        xp_next_level: local.xp_next_level,
        xp_into_level: local.xp_into_level,
        xp_needed_for_next_level: local.xp_needed_for_next_level,
        xp_level_span: local.xp_level_span,
        xp_progress_percent: local.xp_progress_percent,
        xp_level_multiplier: local.xp_level_multiplier,
        health: local.health ?? selectedCharacter.health,
        max_health: local.max_health ?? selectedCharacter.max_health,
        effects: Array.isArray(local.effects) ? local.effects : (selectedCharacter.effects ?? []),
    };
    lastHeroXpGain = Math.max(0, Number(local.xp_gained ?? 0));

    if (local.leveled_up) {
        pendingLevelUpCelebration = {
            ...local,
        };

        // Reconnect/recovery can deliver progression when no transition modal
        // is active. In that case, do not wait forever for a reveal event.
        window.setTimeout(() => {
            if (
                pendingLevelUpCelebration
                && turnTransitionOverlay.hidden
            ) {
                showPendingLevelUpCelebration();
            }
        }, 1200);
    }

    const healthChange = Number(local.health_change ?? 0);
    const healthEvents = Array.isArray(local.health_events) ? local.health_events : [];
    const newEffects = Array.isArray(local.new_effects) ? local.new_effects : [];
    const expiredEffects = Array.isArray(local.expired_effects) ? local.expired_effects : [];
    if (newEffects.length > 0) {
        queueEffectCelebrations(newEffects, { afterLevelUp: Boolean(local.leveled_up) });
    }
    if (healthChange < 0) {
        const cause = healthEvents[0]?.description ? ` // ${String(healthEvents[0].description).toUpperCase()}` : "";
        lastHeroStatusNotice = `WOUNDED // ${healthChange} HP${cause}`;
    } else if (healthChange > 0) {
        const cause = healthEvents[0]?.description ? ` // ${String(healthEvents[0].description).toUpperCase()}` : "";
        lastHeroStatusNotice = `RECOVERED // +${healthChange} HP${cause}`;
    } else if (newEffects.length > 0) {
        const names = newEffects.map(effect => effect?.name ?? effect?.description ?? "STATUS EFFECT").filter(Boolean);
        lastHeroStatusNotice = `NEW EFFECT // ${names.join(" + ").toUpperCase()}`;
    } else if (expiredEffects.length > 0) {
        const names = expiredEffects.map(effect => effect?.name ?? effect?.description ?? "STATUS EFFECT").filter(Boolean);
        lastHeroStatusNotice = `EFFECT CLEARED // ${names.join(" + ").toUpperCase()}`;
    } else {
        lastHeroStatusNotice = "";
    }

    const index = characters.findIndex(item => item.character_id === selectedCharacter.character_id);
    if (index >= 0) characters[index] = selectedCharacter;
    renderLiveHeroHud(selectedCharacter);
}

if (adventureGamePanel) {
    /*
       Persistent tactical information lives in the right control rail.
       Story content keeps the full left pane.
    */
    if (
        adventureSidebar
        && adventureChatPanel
    ) {
        adventureSidebar.insertBefore(
            heroHud,
            adventureChatPanel,
        );
    } else if (
        adventureSidebar
    ) {
        adventureSidebar.appendChild(
            heroHud
        );
    }

    /*
       Previous-turn dice/check results remain at the top of the story pane.
    */
    if (resolutionPanel) {
        const heading = adventureGamePanel.querySelector(".panel-heading");

        if (heading) {
            heading.insertAdjacentElement(
                "afterend",
                resolutionPanel
            );
        } else {
            adventureGamePanel.prepend(
                resolutionPanel
            );
        }
    }

    const sceneBody = document.getElementById("scene-body");
    if (sceneBody) {
        sceneBody.insertAdjacentElement("afterend", journeyEndPanel);
    } else {
        adventureGamePanel.appendChild(journeyEndPanel);
    }
}


/* =========================================================
   SOLO START
========================================================= */

const soloStartPanel =
    document.createElement(
        "div"
    );


soloStartPanel.className =
    "solo-start-panel";


soloStartPanel.hidden =
    true;


const soloStartCopy =
    document.createElement(
        "div"
    );


soloStartCopy.className =
    "solo-start-copy";


soloStartCopy.innerHTML =
    (
        "<strong>NO PARTNER YET?</strong>"
        + "<span>Continue this adventure with one Hero. "
        + "The Director will adapt the story around you.</span>"
    );


const soloStartButton =
    document.createElement(
        "button"
    );


soloStartButton.type =
    "button";


soloStartButton.className =
    "terminal-button primary solo-start-button";


soloStartButton.textContent =
    "START SOLO";


soloStartPanel.append(
    soloStartCopy,
    soloStartButton,
);


if (
    adventureGamePanel
) {

    const heading =
        adventureGamePanel.querySelector(
            ".panel-heading"
        );


    if (
        heading
    ) {

        heading.insertAdjacentElement(
            "afterend",
            soloStartPanel,
        );

    } else {

        adventureGamePanel.prepend(
            soloStartPanel
        );
    }
}


function updateSoloStartAvailability(
    state = latestTurnFlowState,
) {

    const playMode =
        state?.play_mode
        ?? activeAdventure?.play_mode
        ?? "coop";

    const playerCount =
        Number(
            activeAdventure?.player_count
            ?? state?.readiness?.length
            ?? 0
        );

    const noChoiceLocked =
        !(state?.readiness ?? [])
            .some(player => player?.ready === true);

    const firstTurnStillOpen =
        Number(state?.turn_number ?? 1) === 1
        && !state?.last_resolution
        && noChoiceLocked;

    /*
       Prefer the explicit server eligibility bit, but also derive the
       same pre-turn state from room metadata. room_state and game_state
       can arrive in either order during reconnect/join, and the control
       should not vanish merely because one event arrived first. The
       server still validates start_solo authoritatively on click.
    */
    const canStartSolo =
        state?.can_start_solo === true
        || (
            adventurePlayerIsHost
            && playerCount === 1
            && playMode === "coop"
            && firstTurnStillOpen
        );

    soloStartPanel.hidden =
        !(
            adventurePlayerIsHost
            && canStartSolo
            && playMode !== "solo"
        );
}


soloStartButton.addEventListener(
    "click",
    async () => {

        const confirmed =
            await showGameModal({
                title:
                    "START SOLO?",

                message:
                    (
                        "Continue this adventure with your current Hero?\n\n"
                        + "The Director will adapt the story for one player. "
                        + "Another Hero will not be able to join after solo mode begins."
                    ),

                confirmLabel:
                    "START SOLO",

                cancelLabel:
                    "CANCEL",
            });


        if (
            !confirmed
            || !currentRoomCode
        ) {

            return;
        }


        soloStartButton.disabled =
            true;


        setStatus(
            "STARTING SOLO ADVENTURE_"
        );


        socket.emit(
            "start_solo",
            {
                room_code:
                    currentRoomCode,
            }
        );
    }
);


/* =========================================================
   SESSION CONTROLS
========================================================= */

const adventureControls =
    document.createElement(
        "div"
    );


adventureControls.className =
    "adventure-controls";


const wrapAdventureButton =
    document.createElement(
        "button"
    );


wrapAdventureButton.type =
    "button";


wrapAdventureButton.className =
    (
        "terminal-button "
        + "adventure-control-button "
        + "wrap-up"
    );


wrapAdventureButton.textContent =
    "WRAP UP ADVENTURE";


wrapAdventureButton.hidden =
    true;


const wrapAdventureStatus =
    document.createElement(
        "span"
    );


wrapAdventureStatus.className =
    "wrap-up-status";


wrapAdventureStatus.hidden =
    true;


const exitAdventureButton =
    document.createElement(
        "button"
    );


exitAdventureButton.type =
    "button";


exitAdventureButton.className =
    (
        "terminal-button "
        + "adventure-control-button "
        + "exit"
    );


exitAdventureButton.textContent =
    "EXIT TO LOBBY";


const leaveAdventureButton =
    document.createElement(
        "button"
    );


leaveAdventureButton.type =
    "button";


leaveAdventureButton.className =
    (
        "terminal-button "
        + "adventure-control-button "
        + "leave"
    );


leaveAdventureButton.textContent =
    "LEAVE ADVENTURE";


const abandonAdventureButton =
    document.createElement(
        "button"
    );


abandonAdventureButton.type =
    "button";


abandonAdventureButton.className =
    (
        "terminal-button "
        + "adventure-control-button "
        + "abandon"
    );


abandonAdventureButton.textContent =
    "ABANDON ADVENTURE";


abandonAdventureButton.hidden =
    true;


adventureControls.append(
    wrapAdventureButton,
    wrapAdventureStatus,
    exitAdventureButton,
    leaveAdventureButton,
    abandonAdventureButton,
);


if (
    adventureRoomPanel
) {

    adventureRoomPanel.appendChild(
        adventureControls
    );
}


function updateWrapUpControl(
    state = latestTurnFlowState,
) {
    const available =
        state?.wrap_up_available === true
        && state?.director_complete !== true;

    if (!available) {
        wrapAdventureButton.hidden = true;
        wrapAdventureStatus.hidden = true;
        return;
    }

    const active = state?.wrap_up_active === true;
    const remaining = Math.max(0, Number(state?.wrap_up_turns_remaining ?? 0));
    const votes = Array.isArray(state?.wrap_up_votes) ? state.wrap_up_votes : [];
    const ownPlayerId = activeAdventure?.player_id ?? null;
    const voted = Boolean(ownPlayerId && votes.includes(ownPlayerId));

    wrapAdventureButton.hidden = false;
    wrapAdventureStatus.hidden = false;

    if (active) {
        wrapAdventureButton.disabled = true;
        wrapAdventureButton.textContent = "THE FINAL CHAPTER IS CALLED";
        wrapAdventureStatus.textContent = `${remaining} TURN${remaining === 1 ? "" : "S"} REMAIN // THREADS CONVERGE_`;
        return;
    }

    if (voted) {
        wrapAdventureButton.disabled = true;
        wrapAdventureButton.textContent = "YOUR VOW IS CAST";
        wrapAdventureStatus.textContent = "AWAITING THE OTHER HERO'S MARK_";
        return;
    }

    wrapAdventureButton.disabled = Boolean(state?.turn_pending);
    wrapAdventureButton.textContent = "WRAP UP ADVENTURE";
    wrapAdventureStatus.textContent = (
        state?.play_mode === "solo"
            ? "CALL FOR A THREE-TURN FINALE_"
            : "ALL HEROES MUST AGREE // THREE-TURN FINALE_"
    );
}


wrapAdventureButton.addEventListener(
    "click",
    async () => {
        if (!currentRoomCode || wrapAdventureButton.disabled) return;

        const solo = (latestTurnFlowState?.play_mode ?? activeAdventure?.play_mode) === "solo";
        const confirmed = await showGameModal({
            title: "CALL FOR THE FINAL CHAPTER?",
            message: solo
                ? (
                    "Raise the final banner and ask the Story Director to draw the open threads together.\n\n"
                    + "Once sworn, this chronicle will reach its ending across the next THREE turns."
                )
                : (
                    "Raise your hand for the final chapter. Every Hero in the party must make the same vow.\n\n"
                    + "When all have agreed, the chronicle will reach its ending across the next THREE turns."
                ),
            confirmLabel: "CALL FOR THE ENDING",
            cancelLabel: "NOT YET",
        });

        if (!confirmed) return;

        wrapAdventureButton.disabled = true;
        wrapAdventureButton.textContent = "MARKING YOUR VOW...";
        socket.emit("request_wrap_up", { room_code: currentRoomCode });
    },
);


/* =========================================================
   LOOKUPS
========================================================= */

function adventureForCharacter(
    characterId,
) {

    return adventures.find(
        adventure =>
            adventure.character_id
            === characterId
    )
    ?? null;
}


function adventureForRoom(
    roomCode,
) {

    return adventures.find(
        adventure =>
            adventure.room_code
            === roomCode
    )
    ?? null;
}


function selectedCharacterAdventure() {

    if (
        !selectedCharacter
    ) {

        return null;
    }


    return adventureForCharacter(
        selectedCharacter.character_id
    );
}


/* =========================================================
   LOBBY AVAILABILITY
========================================================= */

function updateLobbyAdventureAvailability() {

    if (
        !selectedCharacter
    ) {

        createRoomButton.disabled =
            true;


        joinRoomButton.disabled =
            true;


        adventureBlockerMessage.hidden =
            true;


        renderAdventurePicker();


        return;
    }


    const existingAdventure =
        selectedCharacterAdventure();


    if (
        existingAdventure
    ) {

        createRoomButton.disabled =
            true;


        joinRoomButton.disabled =
            true;


        adventureBlockerMessage.hidden =
            false;


        adventureBlockerMessage.textContent =
            (
                `${selectedCharacter.name.toUpperCase()} `
                + "IS ALREADY IN AN ACTIVE ADVENTURE — "
                + "resume or leave that adventure before "
                + "using this character in another."
            );


        renderAdventurePicker();


        return;
    }


    createRoomButton.disabled =
        false;


    joinRoomButton.disabled =
        false;


    adventureBlockerMessage.hidden =
        true;


    adventureBlockerMessage.textContent =
        "";


    renderAdventurePicker();
}


/* =========================================================
   CHARACTER CARD DECORATION
========================================================= */

function decorateCharacterCards() {

    const cards =
        Array.from(
            characterList.querySelectorAll(
                ".character-card"
            )
        );


    cards.forEach(
        (
            card,
            index,
        ) => {

            const character =
                characters[
                    index
                ];


            if (
                !character
            ) {

                return;
            }


            const adventure =
                adventureForCharacter(
                    character.character_id
                );


            card.classList.toggle(
                "is-in-adventure",
                Boolean(
                    adventure
                )
            );


            let adventureInfo =
                card.querySelector(
                    ".character-adventure-info"
                );


            if (
                adventure
            ) {

                if (
                    !adventureInfo
                ) {

                    adventureInfo =
                        document.createElement(
                            "div"
                        );


                    adventureInfo.className =
                        (
                            "character-card-meta "
                            + "character-adventure-info"
                        );


                    const actions =
                        card.querySelector(
                            ".button-row"
                        );


                    card.insertBefore(
                        adventureInfo,
                        actions
                    );
                }


                adventureInfo.textContent =
                    (
                        "ACTIVE ADVENTURE\n"
                        + `${adventure.adventure_title ?? adventure.scene_title}\n`
                        + `SCENE ${adventure.scene_title}\n`
                        + `ROOM ${adventure.room_code}`
                    );


                const deleteButton =
                    Array.from(
                        card.querySelectorAll(
                            ".terminal-button"
                        )
                    ).find(
                        button =>
                            button.textContent
                            .trim()
                            .toUpperCase()
                            === "DELETE"
                    );


                if (
                    deleteButton
                ) {

                    deleteButton.disabled =
                        true;
                }

            } else if (
                adventureInfo
            ) {

                adventureInfo.remove();
            }
        }
    );
}


/* =========================================================
   RENDER ADVENTURES
========================================================= */

function renderMyAdventures() {

    myAdventuresList.replaceChildren();


    if (
        adventures.length
        === 0
    ) {

        myAdventuresSection.hidden =
            true;


        decorateCharacterCards();

        updateLobbyAdventureAvailability();


        return;
    }


    myAdventuresSection.hidden =
        false;


    for (
        const adventure
        of adventures
    ) {

        const card =
            document.createElement(
                "article"
            );


        card.className =
            (
                "adventure-card "
                + "current-adventure-card"
            );


        const main =
            document.createElement(
                "div"
            );


        main.className =
            "adventure-card-main";


        const title =
            document.createElement(
                "div"
            );


        title.className =
            "adventure-card-title";


        title.textContent =
            adventure.adventure_title
            ?? adventure.scene_title;


        const meta =
            document.createElement(
                "div"
            );


        meta.className =
            "adventure-card-meta";


        const hostLabel =
            adventure.is_host
                ? " • ★ HOST"
                : "";


        const adventureStatusLabel = adventure.completed
            ? `  •  ${String(adventure.ending_label || "CHRONICLE COMPLETE").toUpperCase()}`
            : "";

        meta.textContent =
            (
                `${adventure.character_name.toUpperCase()}`
                + `  •  ${adventure.scene_title}`
                + `  •  ROOM ${adventure.room_code}`
                + `  •  TURN ${adventure.turn_number}`
                + `  •  ${adventure.player_count}/${adventure.max_players} PLAYERS`
                + adventureStatusLabel
                + hostLabel
            );


        main.append(
            title,
            meta,
        );


        const actions =
            document.createElement(
                "div"
            );


        actions.className =
            "adventure-card-actions";


        const isActive =
            Boolean(
                activeAdventure
                && activeAdventure.room_code
                === adventure.room_code
            );


        card.classList.toggle(
            "is-active-session",
            isActive
        );


        const resumeButton =
            document.createElement(
                "button"
            );


        resumeButton.type =
            "button";


        resumeButton.className =
            "terminal-button continue";


        resumeButton.textContent =
            isActive
                ? "ACTIVE"
                : adventure.completed
                    ? "VIEW FINALE"
                    : "RESUME";


        resumeButton.disabled =
            isActive;


        resumeButton.addEventListener(
            "click",
            () => {

                resumeAdventure(
                    adventure
                );
            }
        );


        const leaveButton =
            document.createElement(
                "button"
            );


        leaveButton.type =
            "button";


        leaveButton.className =
            "terminal-button danger";


        leaveButton.textContent =
            "LEAVE";


        leaveButton.addEventListener(
            "click",
            () => {

                leaveSpecificAdventure(
                    adventure
                );
            }
        );


        actions.append(
            resumeButton,
            leaveButton,
        );


        card.append(
            main,
            actions,
        );


        myAdventuresList.appendChild(
            card
        );
    }


    decorateCharacterCards();

    updateLobbyAdventureAvailability();
}


/* =========================================================
   OVERLAY ROOM RESET
========================================================= */

function resetOverlayRoomState() {

    locallySelectedChoiceId =
        null;

    locallyChoiceLocked =
        false;

    hideTurnTransitionOverlay();

    renderChoiceCommitState();

    lastGameSceneId =
        null;

    lastGameTurnNumber =
        null;

    latestTurnFlowState =
        null;

    latestChoiceState =
        null;

    pendingIntermissionPayload =
        null;

    queuedIntermissionPayload =
        null;

    queuedStoryReadySeconds =
        0;

    latestIntermissionStats =
        [];

    latestIntermissionResult =
        null;

    storyAdvancing =
        false;

    adventurePlayerIsHost =
        false;

    lastHeroXpGain =
        0;

    lastHeroStatusNotice =
        "";

    pendingLevelUpCelebration =
        null;

    pendingFinalePayload =
        null;

    heroHud.hidden =
        true;

    journeyEndPanel.hidden =
        true;

    if (resolutionPanel) {
        resolutionPanel.hidden = true;
    }

    if (resolutionStateElement) {
        resolutionStateElement.textContent = "";
    }

    if (resolutionTextElement) {
        resolutionTextElement.textContent = "";
    }

    if (checkResultList) {
        checkResultList.replaceChildren();
    }

    abandonAdventureButton.hidden =
        true;

    wrapAdventureButton.hidden =
        true;

    wrapAdventureStatus.hidden =
        true;
}


/* =========================================================
   ACTIVE VIEW INVALIDATION
========================================================= */

function invalidateActiveRoomUI() {

    /*
       This function was being called by EXIT / LEAVE / ABANDON
       in the uploaded site but did not actually exist.

       That threw a ReferenceError before the view and header state
       could finish updating.
    */

    currentRoomCode =
        null;

    currentSceneId =
        null;

    sessionReady =
        false;


    document.body.classList.remove(
        "in-session"
    );


    const sessionButton =
        document.getElementById(
            "session-menu-button"
        );


    if (
        sessionButton
    ) {

        sessionButton.hidden =
            true;

        sessionButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    if (
        headerSessionMenu
    ) {

        headerSessionMenu.hidden =
            true;
    }


    closeHeaderDropdowns();
}


/* =========================================================
   SHOW ADVENTURE
========================================================= */

function resetAdventureScrollPosition() {

    const gamePanel =
        document.getElementById(
            "game-panel"
        );


    if (
        !gamePanel
    ) {

        return;
    }


    /*
       #game-panel owns scrolling while an adventure is active. Because the
       same DOM node is reused between adventures, browsers preserve its
       previous scrollTop unless we explicitly clear it. Entry/re-entry
       should always reveal the adventure from the top.
    */

    gamePanel.scrollTop =
        0;


    window.requestAnimationFrame(
        () => {

            gamePanel.scrollTop =
                0;
        }
    );
}


function showAdventureWorkspace(
    { resetScroll = false } = {},
) {

    document.body.classList.remove(
        "view-hero-home"
    );


    document.body.classList.add(
        "in-session"
    );


    /*
       Hero Home hides the adventure-workspace wrapper itself.
       Unhiding only #game-panel / #chat-panel is not enough because a hidden
       parent keeps the whole play view invisible.
    */

    adventureWorkspace.hidden =
        false;


    if (
        resetScroll
    ) {

        resetAdventureScrollPosition();
    }


    window.requestAnimationFrame(
        syncGameHeaderHeight
    );


    const sessionButton =
        document.getElementById(
            "session-menu-button"
        );


    if (
        sessionButton
    ) {

        sessionButton.hidden =
            false;
    }


    adventureCharacterPanel.hidden =
        true;


    adventureBuilderPanel.hidden =
        true;


    adventureLobbyPanel.hidden =
        true;


    adventureRoomPanel.hidden =
        false;


    adventureGamePanel.hidden =
        false;


    adventureChatPanel.hidden =
        false;


    sessionReady =
        true;


    setStatus(
        "ADVENTURE ACTIVE_"
    );
}


/* =========================================================
   EXIT TO LOBBY
========================================================= */

function exitToLobby() {

    journeyEndPanel.hidden = true;
    finaleOverlay.hidden = true;
    finaleOverlay.classList.remove("is-visible", "is-closing");
    pendingFinalePayload = null;
    finaleReturnPending = false;
    if (finaleCountdownTimer) {
        window.clearInterval(finaleCountdownTimer);
        finaleCountdownTimer = null;
    }

    pendingAdventureEntryMode =
        null;

    pendingAdventureEntryAdventure =
        null;


    if (
        !adventureEntryBackdrop.hidden
    ) {

        closeAdventureEntry();
    }


    reconnectRoomCode =
        null;

    reconnectAttemptCount =
        0;

    clearReconnectAttemptTimer();


    if (
        activeAdventure
    ) {

        socket.emit(
            "exit_adventure_view",
            {
                room_code:
                    activeAdventure.room_code,

                character_id:
                    activeAdventure.character_id,
            }
        );
    }


    activeAdventure =
        null;


    resetOverlayRoomState();

    invalidateActiveRoomUI();


    roomStatusElement.textContent =
        "NONE";


    roomCodeDisplay.textContent =
        "------";


    adventureRoomPanel.hidden =
        true;


    adventureGamePanel.hidden =
        true;


    adventureChatPanel.hidden =
        true;


    adventureBuilderPanel.hidden =
        true;


    /*
       CHARACTER PANEL is Hero Home in the stabilized UI.
       EXIT TO LOBBY must not reveal Hero Home underneath the lobby.
    */

    document.body.classList.remove(
        "view-hero-home"
    );


    adventureCharacterPanel.hidden =
        true;


    adventureLobbyPanel.hidden =
        !selectedCharacter;


    renderCharacters();

    renderMyAdventures();


    setStatus(
        "LOBBY_"
    );
}


/* =========================================================
   CONNECTION RECOVERY
========================================================= */

function setAdventureConnectionPhase(
    text,
) {

    if (
        turnFlowPhase
    ) {

        turnFlowPhase.textContent =
            text;
    }
}


function disableAdventureChoicesForConnection() {

    for (
        const button
        of choiceListElement
        ?.querySelectorAll(
            ".choice-button"
        )
        ?? []
    ) {

        button.disabled =
            true;
    }
}


function clearReconnectAttemptTimer() {

    if (
        reconnectAttemptTimer
    ) {

        window.clearTimeout(
            reconnectAttemptTimer
        );

        reconnectAttemptTimer =
            null;
    }
}


function attemptAdventureReconnect() {

    if (
        !socket.connected
        || !reconnectRoomCode
        || !selectedCharacter
    ) {

        return;
    }


    reconnectAttemptCount +=
        1;


    setAdventureConnectionPhase(
        (
            "RECONNECTING TO ADVENTURE"
            + (
                reconnectAttemptCount > 1
                    ? ` // ATTEMPT ${reconnectAttemptCount}`
                    : ""
            )
            + "_"
        )
    );


    socket.emit(
        "resume_adventure",
        {
            room_code:
                reconnectRoomCode,

            character_id:
                selectedCharacter.character_id,
        }
    );


    clearReconnectAttemptTimer();


    if (
        reconnectAttemptCount < 3
    ) {

        reconnectAttemptTimer =
            window.setTimeout(
                () => {

                    if (
                        reconnectRoomCode
                        && socket.connected
                    ) {

                        attemptAdventureReconnect();
                    }
                },
                3500,
            );
    }
}


/* =========================================================
   RESUME
========================================================= */

function resumeAdventure(
    adventure,
) {

    if (
        !adventure
    ) {

        return;
    }


    pendingAdventureEntryMode =
        "resume";


    pendingAdventureEntryAdventure =
        adventure;


    const character =
        characters.find(
            item =>
                item.character_id
                === adventure.character_id
        );


    if (
        character
    ) {

        selectedCharacter =
            character;


        localStorage.setItem(
            CHARACTER_STORAGE_KEY,
            character.character_id
        );


        setCharacterStatus(
            character.name.toUpperCase()
        );


        if (
            typeof renderSelectedCharacterSummary
            === "function"
        ) {

            renderSelectedCharacterSummary(
                character
            );
        }
    }


    setStatus(
        `RESUMING ${adventure.room_code}_`
    );


    socket.emit(
        "resume_adventure",
        {
            room_code:
                adventure.room_code,

            character_id:
                adventure.character_id,
        }
    );
}


/* =========================================================
   LEAVE
========================================================= */

async function leaveSpecificAdventure(
    adventure,
) {

    if (
        !adventure
    ) {

        return;
    }


    const confirmed =
        await showGameModal({

            title:
                "LEAVE ADVENTURE",

            message:
                (
                    `Remove ${adventure.character_name} `
                    + `from ${adventure.scene_title}?\n\n`
                    + "That character will become available "
                    + "for another adventure. Rejoining this "
                    + "one later requires the room code."
                ),

            confirmLabel:
                "LEAVE",

            cancelLabel:
                "CANCEL",

            danger:
                true,
        });


    if (
        !confirmed
    ) {

        return;
    }


    setStatus(
        "LEAVING ADVENTURE_"
    );


    socket.emit(
        "leave_adventure",
        {
            room_code:
                adventure.room_code,

            character_id:
                adventure.character_id,
        }
    );
}


async function leaveActiveAdventure() {

    if (
        !activeAdventure
    ) {

        return;
    }


    await leaveSpecificAdventure(
        activeAdventure
    );
}


/* =========================================================
   ABANDON
========================================================= */

async function abandonAdventure() {

    if (
        !activeAdventure
        || !adventurePlayerIsHost
    ) {

        return;
    }


    const confirmed =
        await showGameModal({

            title:
                "ABANDON ADVENTURE",

            message:
                (
                    `Permanently close room `
                    + `${activeAdventure.room_code} `
                    + "for every player?\n\n"
                    + "The saved adventure state and room "
                    + "will be deleted. This cannot be undone."
                ),

            confirmLabel:
                "ABANDON",

            cancelLabel:
                "CANCEL",

            danger:
                true,
        });


    if (
        !confirmed
    ) {

        return;
    }


    setStatus(
        "ABANDONING ADVENTURE_"
    );


    socket.emit(
        "abandon_adventure",
        {
            room_code:
                activeAdventure.room_code,
        }
    );
}


/* =========================================================
   ACTIVE ROOM
========================================================= */

function updateActiveAdventureFromRoom(
    room,
) {

    if (
        !room
    ) {

        return;
    }


    const ownPlayer =
        (
            room.players
            ?? []
        ).find(
            player =>
                currentUser
                && player.user_id
                === currentUser.user_id
        );


    if (
        !ownPlayer
    ) {

        return;
    }


    adventurePlayerIsHost =
        Boolean(
            ownPlayer.is_host
        );


    adventureControls.classList.toggle(
        "is-host",
        adventurePlayerIsHost,
    );

    adventureControls.classList.toggle(
        "is-guest",
        !adventurePlayerIsHost,
    );


    abandonAdventureButton.hidden =
        !adventurePlayerIsHost;


    const known =
        adventureForRoom(
            room.code
        );


    activeAdventure =
        known
        ?? {
            room_code:
                room.code,

            character_id:
                ownPlayer.character_id,

            character_name:
                ownPlayer.name,

            is_host:
                ownPlayer.is_host,
        };


    activeAdventure.player_count =
        room.player_count;

    activeAdventure.max_players =
        room.max_players;

    activeAdventure.play_mode =
        room.play_mode
        ?? "coop";

    activeAdventure.player_id =
        ownPlayer.player_id;


    renderMyAdventures();

    updateSoloStartAvailability();
}


/* =========================================================
   CHARACTER DELETE INTERCEPT
========================================================= */

characterList.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                ".terminal-button.danger"
            );


        if (
            !button
        ) {

            return;
        }


        if (
            button.textContent
            .trim()
            .toUpperCase()
            !== "DELETE"
        ) {

            return;
        }


        const card =
            button.closest(
                ".character-card"
            );


        if (
            !card
        ) {

            return;
        }


        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();


        const cards =
            Array.from(
                characterList.querySelectorAll(
                    ".character-card"
                )
            );


        const index =
            cards.indexOf(
                card
            );


        const character =
            characters[
                index
            ];


        if (
            !character
        ) {

            return;
        }


        const adventure =
            adventureForCharacter(
                character.character_id
            );


        if (
            adventure
        ) {

            await showGameModal({

                title:
                    "CHARACTER IN USE",

                message:
                    (
                        `${character.name} is currently `
                        + `assigned to ${adventure.scene_title}.\n\n`
                        + "Leave or abandon that adventure "
                        + "before deleting this character."
                    ),

                confirmLabel:
                    "OK",

                hideCancel:
                    true,
            });


            return;
        }


        const confirmed =
            await showGameModal({

                title:
                    "DELETE CHARACTER",

                message:
                    (
                        `Permanently delete `
                        + `${character.name}?\n\n`
                        + "Character deletion cannot be undone."
                    ),

                confirmLabel:
                    "DELETE",

                cancelLabel:
                    "CANCEL",

                danger:
                    true,
            });


        if (
            !confirmed
        ) {

            return;
        }


        try {

            await apiRequest(
                `/api/characters/${character.character_id}`,
                {
                    method:
                        "DELETE",
                }
            );


            characters =
                characters.filter(
                    item =>
                        item.character_id
                        !== character.character_id
                );


            if (
                selectedCharacter
                && selectedCharacter.character_id
                    === character.character_id
            ) {

                selectedCharacter =
                    null;


                localStorage.removeItem(
                    CHARACTER_STORAGE_KEY
                );


                setCharacterStatus(
                    "NONE"
                );


                if (
                    typeof renderSelectedCharacterSummary
                    === "function"
                ) {

                    renderSelectedCharacterSummary(
                        null
                    );
                }


                lobbyPanel.hidden =
                    true;
            }


            renderCharacters();

            renderMyAdventures();


            setStatus(
                "CHARACTER DELETED_"
            );


        } catch (
            error
        ) {

            setMessage(
                characterMessage,
                error.message,
                "is-error",
            );
        }
    },
    true
);


/* =========================================================
   CHOICE STATE
========================================================= */

function decorateChoiceButtons(
    state,
) {

    const choices =
        state?.scene?.choices
        ?? [];


    const buttons =
        Array.from(
            choiceListElement
            .querySelectorAll(
                ".choice-button"
            )
        );


    buttons.forEach(
        (
            button,
            index,
        ) => {

            const choice =
                choices[
                    index
                ];


            if (
                !choice
            ) {

                return;
            }


            button.dataset.choiceId =
                choice.id;


            button.classList.toggle(
                "is-selected",

                choice.id
                === locallySelectedChoiceId
            );

            button.classList.toggle(
                "is-locked",

                locallyChoiceLocked
                && choice.id
                    === locallySelectedChoiceId
            );

            if (state?.pending_micro_event) {
                button.disabled = true;
            }
        }
    );

    renderChoiceCommitState();
}


function clearSelectedChoiceForNewTurn(
    state,
) {

    const sceneId =
        state?.scene?.id
        ?? null;


    const turnNumber =
        state?.turn_number
        ?? null;


    const changed =
        (
            (
                lastGameSceneId
                !== null
            )
            && (
                sceneId
                !== lastGameSceneId
            )
        )
        || (
            (
                lastGameTurnNumber
                !== null
            )
            && (
                turnNumber
                !== lastGameTurnNumber
            )
        );


    if (
        changed
    ) {

        locallySelectedChoiceId =
            null;

        locallyChoiceLocked =
            false;

        renderChoiceCommitState();
    }


    lastGameSceneId =
        sceneId;


    lastGameTurnNumber =
        turnNumber;
}


function estimateChoiceSuccessPercent(choice) {
    const check = choice?.check;
    if (!check || !selectedCharacter) return null;

    const target = String(check.skill ?? check.stat ?? "").trim().toLowerCase();
    const dc = Number(check.difficulty);
    if (!target || !Number.isFinite(dc)) return null;

    const statAliases = {
        str: "strength", strength: "strength",
        agi: "agility", agility: "agility",
        int: "intellect", intellect: "intellect",
        per: "perception", perception: "perception",
        pre: "presence", presence: "presence",
        wil: "willpower", willpower: "willpower",
    };

    let modifier = 0;
    if (check.skill) {
        modifier += Number(selectedCharacter?.skills?.[target] ?? 0);
    } else {
        const statKey = statAliases[target] ?? target;
        modifier += Number(selectedCharacter?.stats?.[statKey] ?? 0);
    }

    for (const effect of activePersistentHeroEffects(selectedCharacter)) {
        const table = check.skill ? effect?.skill_modifiers : effect?.stat_modifiers;
        const statKey = statAliases[target] ?? target;
        modifier += Number(table?.[target] ?? table?.[statKey] ?? 0);
    }

    const needed = dc - modifier;
    const successfulFaces = Math.max(1, Math.min(19, 21 - needed));
    return Math.max(5, Math.min(95, successfulFaces * 5));
}

function renderChoiceDetailList(items, emptyText) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<span class="choice-detail-empty">${escapeSheetText(emptyText)}</span>`;
    return `<ul>${list.map(item => `<li>${escapeSheetText(item)}</li>`).join("")}</ul>`;
}

function showChoiceDetails(choice) {
    if (!choice) return;

    if (activeModalResolver) closeGameModal(false);

    const check = choice.check ?? null;
    const successPercent = estimateChoiceSuccessPercent(choice);
    const checkType = check ? String(check.skill ?? check.stat ?? "CHECK").replaceAll("_", " ").toUpperCase() : "NO CHECK";
    const xp = Number.isFinite(Number(choice.xp_reward)) ? `+${Number(choice.xp_reward)} XP` : "STORY XP";

    modalWindow.classList.add("choice-inspector-modal");
    modalKicker.textContent = "CHOICE DOSSIER";
    modalTitle.textContent = String(choice.label ?? "YOUR CHOICE").toUpperCase();
    modalBody.innerHTML = `
        <div class="choice-detail-summary">${escapeSheetText(choice.description ?? choice.label ?? "")}</div>
        <div class="choice-detail-grid">
            <div><span>RISK</span><strong>${escapeSheetText(String(choice.risk_level ?? "unknown")).toUpperCase()}</strong></div>
            <div><span>REWARD</span><strong>${escapeSheetText(String(choice.reward_level ?? "unknown")).toUpperCase()}</strong></div>
            <div><span>APPROACH</span><strong>${escapeSheetText(String(choice.archetype ?? "open")).toUpperCase()}</strong></div>
            <div><span>IMPACT</span><strong>${escapeSheetText(String(choice.impact_level ?? "local")).replaceAll("_", " ").toUpperCase()}</strong></div>
            <div><span>CHECK</span><strong>${escapeSheetText(check ? `${checkType} // DC ${check.difficulty}` : "NONE")}</strong></div>
            <div><span>ODDS</span><strong>${successPercent === null ? "NARRATIVE" : `~${successPercent}%`}</strong></div>
            <div><span>XP</span><strong>${escapeSheetText(xp)}</strong></div>
            <div><span>TONE</span><strong>${escapeSheetText(String(choice.tone ?? "open")).toUpperCase()}</strong></div>
        </div>
        <div class="choice-detail-columns">
            <section><h4>POSSIBLE GAINS</h4>${renderChoiceDetailList(choice.possible_gains, "Unknown until chosen.")}</section>
            <section><h4>POSSIBLE COSTS</h4>${renderChoiceDetailList(choice.possible_costs, "Unknown until chosen.")}</section>
        </div>
        <div class="choice-detail-note">OUTCOMES ARE POSSIBILITIES, NOT PROMISES. THE STORY STILL ANSWERS TO THE DICE.</div>
    `;
    modalCancelButton.hidden = true;
    modalConfirmButton.textContent = "RETURN TO CHOICES";
    modalConfirmButton.classList.remove("danger");
    modalBackdrop.hidden = false;
    document.body.classList.add("modal-open");
    activeModalResolver = () => {};
    window.setTimeout(() => modalConfirmButton.focus(), 0);
}

choiceListElement.addEventListener(
    "click",
    event => {
        const infoButton = event.target.closest(".choice-info-button");
        if (!infoButton) return;
        event.preventDefault();
        event.stopPropagation();
        const index = Number(infoButton.dataset.choiceIndex);
        const choice = latestChoiceState?.scene?.choices?.[index] ?? null;
        showChoiceDetails(choice);
    },
    true,
);

/* =========================================================
   CHOICE CLICK CAPTURE
========================================================= */

choiceListElement.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".choice-button"
            );


        if (
            !button
            || button.disabled
            || locallyChoiceLocked
            || storyAdvancing
            || latestChoiceState?.pending_micro_event
        ) {

            return;
        }


        const choiceId =
            button.dataset.choiceId;


        if (
            !choiceId
        ) {

            return;
        }


        locallySelectedChoiceId =
            choiceId;


        for (
            const choiceButton
            of choiceListElement
            .querySelectorAll(
                ".choice-button"
            )
        ) {

            choiceButton.classList.toggle(
                "is-selected",

                choiceButton.dataset.choiceId
                === choiceId
            );
        }

        renderChoiceCommitState();
    }
);


/* =========================================================
   CHARACTER REDRAW WATCH
========================================================= */

const characterObserver =
    new MutationObserver(
        () => {

            decorateCharacterCards();

            updateLobbyAdventureAvailability();
        }
    );


characterObserver.observe(
    characterList,
    {
        childList:
            true,

        /*
           IMPORTANT:
           Do NOT set this to true.

           decorateCharacterCards() modifies children
           inside the cards and would recursively trigger
           this observer forever.
        */

        subtree:
            false,
    }
);


/* =========================================================
   CREATE ADVENTURE INTERCEPT
========================================================= */

createRoomButton.addEventListener(
    "click",
    event => {

        if (
            createRoomButton.disabled
            || !selectedCharacter
        ) {

            return;
        }


        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();


        socket.emit(
            "create_room",
            {
                character_id:
                    selectedCharacter.character_id,

                adventure_id:
                    selectedAdventureId,
            }
        );
    },
    true
);


/* =========================================================
   BUTTONS
========================================================= */

exitAdventureButton.addEventListener(
    "click",
    exitToLobby
);


leaveAdventureButton.addEventListener(
    "click",
    leaveActiveAdventure
);


abandonAdventureButton.addEventListener(
    "click",
    abandonAdventure
);


/* =========================================================
   ADVENTURE CATALOG
========================================================= */

socket.on(
    "adventure_catalog",
    data => {

        adventureCatalog =
            (
                Array.isArray(
                    data?.adventures
                )
                    ? data.adventures
                    : []
            )
            .filter(
                definition =>
                    ![
                        "old_chapel",
                        "windroad_lantern",
                    ]
                    .includes(
                        definition.adventure_id
                    )
            );


        const selectedStillExists =
            adventureCatalog.some(
                definition =>
                    definition.adventure_id
                    === selectedAdventureId
            );


        if (
            !selectedStillExists
            && adventureCatalog.length
            > 0
        ) {

            selectedAdventureId =
                adventureCatalog[
                    0
                ].adventure_id;
        }


        renderAdventurePicker();
    }
);


/* =========================================================
   ADVENTURE LIST
========================================================= */

socket.on(
    "adventure_list",
    data => {

        adventures =
            Array.isArray(
                data?.adventures
            )
                ? data.adventures
                : [];


        if (
            activeAdventure
        ) {

            activeAdventure =
                adventureForRoom(
                    activeAdventure.room_code
                )
                ?? null;
        }


        renderMyAdventures();

        updateLobbyAdventureAvailability();
    }
);


/* =========================================================
   ROOM STATE
========================================================= */

socket.on(
    "room_state",
    room => {

        /*
           Ignore stale or unrelated room broadcasts.

           A socket may own memberships in several rooms,
           but only one room is actively displayed.
        */

        if (
            !currentRoomCode
            || room.code
                !== currentRoomCode
        ) {

            return;
        }


        updateActiveAdventureFromRoom(
            room
        );
    }
);


/* =========================================================
   GAME STATE
========================================================= */

socket.on(
    "game_state",
    state => {

        if (
            !currentRoomCode
            || state.room_code
                !== currentRoomCode
        ) {

            return;
        }


        latestChoiceState =
            state;

        clearSelectedChoiceForNewTurn(
            state
        );


        decorateChoiceButtons(
            state
        );


        renderPendingMicroEvent(
            state
        );


        renderTurnFlow(
            state
        );


        updateWrapUpControl(
            state
        );


        recoverTurnTransitionFromGameState(
            state
        );


        renderLiveHeroHud(
            selectedCharacter
        );


        maybeShowAdventureEntry(
            state
        );


        if (
            activeAdventure
        ) {

            activeAdventure.turn_number =
                state.turn_number;


            activeAdventure.scene_id =
                state.scene?.id;


            activeAdventure.scene_title =
                state.scene?.title;


            renderMyAdventures();
        }
    }
);


socket.on(
    "wrap_up_vote_recorded",
    data => {
        if (!roomPayloadMatchesActive(data)) return;
        setStatus(data?.message ?? "YOUR VOW IS MARKED_");
    },
);


socket.on(
    "wrap_up_approved",
    data => {
        if (!roomPayloadMatchesActive(data)) return;
        setStatus("THE FINAL CHAPTER HAS BEEN CALLED // THREE TURNS REMAIN_");
    },
);


/* =========================================================
   STORY ADVANCING / INTERMISSION
========================================================= */

socket.on(
    "turn_lock_countdown",
    startTurnLockCountdown,
);


socket.on(
    "story_advancing",
    data => {

        if (
            !roomPayloadMatchesActive(
                data
            )
        ) {

            return;
        }


        startIntermission(
            data
        );
    }
);


socket.on(
    "intermission_result",
    data => {

        if (
            !roomPayloadMatchesActive(
                data
            )
        ) {

            return;
        }


        latestIntermissionResult =
            data;


        const api =
            intermissionApi();


        if (
            api?.configured
        ) {

            api.showResult(
                data
            );
        }
    }
);


socket.on(
    "turn_resolved",
    data => {

        if (
            !roomPayloadMatchesActive(
                data
            )
        ) {

            return;
        }


        stopIntermission(
            "story_ready",
            3,
        );


        applyHeroProgressionPayload(
            data.hero_progression
        );


        if (
            data.completed
        ) {

            pendingFinalePayload = data.finale ?? pendingFinalePayload;
            journeyEndPanel.hidden = false;

            window.dispatchEvent(
                new CustomEvent(
                    "tot:adventure-completed",
                    {
                        detail: {
                            character_id:
                                selectedCharacter
                                ?.character_id
                                ?? null,

                            room_code:
                                currentRoomCode,

                            finale:
                                pendingFinalePayload,
                        },
                    }
                )
            );
        }
    }
);


socket.on(
    "micro_event_updated",
    data => {
        if (!roomPayloadMatchesActive(data)) return;

        microEventSubmitting = false;

        if (data?.completed === true) {
            showMicroEventResolution(data.event);
            setStatus(data?.event?.resolution ?? "QUICK EVENT RESOLVED_");
            return;
        }

        if (latestChoiceState) {
            latestChoiceState.pending_micro_event = data?.event ?? null;
            renderPendingMicroEvent(latestChoiceState);
            decorateChoiceButtons(latestChoiceState);
        }
    }
);


/* =========================================================
   CHOICE ACCEPTED
========================================================= */

socket.on(
    "choice_accepted",
    data => {

        if (
            !roomPayloadMatchesActive(
                data
            )
        ) {

            return;
        }


        locallySelectedChoiceId =
            data.choice_id;

        locallyChoiceLocked =
            true;

        renderChoiceCommitState();


        /*
           Show the local player as READY immediately. The server's
           subsequent game_state remains authoritative.
        */

        showLocalChoiceLockedTransition();


        for (
            const button
            of choiceListElement
            .querySelectorAll(
                ".choice-button"
            )
        ) {

            button.classList.toggle(
                "is-selected",

                button.dataset.choiceId
                === data.choice_id
            );

            button.classList.toggle(
                "is-locked",

                button.dataset.choiceId
                === data.choice_id
            );


            button.disabled =
                true;
        }
    }
);


/* =========================================================
   ROOM JOINED
========================================================= */

socket.on(
    "room_joined",
    data => {

        pendingAdventureEntryMode =
            "new";


        pendingAdventureEntryAdventure = {
            adventure_id:
                data.adventure_id,

            adventure_title:
                data.adventure_title,

            room_code:
                data.room?.code,
        };


        resetOverlayRoomState();


        document.body.classList.add(
            "in-session"
        );


        const sessionButton =
            document.getElementById(
                "session-menu-button"
            );


        if (sessionButton) {

            sessionButton.hidden =
                false;
        }



        currentRoomCode =
            data.room.code;


        updateActiveAdventureFromRoom(
            data.room
        );


        if (
            activeAdventure
        ) {

            activeAdventure.adventure_id =
                data.adventure_id
                ?? activeAdventure.adventure_id;

            activeAdventure.adventure_title =
                data.adventure_title
                ?? activeAdventure.adventure_title;
        }


        showAdventureWorkspace({
            resetScroll: true,
        });
    }
);




socket.on(
    "room_error",
    () => {

        soloStartButton.disabled =
            false;
    }
);
socket.on(
    "solo_started",
    data => {

        if (
            !roomPayloadMatchesActive(
                data
            )
        ) {

            return;
        }


        soloStartButton.disabled =
            false;


        soloStartPanel.hidden =
            true;


        if (
            activeAdventure
        ) {

            activeAdventure.play_mode =
                "solo";

            activeAdventure.max_players =
                1;
        }


        setStatus(
            "SOLO ADVENTURE ACTIVE_"
        );

        socket.emit(
            "sync_adventure_state",
            {
                room_code:
                    currentRoomCode,
            }
        );
    }
);


/* =========================================================
   ADVENTURE CONNECTION STATUS
========================================================= */

socket.on(
    "disconnect",
    () => {

        if (
            currentRoomCode
            && selectedCharacter
        ) {

            reconnectRoomCode =
                currentRoomCode;


            reconnectAttemptCount =
                0;


            clearReconnectAttemptTimer();


            setAdventureConnectionPhase(
                "CONNECTION LOST // RECONNECTING_"
            );


            disableAdventureChoicesForConnection();
        }
    }
);


socket.on(
    "connect",
    () => {

        if (
            reconnectRoomCode
            && selectedCharacter
        ) {

            window.setTimeout(
                attemptAdventureReconnect,
                150,
            );
        }
    }
);


socket.io?.on(
    "reconnect_attempt",
    attemptNumber => {

        if (
            reconnectRoomCode
        ) {

            setAdventureConnectionPhase(
                (
                    "CONNECTION LOST // "
                    + `RECONNECT ATTEMPT ${attemptNumber}_`
                )
            );
        }
    }
);


socket.io?.on(
    "reconnect_failed",
    () => {

        if (
            reconnectRoomCode
        ) {

            setAdventureConnectionPhase(
                "CONNECTION LOST // RETRY OR EXIT TO LOBBY_"
            );
        }
    }
);


/* =========================================================
   RESUME SUCCESS
========================================================= */

socket.on(
    "resume_success",
    data => {

        clearReconnectAttemptTimer();


        reconnectRoomCode =
            null;


        reconnectAttemptCount =
            0;


        resetOverlayRoomState();


        document.body.classList.add(
            "in-session"
        );


        const sessionButton =
            document.getElementById(
                "session-menu-button"
            );


        if (sessionButton) {

            sessionButton.hidden =
                false;
        }



        currentRoomCode =
            data.room.code;


        updateActiveAdventureFromRoom(
            data.room
        );


        showAdventureWorkspace({
            resetScroll: true,
        });


        if (
            data.completed
            && data.finale
        ) {

            pendingFinalePayload =
                data.finale;


            journeyEndPanel.hidden =
                false;


            resetAdventureScrollToTop();


            window.dispatchEvent(
                new CustomEvent(
                    "tot:adventure-completed",
                    {
                        detail: {
                            character_id:
                                selectedCharacter
                                ?.character_id
                                ?? data.character_id
                                ?? null,

                            room_code:
                                currentRoomCode,

                            finale:
                                pendingFinalePayload,

                            resumed:
                                true,
                        },
                    }
                )
            );
        }
    }
);


/* =========================================================
   VIEW EXITED
========================================================= */

socket.on(
    "adventure_view_exited",
    data => {

        document.body.classList.remove(
            "view-hero-home"
        );


        adventureCharacterPanel.hidden =
            true;


        adventureRoomPanel.hidden =
            true;

        adventureGamePanel.hidden =
            true;

        adventureChatPanel.hidden =
            true;


        adventureLobbyPanel.hidden =
            !selectedCharacter;


        setStatus(
            "LOBBY_"
        );
    }
);


/* =========================================================
   ADVENTURE LEFT
========================================================= */

socket.on(
    "adventure_left",
    data => {

        const leftActiveAdventure =
            Boolean(
                activeAdventure
                && activeAdventure.room_code
                    === data.room_code
                && activeAdventure.character_id
                    === data.character_id
            );


        if (
            leftActiveAdventure
        ) {

            activeAdventure =
                null;


            resetOverlayRoomState();

            invalidateActiveRoomUI();


            roomStatusElement.textContent =
                "NONE";


            roomCodeDisplay.textContent =
                "------";


            adventureRoomPanel.hidden =
                true;


            adventureGamePanel.hidden =
                true;


            adventureChatPanel.hidden =
                true;


            adventureCharacterPanel.hidden =
                false;


            adventureLobbyPanel.hidden =
                !selectedCharacter;
        }


        document.body.classList.remove(
            "in-session"
        );


        const sessionButton =
            document.getElementById(
                "session-menu-button"
            );


        if (sessionButton) {

            sessionButton.hidden =
                true;
        }


        if (finaleReturnPending) {
            finaleReturnPending = false;
            finaleOverlay.classList.add("is-closing");
            window.setTimeout(() => {
                finaleOverlay.hidden = true;
                finaleOverlay.classList.remove("is-visible", "is-closing");
                journeyEndPanel.hidden = true;
                pendingFinalePayload = null;
            }, 220);
        }

        // Always reload the authoritative Hero record after leaving a journey.
        // This makes finale XP/levels/advancement/effects visible immediately
        // on Hero Home instead of leaving stale pre-adventure client data.
        if (typeof loadCharacters === "function") {
            loadCharacters().catch(error => console.error("[CHARACTER REFRESH]", error));
        }

        setStatus(
            "ADVENTURE LEFT_"
        );
    }
);


/* =========================================================
   ABANDONED
========================================================= */

socket.on(
    "adventure_abandoned",
    data => {

        if (
            activeAdventure
            && activeAdventure.room_code
                === data.room_code
        ) {

            activeAdventure =
                null;


            resetOverlayRoomState();

            invalidateActiveRoomUI();


            adventureRoomPanel.hidden =
                true;


            adventureGamePanel.hidden =
                true;


            adventureChatPanel.hidden =
                true;


            adventureCharacterPanel.hidden =
                false;


            adventureLobbyPanel.hidden =
                !selectedCharacter;
        }


        document.body.classList.remove(
            "in-session"
        );


        const sessionButton =
            document.getElementById(
                "session-menu-button"
            );


        if (sessionButton) {

            sessionButton.hidden =
                true;
        }


        setStatus(
            "ADVENTURE CLOSED_"
        );
    }
);


socket.on(
    "game_error",
    data => {

        if (
            storyAdvancing
        ) {

            stopIntermission(
                "error"
            );
        }

        hideTurnTransitionOverlay();

        if (
            data?.retryable
            && roomPayloadMatchesActive(
                data
            )
        ) {

            showDirectorRetryPrompt(
                data?.message
            );

            return;
        }

        if (
            !locallyChoiceLocked
            && locallySelectedChoiceId
        ) {

            choiceCommitButton.disabled =
                false;

            renderChoiceCommitState();
        }
    }
);


/* =========================================================
   BOOT
========================================================= */

renderMyAdventures();

renderAdventurePicker();

updateLobbyAdventureAvailability();