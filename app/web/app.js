"use strict";


/* =========================================================
   HELPERS
========================================================= */

const byId = id =>
    document.getElementById(
        id
    );


function sleep(
    milliseconds,
) {

    return new Promise(
        resolve =>
            window.setTimeout(
                resolve,
                milliseconds,
            )
    );
}


function titleCase(
    value,
) {

    if (!value) {

        return "";
    }


    return String(
        value
    )
    .replace(
        /_/g,
        " ",
    )
    .replace(
        /\b\w/g,
        letter =>
            letter.toUpperCase()
    );
}


function signedNumber(
    value,
) {

    const number =
        Number(
            value
            ?? 0
        );


    return number >= 0
        ? `+${number}`
        : String(
            number
        );
}


/* =========================================================
   STATUS DOM
========================================================= */

const statusElement =
    byId("status");

const networkStatusElement =
    byId("network-status");

const accountStatusElement =
    byId("account-status");

const characterStatusElement =
    byId("character-status");

const roomStatusElement =
    byId("room-status");

const playerCountElement =
    byId("player-count");


/* =========================================================
   PRIMARY SHELL DOM
========================================================= */

const publicHome =
    byId("public-home");

const signedOutTools =
    byId("signed-out-tools");

const authenticatedTools =
    byId("authenticated-tools");


const headerLoginButton =
    byId("header-login-button");

const headerRegisterButton =
    byId("header-register-button");


/* =========================================================
   AUTH DOM
========================================================= */

const authPanel =
    byId("auth-panel");

const loginView =
    byId("login-view");

const registerView =
    byId("register-view");

const authMessage =
    byId("auth-message");

const loginIdentifierInput =
    byId("login-identifier");

const loginPasswordInput =
    byId("login-password");

const loginButton =
    byId("login-button");

const showRegisterButton =
    byId("show-register-button");

const loginPasswordToggle =
    byId("login-password-toggle");

const registerEmailInput =
    byId("register-email");

const registerUsernameInput =
    byId("register-username");

const registerPasswordInput =
    byId("register-password");

const registerPasswordConfirmInput =
    byId("register-password-confirm");

const registerButton =
    byId("register-button");

const showLoginButton =
    byId("show-login-button");

const registerPasswordToggle =
    byId("register-password-toggle");

const registerPasswordConfirmToggle =
    byId(
        "register-password-confirm-toggle"
    );


/* =========================================================
   ACCOUNT DOM
========================================================= */

const accountPanel =
    byId("account-panel");

const accountUsernameElement =
    byId("account-username");

const accountEmailElement =
    byId("account-email");

const accountAccessElement =
    byId("account-access");

const accountHeroHomeButton =
    byId("account-hero-home-button");

const accountAuthorLink =
    byId("account-author-link");

const logoutButton =
    byId("logout-button");


/* =========================================================
   CHARACTER LIBRARY DOM
========================================================= */

const characterPanel =
    byId("character-panel");

const characterList =
    byId("character-list");

const characterMessage =
    byId("character-message");

const showCharacterBuilderButton =
    byId(
        "show-character-builder-button"
    );


/* =========================================================
   CHARACTER BUILDER DOM
========================================================= */

const characterBuilderPanel =
    byId("character-builder-panel");

const cancelCharacterBuilderButton =
    byId(
        "cancel-character-builder-button"
    );

const newCharacterNameInput =
    byId("new-character-name");

const statBudgetElement =
    byId("stat-budget");

const skillBudgetElement =
    byId("skill-budget");

const statAllocationList =
    byId("stat-allocation-list");

const skillAllocationGroups =
    byId("skill-allocation-groups");

const summaryStatPoints =
    byId("summary-stat-points");

const summarySkillPoints =
    byId("summary-skill-points");

const buildValidityElement =
    byId("build-validity");

const createCharacterButton =
    byId("create-character-button");

const builderMessage =
    byId("builder-message");


/* =========================================================
   LOBBY DOM
========================================================= */

const lobbyPanel =
    byId("lobby-panel");

const selectedCharacterSummary =
    byId("selected-character-summary");

const roomCodeInput =
    byId("room-code-input");

const createRoomButton =
    byId("create-room-button");

const joinRoomButton =
    byId("join-room-button");


/* =========================================================
   ROOM DOM
========================================================= */

const roomPanel =
    byId("room-panel");

const roomCodeDisplay =
    byId("room-code-display");

const playerList =
    byId("player-list");


/* =========================================================
   GAME DOM
========================================================= */

const gamePanel =
    byId("game-panel");

const turnNumberElement =
    byId("turn-number");

const sceneTitleElement =
    byId("scene-title");

const sceneArtElement =
    byId("scene-art");

const sceneBodyElement =
    byId("scene-body");

const readyListElement =
    byId("ready-list");

const choiceListElement =
    byId("choice-list");

const resolutionPanel =
    byId("resolution-panel");

const resolutionStateElement =
    byId("resolution-state");

const resolutionTextElement =
    byId("resolution-text");

const checkResultList =
    byId("check-result-list");


/* =========================================================
   CHAT DOM
========================================================= */

const chatPanel =
    byId("chat-panel");

const chatLog =
    byId("chat-log");

const chatInput =
    byId("chat-input");

const sendChatButton =
    byId("send-chat-button");


/* =========================================================
   STORAGE
========================================================= */

const CHARACTER_STORAGE_KEY =
    "tot.selectedCharacterId";


/* =========================================================
   STATE
========================================================= */

let currentUser =
    null;

let characters =
    [];

let currentRoomPlayers =
    [];

let selectedCharacter =
    null;

let creationRules =
    null;

let characterBuilderReturnTarget =
    "lobby";


let creationBuild = {
    stats: {},
    skills: {},
};

let currentRoomCode =
    null;

let currentSceneId =
    null;

let sessionReady =
    false;

let resolutionAnimationId =
    0;

let activePresentationKey =
    null;


/* =========================================================
   SOCKET
========================================================= */

const socket = io({

    autoConnect:
        false,

    transports: [
        "websocket",
        "polling",
    ],

    reconnection:
        true,

    reconnectionAttempts:
        Infinity,

    reconnectionDelay:
        500,

    reconnectionDelayMax:
        5000,

    timeout:
        10000,
});


/* =========================================================
   GENERAL UI
========================================================= */

function setStatus(
    text,
) {

    statusElement.textContent =
        text;
}


function setNetworkStatus(
    text,
) {

    networkStatusElement.textContent =
        text;
}


function setAccountStatus(
    text,
) {

    accountStatusElement.textContent =
        text;
}


function setCharacterStatus(
    text,
) {

    characterStatusElement.textContent =
        text;
}


function setMessage(
    element,
    text,
    type = "",
) {

    element.textContent =
        text;


    element.classList.remove(
        "is-error",
        "is-success",
    );


    if (type) {

        element.classList.add(
            type
        );
    }
}


/* =========================================================
   HTTP
========================================================= */

function formatApiError(
    data,
    status,
) {

    if (!data) {

        return (
            `REQUEST FAILED (${status})`
        );
    }


    if (
        typeof data.detail
        === "string"
    ) {

        return data.detail;
    }


    if (
        Array.isArray(
            data.detail
        )
    ) {

        return data.detail.map(
            error => {

                const location =
                    Array.isArray(
                        error.loc
                    )
                        ? error.loc
                            .filter(
                                part =>
                                    part !== "body"
                            )
                            .join(".")
                        : "";


                const message =
                    error.msg
                    ?? "Invalid value";


                return location
                    ? `${location.toUpperCase()}: ${message}`
                    : message;
            }
        ).join(
            " | "
        );
    }


    return (
        `REQUEST FAILED (${status})`
    );
}


async function apiRequest(
    url,
    options = {},
) {

    const headers = {
        ...(
            options.headers
            ?? {}
        ),
    };


    if (
        options.body
        !== undefined
    ) {

        headers[
            "Content-Type"
        ] = "application/json";
    }


    const response =
        await fetch(
            url,
            {
                ...options,
                headers,
            }
        );


    let data =
        null;


    try {

        data =
            await response.json();

    } catch {

        data =
            null;
    }


    if (!response.ok) {

        throw new Error(
            formatApiError(
                data,
                response.status,
            )
        );
    }


    return data;
}


/* =========================================================
   PASSWORDS
========================================================= */

function setupPasswordToggle(
    input,
    button,
) {

    button.addEventListener(
        "click",
        () => {

            const reveal =
                input.type
                === "password";


            input.type =
                reveal
                    ? "text"
                    : "password";


            button.classList.toggle(
                "is-visible",
                reveal
            );


            input.focus();
        }
    );
}


/* =========================================================
   ACCOUNT MANAGER
========================================================= */

const accountBackdrop =
    document.createElement(
        "section"
    );

accountBackdrop.className =
    "account-manager-backdrop";

accountBackdrop.hidden =
    true;


const accountModal =
    document.createElement(
        "div"
    );

accountModal.className =
    "account-manager-modal";


const accountModalHeader =
    document.createElement(
        "div"
    );

accountModalHeader.className =
    "account-manager-modal-header";

accountModalHeader.innerHTML =
    `
    <div>
        <div class="eyebrow">PLAYER ACCOUNT</div>
        <div class="panel-heading account-manager-title">
            ACCOUNT MANAGER
        </div>
    </div>
    `;


const accountModalClose =
    document.createElement(
        "button"
    );

accountModalClose.type =
    "button";

accountModalClose.className =
    "terminal-button account-manager-close";

accountModalClose.textContent =
    "CLOSE";


accountModalHeader.appendChild(
    accountModalClose
);


accountModal.append(
    accountModalHeader,
    accountPanel,
);


accountBackdrop.appendChild(
    accountModal
);


document.body.appendChild(
    accountBackdrop
);


function closeAccountManager() {

    accountBackdrop.hidden =
        true;


    document.body.classList.remove(
        "account-manager-open"
    );
}


function openAccountManager() {

    if (
        !currentUser
    ) {

        return;
    }


    accountBackdrop.hidden =
        false;


    accountPanel.hidden =
        false;


    document.body.classList.add(
        "account-manager-open"
    );
}


accountModalClose.addEventListener(
    "click",
    closeAccountManager
);


accountBackdrop.addEventListener(
    "click",
    event => {

        if (
            event.target
            === accountBackdrop
        ) {

            closeAccountManager();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
            && !accountBackdrop.hidden
        ) {

            closeAccountManager();
        }
    }
);


window.totOpenAccountManager =
    openAccountManager;


function currentUserHasPermission(
    permission,
) {

    return Boolean(
        currentUser
        && Array.isArray(
            currentUser.permissions
        )
        && currentUser.permissions.includes(
            permission
        )
    );
}


/* =========================================================
   SELECTED HERO SUMMARY
========================================================= */

function renderSelectedCharacterSummary(
    character,
) {

    if (
        !selectedCharacterSummary
    ) {

        return;
    }


    selectedCharacterSummary.replaceChildren();


    if (
        !character
    ) {

        const empty =
            document.createElement(
                "span"
            );

        empty.className =
            "selected-hero-empty";

        empty.textContent =
            "NO HERO SELECTED_";


        selectedCharacterSummary.appendChild(
            empty
        );

        return;
    }


    const name =
        document.createElement(
            "span"
        );

    name.className =
        "selected-hero-name";

    name.textContent =
        String(
            character.name
            ?? "HERO"
        ).toUpperCase();


    const stats =
        document.createElement(
            "span"
        );

    stats.className =
        "selected-hero-stats";


    const entries = [
        [
            "LEVEL",
            character.level
            ?? 1,
        ],
        [
            "XP",
            character.experience
            ?? 0,
        ],
        [
            "HP",
            (
                `${character.health ?? 0}`
                + "/"
                + `${character.max_health ?? 0}`
            ),
        ],
    ];


    for (
        const [
            label,
            value,
        ]
        of entries
    ) {

        const stat =
            document.createElement(
                "span"
            );

        stat.className =
            (
                "selected-hero-stat "
                + `is-${label.toLowerCase()}`
            );


        const key =
            document.createElement(
                "small"
            );

        key.textContent =
            label;


        const number =
            document.createElement(
                "strong"
            );

        number.textContent =
            String(
                value
            );


        stat.append(
            key,
            number,
        );


        stats.appendChild(
            stat
        );
    }


    const hint =
        document.createElement(
            "span"
        );

    hint.className =
        "selected-hero-open-hint";

    hint.textContent =
        "OPEN HERO SHEET →";


    selectedCharacterSummary.append(
        name,
        stats,
        hint,
    );
}


/* =========================================================
   AUTH MODAL
========================================================= */

const authBackdrop =
    document.createElement(
        "section"
    );

authBackdrop.className =
    "auth-backdrop";

authBackdrop.hidden =
    true;


const authModal =
    document.createElement(
        "div"
    );

authModal.className =
    "auth-modal";


const authModalClose =
    document.createElement(
        "button"
    );

authModalClose.type =
    "button";

authModalClose.className =
    "auth-modal-close";

authModalClose.setAttribute(
    "aria-label",
    "Close login"
);

authModalClose.textContent =
    "×";


authModal.append(
    authModalClose,
    authPanel,
);


authBackdrop.appendChild(
    authModal
);


document.body.appendChild(
    authBackdrop
);


function closeAuthModal() {

    authBackdrop.hidden =
        true;


    document.body.classList.remove(
        "modal-open"
    );
}


function openAuthModal(
    mode =
        "login",
) {

    if (
        mode === "register"
    ) {

        showRegisterView();

    } else {

        showLoginView();
    }


    authBackdrop.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );


    window.setTimeout(
        () => {

            (
                mode === "register"
                    ? registerEmailInput
                    : loginIdentifierInput
            )
            ?.focus();
        },
        0
    );
}


authModalClose.addEventListener(
    "click",
    closeAuthModal
);


authBackdrop.addEventListener(
    "click",
    event => {

        if (
            event.target
            === authBackdrop
        ) {

            closeAuthModal();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
            && !authBackdrop.hidden
        ) {

            closeAuthModal();
        }
    }
);


/* =========================================================
   AUTH UI
========================================================= */

function showLoginView() {

    loginView.hidden =
        false;

    registerView.hidden =
        true;


    setMessage(
        authMessage,
        ""
    );
}


function showRegisterView() {

    loginView.hidden =
        true;

    registerView.hidden =
        false;


    setMessage(
        authMessage,
        ""
    );
}


function resetAuthenticatedUI() {

    closeAuthModal();

    closeAccountManager();


    document.body.classList.remove(
        "is-authenticated",
        "view-hero-home",
    );

    document.body.classList.add(
        "is-signed-out"
    );


    if (publicHome) {

        publicHome.hidden =
            false;
    }


    if (signedOutTools) {

        signedOutTools.hidden =
            false;
    }


    if (authenticatedTools) {

        authenticatedTools.hidden =
            true;
    }


    currentUser =
        null;

    characters =
        [];

    selectedCharacter =
        null;

    creationRules =
        null;

    currentRoomCode =
        null;

    currentSceneId =
        null;

    sessionReady =
        false;


    authPanel.hidden =
        false;

    accountPanel.hidden =
        true;

    characterPanel.hidden =
        true;

    characterBuilderPanel.hidden =
        true;

    lobbyPanel.hidden =
        true;

    roomPanel.hidden =
        true;

    gamePanel.hidden =
        true;

    chatPanel.hidden =
        true;


    resolutionPanel.hidden =
        true;


    setAccountStatus(
        "NONE"
    );

    setCharacterStatus(
        "NONE"
    );

    roomStatusElement.textContent =
        "NONE";

    playerCountElement.textContent =
        "00 / 02";

    setNetworkStatus(
        "OFFLINE"
    );


    showLoginView();
}


function showAuthenticatedUI(
    user,
) {

    closeAuthModal();


    currentUser =
        user;


    document.body.classList.remove(
        "is-signed-out"
    );

    document.body.classList.add(
        "is-authenticated"
    );


    if (publicHome) {

        publicHome.hidden =
            true;
    }


    if (signedOutTools) {

        signedOutTools.hidden =
            true;
    }


    if (authenticatedTools) {

        authenticatedTools.hidden =
            false;
    }


    authPanel.hidden =
        true;

    accountPanel.hidden =
        false;

    characterPanel.hidden =
        true;


    accountUsernameElement.textContent =
        user.username;

    accountEmailElement.textContent =
        user.email;


    const permissions =
        Array.isArray(
            user.permissions
        )
            ? user.permissions
            : [];


    accountAccessElement.textContent =
        permissions.includes(
            "author"
        )
            ? (
                permissions.includes(
                    "publish"
                )
                    ? "AUTHOR / PUBLISHER"
                    : "AUTHOR"
            )
            : "PLAYER";


    accountAuthorLink.hidden =
        !permissions.includes(
            "author"
        );


    setAccountStatus(
        user.username.toUpperCase()
    );
}


/* =========================================================
   CREATION RULES
========================================================= */

async function loadCreationRules() {

    creationRules =
        await apiRequest(
            "/api/characters/creation-rules",
            {
                method:
                    "GET",
            }
        );
}


/* =========================================================
   CHARACTER LIBRARY
========================================================= */

function renderCharacters() {

    characterList.replaceChildren();


    if (
        characters.length
        === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "system-message";


        empty.textContent =
            "> NO CHARACTERS FOUND_";


        characterList.appendChild(
            empty
        );


        return;
    }


    for (
        const character
        of characters
    ) {

        const card =
            document.createElement(
                "div"
            );


        card.className =
            "character-card";


        const isSelected =
            selectedCharacter
            && (
                selectedCharacter.character_id
                === character.character_id
            );


        if (isSelected) {

            card.classList.add(
                "is-selected"
            );
        }


        const name =
            document.createElement(
                "div"
            );


        name.className =
            "character-card-name";


        name.textContent =
            character.name.toUpperCase();


        const meta =
            document.createElement(
                "div"
            );


        meta.className =
            "character-card-meta";


        meta.textContent =
            (
                `LEVEL ${character.level}\n`
                + `HP ${character.health}/${character.max_health}\n`
                + `XP ${character.experience}`
            );


        meta.style.whiteSpace =
            "pre-line";


        const buttons =
            document.createElement(
                "div"
            );


        buttons.className =
            "button-row";


        const selectButton =
            document.createElement(
                "button"
            );


        selectButton.type =
            "button";


        selectButton.className =
            "terminal-button primary";


        selectButton.textContent =
            isSelected
                ? "SELECTED"
                : "SELECT";


        selectButton.disabled =
            Boolean(
                isSelected
            );


        selectButton.addEventListener(
            "click",
            () => {

                selectCharacter(
                    character.character_id
                );
            }
        );


        const deleteButton =
            document.createElement(
                "button"
            );


        deleteButton.type =
            "button";


        deleteButton.className =
            "terminal-button danger";


        deleteButton.textContent =
            "DELETE";


        deleteButton.disabled =
            Boolean(
                currentRoomCode
            );


        deleteButton.addEventListener(
            "click",
            () => {

                deleteCharacter(
                    character
                );
            }
        );


        buttons.append(
            selectButton,
            deleteButton,
        );


        card.append(
            name,
            meta,
            buttons,
        );


        characterList.appendChild(
            card
        );
    }
}


function selectCharacter(
    characterId,
) {

    const character =
        characters.find(
            item =>
                item.character_id
                === characterId
        );


    if (!character) {

        return;
    }


    selectedCharacter =
        character;


    localStorage.setItem(
        CHARACTER_STORAGE_KEY,
        character.character_id
    );


    setCharacterStatus(
        character.name.toUpperCase()
    );


    renderSelectedCharacterSummary(
        character
    );


    if (
        !currentRoomCode
        && !document.body.classList.contains(
            "view-hero-home"
        )
        && characterBuilderPanel.hidden
    ) {

        lobbyPanel.hidden =
            false;
    }


    renderCharacters();


    window.dispatchEvent(
        new CustomEvent(
            "tot:character-selected",
            {
                detail: {
                    character_id:
                        character.character_id,
                },
            }
        )
    );
}


async function loadCharacters() {

    const result =
        await apiRequest(
            "/api/characters",
            {
                method:
                    "GET",
            }
        );


    characters =
        result.characters
        ?? [];


    const storedCharacterId =
        localStorage.getItem(
            CHARACTER_STORAGE_KEY
        );


    selectedCharacter =
        characters.find(
            character =>
                character.character_id
                === storedCharacterId
        )
        ?? characters[
            0
        ]
        ?? null;


    if (
        selectedCharacter
    ) {

        /*
           Preserve a valid stored hero. Otherwise choose the first hero
           returned by the server. A player who owns heroes should never
           land in an unusable "no hero selected" state.
        */

        selectCharacter(
            selectedCharacter.character_id
        );

    } else {

        setCharacterStatus(
            "NONE"
        );


        renderSelectedCharacterSummary(
            null
        );


        lobbyPanel.hidden =
            true;

        characterPanel.hidden =
            false;

        document.body.classList.add(
            "view-hero-home"
        );


        renderCharacters();
    }


    window.dispatchEvent(
        new CustomEvent(
            "tot:characters-loaded",
            {
                detail: {
                    count:
                        characters.length,
                },
            }
        )
    );
}


/* =========================================================
   CHARACTER CREATOR
========================================================= */

function resetCreationBuild() {

    creationBuild = {
        stats: {},
        skills: {},
    };


    if (!creationRules) {

        return;
    }


    for (
        const stat
        of creationRules.stats
    ) {

        creationBuild.stats[
            stat.id
        ] = creationRules.stat_min;
    }


    for (
        const skill
        of creationRules.skills
    ) {

        creationBuild.skills[
            skill.id
        ] = creationRules.skill_min;
    }


    newCharacterNameInput.value =
        "";


    setMessage(
        builderMessage,
        ""
    );
}


function totalValues(
    values,
) {

    return Object.values(
        values
    ).reduce(
        (
            total,
            value,
        ) =>
            total + value,
        0
    );
}


function statPointsUsed() {

    return totalValues(
        creationBuild.stats
    );
}


function skillPointsUsed() {

    return totalValues(
        creationBuild.skills
    );
}


function isCreationBuildValid() {

    if (!creationRules) {

        return false;
    }


    const name =
        newCharacterNameInput
        .value
        .trim();


    return (
        name.length >= 2
        && name.length <= 40
        && statPointsUsed()
            === creationRules.stat_point_budget
        && skillPointsUsed()
            === creationRules.skill_point_budget
    );
}


function refreshCharacterBuilderControls() {

    if (!creationRules) {
        return;
    }

    const usedStats = statPointsUsed();
    const usedSkills = skillPointsUsed();

    statBudgetElement.textContent =
        `${usedStats} / ${creationRules.stat_point_budget} POINTS`;

    skillBudgetElement.textContent =
        `${usedSkills} / ${creationRules.skill_point_budget} POINTS`;

    statBudgetElement.classList.toggle(
        "is-complete",
        usedStats === creationRules.stat_point_budget,
    );

    skillBudgetElement.classList.toggle(
        "is-complete",
        usedSkills === creationRules.skill_point_budget,
    );

    summaryStatPoints.textContent =
        `${usedStats} / ${creationRules.stat_point_budget}`;

    summarySkillPoints.textContent =
        `${usedSkills} / ${creationRules.skill_point_budget}`;

    for (const row of statAllocationList.querySelectorAll(".allocation-row[data-allocation-id]")) {
        const id = row.dataset.allocationId;
        const value = Number(creationBuild.stats[id] ?? creationRules.stat_min);
        const valueElement = row.querySelector(".allocation-value");
        const minus = row.querySelector('[data-allocation-action="decrease"]');
        const plus = row.querySelector('[data-allocation-action="increase"]');

        if (valueElement) valueElement.textContent = String(value);
        if (minus) minus.disabled = value <= creationRules.stat_min;
        if (plus) {
            plus.disabled = (
                value >= creationRules.stat_max
                || usedStats >= creationRules.stat_point_budget
            );
        }
    }

    for (const group of skillAllocationGroups.querySelectorAll(".skill-group[data-stat-id]")) {
        const statId = group.dataset.statId;
        const statRule = creationRules.stats.find(item => item.id === statId);
        const statValue = Number(creationBuild.stats[statId] ?? creationRules.stat_min);
        const headingValue = group.querySelector(".skill-group-stat-value");

        if (headingValue) headingValue.textContent = `STAT ${statValue}`;

        for (const row of group.querySelectorAll(".allocation-row[data-allocation-id]")) {
            const skillId = row.dataset.allocationId;
            const skillRule = creationRules.skills.find(item => item.id === skillId);
            const value = Number(creationBuild.skills[skillId] ?? creationRules.skill_min);
            const valueElement = row.querySelector(".allocation-value");
            const secondary = row.querySelector(".allocation-secondary");
            const minus = row.querySelector('[data-allocation-action="decrease"]');
            const plus = row.querySelector('[data-allocation-action="increase"]');

            if (valueElement) valueElement.textContent = String(value);
            if (secondary && skillRule && statRule) {
                secondary.textContent = `${statRule.label} + Skill = +${statValue + value}`;
            }
            if (minus) minus.disabled = value <= creationRules.skill_min;
            if (plus) {
                plus.disabled = (
                    value >= creationRules.skill_max
                    || usedSkills >= creationRules.skill_point_budget
                );
            }
        }
    }

    const valid = isCreationBuildValid();
    buildValidityElement.textContent = valid ? "READY" : "INCOMPLETE";
    createCharacterButton.disabled = !valid;
}


function changeStat(
    statId,
    delta,
) {

    const current =
        creationBuild.stats[
            statId
        ];


    const proposed =
        current + delta;


    if (
        proposed
        < creationRules.stat_min
        || proposed
        > creationRules.stat_max
    ) {

        return;
    }


    if (
        delta > 0
        && statPointsUsed()
            >= creationRules.stat_point_budget
    ) {

        return;
    }


    creationBuild.stats[
        statId
    ] = proposed;


    refreshCharacterBuilderControls();
}


function changeSkill(
    skillId,
    delta,
) {

    const current =
        creationBuild.skills[
            skillId
        ];


    const proposed =
        current + delta;


    if (
        proposed
        < creationRules.skill_min
        || proposed
        > creationRules.skill_max
    ) {

        return;
    }


    if (
        delta > 0
        && skillPointsUsed()
            >= creationRules.skill_point_budget
    ) {

        return;
    }


    creationBuild.skills[
        skillId
    ] = proposed;


    refreshCharacterBuilderControls();
}


function createAllocationRow(
    {
        name,
        secondary,
        value,
        canDecrease,
        canIncrease,
        decrease,
        increase,
        allocationId = null,
    },
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "allocation-row";

    if (allocationId) {
        row.dataset.allocationId = allocationId;
    }


    const label =
        document.createElement(
            "div"
        );


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "allocation-name";


    title.textContent =
        name;


    label.appendChild(
        title
    );


    if (secondary) {

        const secondaryElement =
            document.createElement(
                "div"
            );


        secondaryElement.className =
            "allocation-secondary";


        secondaryElement.textContent =
            secondary;


        label.appendChild(
            secondaryElement
        );
    }


    const controls =
        document.createElement(
            "div"
        );


    controls.className =
        "allocation-controls";


    const minus =
        document.createElement(
            "button"
        );


    minus.type =
        "button";

    minus.className =
        "allocation-button";

    minus.dataset.allocationAction =
        "decrease";

    minus.textContent =
        "−";

    minus.disabled =
        !canDecrease;

    minus.addEventListener(
        "click",
        decrease
    );


    const valueElement =
        document.createElement(
            "div"
        );


    valueElement.className =
        "allocation-value";


    valueElement.textContent =
        String(
            value
        );


    const plus =
        document.createElement(
            "button"
        );


    plus.type =
        "button";

    plus.className =
        "allocation-button";

    plus.dataset.allocationAction =
        "increase";

    plus.textContent =
        "+";

    plus.disabled =
        !canIncrease;

    plus.addEventListener(
        "click",
        increase
    );


    controls.append(
        minus,
        valueElement,
        plus,
    );


    row.append(
        label,
        controls,
    );


    return row;
}


function renderCharacterBuilder() {

    if (!creationRules) {

        return;
    }


    const usedStats =
        statPointsUsed();


    const usedSkills =
        skillPointsUsed();


    statBudgetElement.textContent =
        `${usedStats} / ${creationRules.stat_point_budget} POINTS`;


    skillBudgetElement.textContent =
        `${usedSkills} / ${creationRules.skill_point_budget} POINTS`;


    statBudgetElement.classList.toggle(
        "is-complete",
        usedStats
            === creationRules.stat_point_budget
    );


    skillBudgetElement.classList.toggle(
        "is-complete",
        usedSkills
            === creationRules.skill_point_budget
    );


    summaryStatPoints.textContent =
        `${usedStats} / ${creationRules.stat_point_budget}`;


    summarySkillPoints.textContent =
        `${usedSkills} / ${creationRules.skill_point_budget}`;


    statAllocationList.replaceChildren();


    for (
        const stat
        of creationRules.stats
    ) {

        const value =
            creationBuild.stats[
                stat.id
            ];


        statAllocationList.appendChild(
            createAllocationRow({

                name:
                    stat.label,

                allocationId:
                    stat.id,

                secondary:
                    `MIN ${creationRules.stat_min} / MAX ${creationRules.stat_max}`,

                value,

                canDecrease:
                    value
                    > creationRules.stat_min,

                canIncrease:
                    value
                    < creationRules.stat_max
                    && usedStats
                    < creationRules.stat_point_budget,

                decrease:
                    () =>
                        changeStat(
                            stat.id,
                            -1,
                        ),

                increase:
                    () =>
                        changeStat(
                            stat.id,
                            1,
                        ),
            })
        );
    }


    skillAllocationGroups.replaceChildren();


    for (
        const stat
        of creationRules.stats
    ) {

        const relatedSkills =
            creationRules.skills.filter(
                skill =>
                    skill.stat
                    === stat.id
            );


        if (
            relatedSkills.length
            === 0
        ) {

            continue;
        }


        const group =
            document.createElement(
                "div"
            );


        group.className =
            "skill-group";

        group.dataset.statId =
            stat.id;


        const heading =
            document.createElement(
                "div"
            );


        heading.className =
            "skill-group-heading";


        heading.innerHTML =
            `<span>${stat.label.toUpperCase()}</span>`;


        const statValue =
            document.createElement(
                "span"
            );


        statValue.className =
            "skill-group-stat-value";


        statValue.textContent =
            `STAT ${creationBuild.stats[stat.id]}`;


        heading.appendChild(
            statValue
        );


        const rows =
            document.createElement(
                "div"
            );


        rows.className =
            "skill-group-rows";


        for (
            const skill
            of relatedSkills
        ) {

            const value =
                creationBuild.skills[
                    skill.id
                ];


            rows.appendChild(
                createAllocationRow({

                    name:
                        skill.label,

                    allocationId:
                        skill.id,

                    secondary:
                        (
                            `${stat.label} + Skill = +`
                            + (
                                creationBuild.stats[
                                    stat.id
                                ]
                                + value
                            )
                        ),

                    value,

                    canDecrease:
                        value
                        > creationRules.skill_min,

                    canIncrease:
                        value
                        < creationRules.skill_max
                        && usedSkills
                        < creationRules.skill_point_budget,

                    decrease:
                        () =>
                            changeSkill(
                                skill.id,
                                -1,
                            ),

                    increase:
                        () =>
                            changeSkill(
                                skill.id,
                                1,
                            ),
                })
            );
        }


        group.append(
            heading,
            rows,
        );


        skillAllocationGroups.appendChild(
            group
        );
    }


    const valid =
        isCreationBuildValid();


    buildValidityElement.textContent =
        valid
            ? "READY"
            : "INCOMPLETE";


    createCharacterButton.disabled =
        !valid;
}


function openCharacterBuilder(
    returnTarget =
        "lobby",
) {

    if (!creationRules) {

        return;
    }


    characterBuilderReturnTarget =
        returnTarget === "hero-home"
            ? "hero-home"
            : "lobby";


    resetCreationBuild();

    renderCharacterBuilder();


    document.body.classList.remove(
        "view-hero-home"
    );


    characterPanel.hidden =
        true;

    lobbyPanel.hidden =
        true;

    characterBuilderPanel.hidden =
        false;
}


function closeCharacterBuilder() {

    characterBuilderPanel.hidden =
        true;


    /*
       Never reveal Hero Home and the lobby simultaneously.
       Character creation is a full view, so CANCEL restores exactly one
       destination.
    */

    characterPanel.hidden =
        true;

    lobbyPanel.hidden =
        true;


    if (
        characterBuilderReturnTarget
        === "hero-home"
    ) {

        characterPanel.hidden =
            false;


        document.body.classList.add(
            "view-hero-home"
        );


        window.dispatchEvent(
            new CustomEvent(
                "tot:character-selected"
            )
        );

    } else if (
        selectedCharacter
        && !currentRoomCode
    ) {

        document.body.classList.remove(
            "view-hero-home"
        );


        lobbyPanel.hidden =
            false;

    } else {

        characterPanel.hidden =
            false;


        document.body.classList.add(
            "view-hero-home"
        );
    }
}


async function createCharacter() {

    if (
        !isCreationBuildValid()
    ) {

        return;
    }


    try {

        const character =
            await apiRequest(
                "/api/characters",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            name:
                                newCharacterNameInput
                                .value
                                .trim(),

                            stats:
                                creationBuild.stats,

                            skills:
                                creationBuild.skills,
                        }),
                }
            );


        characters.push(
            character
        );


        selectCharacter(
            character.character_id
        );


        characterBuilderPanel.hidden =
            true;


        characterPanel.hidden =
            true;

        lobbyPanel.hidden =
            true;


        if (
            characterBuilderReturnTarget
            === "hero-home"
        ) {

            characterPanel.hidden =
                false;


            document.body.classList.add(
                "view-hero-home"
            );

        } else {

            document.body.classList.remove(
                "view-hero-home"
            );


            lobbyPanel.hidden =
                false;
        }


        renderCharacters();


        window.dispatchEvent(
            new CustomEvent(
                "tot:characters-loaded",
                {
                    detail: {
                        count:
                            characters.length,
                    },
                }
            )
        );


    } catch (error) {

        setMessage(
            builderMessage,
            error.message,
            "is-error",
        );
    }
}


async function deleteCharacter(
    character,
) {

    if (
        currentRoomCode
    ) {

        return;
    }


    if (
        !window.confirm(
            `Delete ${character.name}?`
        )
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


            if (
                characters.length > 0
            ) {

                selectCharacter(
                    characters[
                        0
                    ].character_id
                );

            } else {

                setCharacterStatus(
                    "NONE"
                );


                renderSelectedCharacterSummary(
                    null
                );


                lobbyPanel.hidden =
                    true;

                characterPanel.hidden =
                    false;

                document.body.classList.add(
                    "view-hero-home"
                );
            }
        }


        renderCharacters();


        window.dispatchEvent(
            new CustomEvent(
                "tot:characters-loaded",
                {
                    detail: {
                        count:
                            characters.length,
                    },
                }
            )
        );


    } catch (error) {

        setMessage(
            characterMessage,
            error.message,
            "is-error",
        );
    }
}


/* =========================================================
   AUTH
========================================================= */

async function checkAuthentication() {

    try {

        const result =
            await apiRequest(
                "/api/auth/me",
                {
                    method:
                        "GET",
                }
            );


        if (
            result.authenticated
            && result.user
        ) {

            showAuthenticatedUI(
                result.user
            );


            await Promise.all([
                loadCreationRules(),
                loadCharacters(),
            ]);


            connectSocket();

            return;
        }


        resetAuthenticatedUI();


    } catch (error) {

        resetAuthenticatedUI();


        setMessage(
            authMessage,
            error.message,
            "is-error",
        );
    }
}


async function login() {

    const identifier =
        loginIdentifierInput
        .value
        .trim();


    const password =
        loginPasswordInput
        .value;


    if (
        !identifier
        || !password
    ) {

        return;
    }


    try {

        const result =
            await apiRequest(
                "/api/auth/login",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            identifier,
                            password,
                        }),
                }
            );


        showAuthenticatedUI(
            result.user
        );


        await Promise.all([
            loadCreationRules(),
            loadCharacters(),
        ]);


        connectSocket();


    } catch (error) {

        setMessage(
            authMessage,
            error.message,
            "is-error",
        );
    }
}


async function register() {

    const email =
        registerEmailInput
        .value
        .trim();


    const username =
        registerUsernameInput
        .value
        .trim();


    const password =
        registerPasswordInput
        .value;


    const confirm =
        registerPasswordConfirmInput
        .value;


    if (
        password !== confirm
    ) {

        setMessage(
            authMessage,
            "PASSWORDS DO NOT MATCH_",
            "is-error",
        );

        return;
    }


    try {

        await apiRequest(
            "/api/auth/register",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        email,
                        username,
                        password,
                    }),
            }
        );


        const result =
            await apiRequest(
                "/api/auth/login",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            identifier:
                                username,

                            password,
                        }),
                }
            );


        showAuthenticatedUI(
            result.user
        );


        await Promise.all([
            loadCreationRules(),
            loadCharacters(),
        ]);


        connectSocket();


    } catch (error) {

        setMessage(
            authMessage,
            error.message,
            "is-error",
        );
    }
}


async function logout() {

    try {

        await apiRequest(
            "/api/auth/logout",
            {
                method:
                    "POST",
            }
        );

    } catch {
        // Ignore logout transport failure.
    }


    if (
        socket.connected
    ) {

        socket.disconnect();
    }


    resetAuthenticatedUI();
}


/* =========================================================
   SOCKET / ROOM
========================================================= */

function connectSocket() {

    if (
        currentUser
        && !socket.connected
    ) {

        socket.connect();
    }
}


function resetRoomScopedPresentationState() {

    resolutionAnimationId += 1;
    currentSceneId = null;
    currentRoomPlayers = [];

    if (turnNumberElement) turnNumberElement.textContent = "TURN 001";
    if (sceneTitleElement) sceneTitleElement.textContent = "";
    if (sceneArtElement) sceneArtElement.textContent = "";
    if (sceneBodyElement) sceneBodyElement.textContent = "";
    if (readyListElement) readyListElement.replaceChildren();
    if (choiceListElement) choiceListElement.replaceChildren();
    if (playerList) playerList.replaceChildren();

    if (resolutionPanel) resolutionPanel.hidden = true;
    if (resolutionStateElement) resolutionStateElement.textContent = "";
    if (resolutionTextElement) resolutionTextElement.textContent = "";
    if (checkResultList) checkResultList.replaceChildren();

    if (chatLog) chatLog.replaceChildren();
}


function enterRoomUI(
    roomCode,
) {

    document.body.classList.remove(
        "view-hero-home"
    );


    const nextPresentationKey =
        `${roomCode}:${selectedCharacter?.character_id ?? ""}`;

    if (
        activePresentationKey
        !== nextPresentationKey
    ) {
        resetRoomScopedPresentationState();
        activePresentationKey = nextPresentationKey;
    }


    currentRoomCode =
        roomCode;


    roomStatusElement.textContent =
        roomCode;

    roomCodeDisplay.textContent =
        roomCode;


    characterPanel.hidden =
        true;

    characterBuilderPanel.hidden =
        true;

    lobbyPanel.hidden =
        true;

    roomPanel.hidden =
        false;

    gamePanel.hidden =
        false;

    chatPanel.hidden =
        false;
}


function renderPlayers(
    players,
) {

    playerList.replaceChildren();


    for (
        const player
        of players
    ) {

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "player";


        const name =
            document.createElement(
                "span"
            );


        name.textContent =
            player.name.toUpperCase();


        row.appendChild(
            name
        );


        if (
            player.is_host
        ) {

            const host =
                document.createElement(
                    "span"
                );


            host.className =
                "player-host";


            host.textContent =
                "[HOST]";


            row.appendChild(
                host
            );
        }


        const state =
            document.createElement(
                "span"
            );


        state.className =
            "muted";


        state.textContent =
            player.is_online
                ? "[ONLINE]"
                : "[OFFLINE]";


        row.appendChild(
            state
        );


        playerList.appendChild(
            row
        );
    }
}


/* =========================================================
   GAME DISPLAY
========================================================= */

function renderReadiness(
    readiness,
) {

    readyListElement.replaceChildren();


    for (
        const player
        of readiness
    ) {

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "ready-row";


        const name =
            document.createElement(
                "span"
            );


        name.textContent =
            player.name.toUpperCase();


        const state =
            document.createElement(
                "span"
            );


        state.textContent =
            !player.online
                ? "[OFFLINE]"
                : player.ready
                    ? "[READY]"
                    : "[THINKING]";


        row.append(
            name,
            state,
        );


        readyListElement.appendChild(
            row
        );
    }
}


function renderChoices(
    choices,
) {

    choiceListElement.replaceChildren();


    choices.forEach(
        (
            choice,
            index,
        ) => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "choice-card";

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "choice-button";


            const label =
                document.createElement(
                    "span"
                );


            label.className =
                "choice-label";


            label.textContent =
                `[${index + 1}] ${choice.label}`;


            button.appendChild(
                label
            );


            if (
                choice.check
            ) {

                const meta =
                    document.createElement(
                        "span"
                    );


                meta.className =
                    "choice-check-meta";


                const checkType =
                    choice.check.skill
                    ?? choice.check.stat;


                const risk =
                    String(choice.risk_level ?? "").trim();

                meta.textContent =
                    (
                        `${risk ? `${risk.toUpperCase()} RISK • ` : ""}`
                        + `${titleCase(checkType)}`
                        + ` • DC ${choice.check.difficulty}`
                        + (
                            Number.isFinite(Number(choice.xp_reward))
                                ? ` • +${Number(choice.xp_reward)} XP`
                                : ""
                        )
                    );


                button.appendChild(
                    meta
                );
            } else if (
                Number.isFinite(
                    Number(choice.xp_reward)
                )
            ) {

                const meta =
                    document.createElement(
                        "span"
                    );

                meta.className =
                    "choice-check-meta choice-xp-meta";

                const risk =
                    String(choice.risk_level ?? "").trim();

                meta.textContent =
                    `${risk ? `${risk.toUpperCase()} RISK • ` : ""}+${Number(choice.xp_reward)} XP`;

                button.appendChild(
                    meta
                );
            }


            button.disabled =
                !sessionReady;


            /*
               Choice buttons are intentionally selection-only.
               adventure_ui.js owns the explicit LOCK IN action so a
               player can inspect/change a highlighted choice before
               committing the authoritative turn.
            */

            button.dataset.choiceId =
                choice.id;

            const infoButton =
                document.createElement(
                    "button"
                );

            infoButton.type =
                "button";

            infoButton.className =
                "choice-info-button";

            infoButton.dataset.choiceId =
                choice.id;

            infoButton.dataset.choiceIndex =
                String(index);

            infoButton.setAttribute(
                "aria-label",
                `Inspect ${choice.label}`
            );

            infoButton.textContent =
                "[ i ]";

            card.append(
                button,
                infoButton,
            );

            choiceListElement.appendChild(
                card
            );
        }
    );
}


function renderGameState(
    state,
) {

    const scene =
        state.scene;


    currentSceneId =
        scene.id;


    turnNumberElement.textContent =
        `TURN ${String(
            state.turn_number
        ).padStart(
            3,
            "0"
        )}`;


    sceneTitleElement.textContent =
        scene.title;


    sceneArtElement.textContent =
        scene.ascii_art
        ?? "";


    sceneBodyElement.textContent =
        scene.body
        ?? "";


    renderReadiness(
        state.readiness
        ?? []
    );


    renderChoices(
        scene.choices
        ?? []
    );
}


/* =========================================================
   ASCII D20
========================================================= */

function buildAsciiD20(
    number,
) {

    const padded =
        String(
            number
        ).padStart(
            2,
            " "
        );


    return (
`          /\\
         /  \\
        / /\\ \\
       / /  \\ \\
      / / ${padded} \\ \\
     / /      \\ \\
    /__________\\
     \\        /
      \\______/
`
    );
}


async function animateD20(
    element,
    finalRoll,
    animationId,
) {

    element.classList.add(
        "is-rolling"
    );


    const frames = 14;


    for (
        let index = 0;
        index < frames;
        index += 1
    ) {

        if (
            animationId
            !== resolutionAnimationId
        ) {

            return;
        }


        const fakeRoll =
            Math.floor(
                Math.random()
                * 20
            )
            + 1;


        element.textContent =
            buildAsciiD20(
                fakeRoll
            );


        const delay =
            45
            + (
                index
                * 8
            );


        await sleep(
            delay
        );
    }


    if (
        animationId
        !== resolutionAnimationId
    ) {

        return;
    }


    element.classList.remove(
        "is-rolling"
    );


    element.textContent =
        buildAsciiD20(
            finalRoll
        );
}


/* =========================================================
   CHECK CARD
========================================================= */

function addBreakdownLine(
    container,
    label,
    value,
    extraClass = "",
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        `check-line ${extraClass}`;


    const labelElement =
        document.createElement(
            "span"
        );


    labelElement.className =
        "check-line-label";


    labelElement.textContent =
        label;


    const valueElement =
        document.createElement(
            "span"
        );


    valueElement.className =
        "check-line-value";


    valueElement.textContent =
        value;


    row.append(
        labelElement,
        valueElement,
    );


    container.appendChild(
        row
    );
}


function buildCheckCard(
    result,
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "check-card";


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "check-card-header";


    const heading =
        document.createElement(
            "div"
        );


    const character =
        document.createElement(
            "div"
        );


    character.className =
        "check-character";


    character.textContent =
        result.player_name.toUpperCase();


    const choice =
        document.createElement(
            "div"
        );


    choice.className =
        "check-choice";


    choice.textContent =
        result.choice_label;


    heading.append(
        character,
        choice,
    );


    const dc =
        document.createElement(
            "div"
        );


    dc.className =
        "check-dc";


    dc.textContent =
        `DC ${result.check.difficulty}`;


    header.append(
        heading,
        dc,
    );


    const stage =
        document.createElement(
            "div"
        );


    stage.className =
        "dice-stage";


    const die =
        document.createElement(
            "pre"
        );


    die.className =
        "ascii-d20";


    die.textContent =
        buildAsciiD20(
            "?"
        );


    const breakdown =
        document.createElement(
            "div"
        );


    breakdown.className =
        "check-breakdown";


    addBreakdownLine(
        breakdown,
        "D20",
        "..."
    );


    addBreakdownLine(
        breakdown,
        titleCase(
            result.check.stat
        ),
        signedNumber(
            result.check.stat_value
        )
    );


    if (
        result.check.skill
    ) {

        addBreakdownLine(
            breakdown,
            titleCase(
                result.check.skill
            ),
            signedNumber(
                result.check.skill_value
            )
        );
    }


    if (
        result.check.equipment_modifier
        !== 0
    ) {

        addBreakdownLine(
            breakdown,
            "Equipment",
            signedNumber(
                result.check.equipment_modifier
            )
        );
    }


    if (
        result.check.situation_modifier
        !== 0
    ) {

        addBreakdownLine(
            breakdown,
            "Situation",
            signedNumber(
                result.check.situation_modifier
            )
        );
    }


    if (
        result.check.performance_modifier
        !== 0
    ) {

        addBreakdownLine(
            breakdown,
            "Performance",
            signedNumber(
                result.check.performance_modifier
            )
        );
    }


    if (
        Number(result.check.effect_modifier || 0)
        !== 0
    ) {

        const details = Array.isArray(result.check.effect_details)
            ? result.check.effect_details
            : [];

        const label = details.length === 1
            ? String(details[0].name || "Status FX")
            : "Status FX";

        addBreakdownLine(
            breakdown,
            label,
            signedNumber(
                Number(result.check.effect_modifier || 0)
            )
        );
    }


    addBreakdownLine(
        breakdown,
        "TOTAL",
        "...",
        "check-total"
    );


    const outcome =
        document.createElement(
            "div"
        );


    outcome.className =
        "check-outcome";


    stage.append(
        die,
        breakdown,
    );


    card.append(
        header,
        stage,
        outcome,
    );


    return {
        card,
        die,
        breakdown,
        outcome,
    };
}


async function animateCheckResult(
    result,
    animationId,
) {

    const elements =
        buildCheckCard(
            result
        );


    checkResultList.appendChild(
        elements.card
    );


    await animateD20(
        elements.die,
        result.check.roll,
        animationId,
    );


    if (
        animationId
        !== resolutionAnimationId
    ) {

        return;
    }


    const lines =
        elements.breakdown
        .querySelectorAll(
            ".check-line"
        );


    if (
        lines.length
        > 0
    ) {

        lines[
            0
        ]
        .querySelector(
            ".check-line-value"
        )
        .textContent =
            String(
                result.check.roll
            );


        lines[
            lines.length - 1
        ]
        .querySelector(
            ".check-line-value"
        )
        .textContent =
            String(
                result.check.total
            );
    }


    await sleep(
        180
    );


    const outcome =
        result.check.outcome;


    elements.outcome.textContent =
        titleCase(
            outcome
        ).toUpperCase();


    elements.outcome.classList.add(
        outcome.replace(
            /_/g,
            "-"
        )
    );


    elements.outcome.classList.add(
        "is-visible"
    );


    await sleep(
        result.check.critical
            ? 900
            : 450
    );
}


/* =========================================================
   TURN RESOLUTION ANIMATION
========================================================= */

async function showTurnResolution(
    data,
) {

    resolutionAnimationId += 1;


    const animationId =
        resolutionAnimationId;


    resolutionPanel.hidden =
        false;


    resolutionStateElement.textContent =
        "ROLLING_";


    resolutionTextElement.textContent =
        "";


    checkResultList.replaceChildren();


    const results =
        data.results
        ?? [];


    for (
        const result
        of results
    ) {

        if (
            animationId
            !== resolutionAnimationId
        ) {

            return;
        }


        if (
            result.check
        ) {

            await animateCheckResult(
                result,
                animationId,
            );

        } else {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "check-card";


            card.textContent =
                (
                    `${result.player_name.toUpperCase()}`
                    + ` — ${result.choice_label}`
                    + ` — NO CHECK REQUIRED`
                );


            checkResultList.appendChild(
                card
            );


            await sleep(
                300
            );
        }
    }


    if (
        animationId
        !== resolutionAnimationId
    ) {

        return;
    }


    resolutionTextElement.textContent =
        data.resolution
        ?? "";


    resolutionStateElement.textContent =
        "COMPLETE_";


    setStatus(
        "TURN RESOLVED_"
    );
}


/* =========================================================
   CHAT
========================================================= */

function clearChatMessages() {

    chatLog.replaceChildren();
}


function appendChatMessage(
    message,
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "chat-message";


    const playerIndex =
        Math.max(
            0,
            currentRoomPlayers.findIndex(
                player =>
                    player.name
                    === message.player_name
            )
        );


    const player =
        currentRoomPlayers[
            playerIndex
        ]
        ?? null;


    const isSelf =
        Boolean(
            selectedCharacter
            && message.player_name
                === selectedCharacter.name
        );


    const isHost =
        Boolean(
            player?.is_host
        );


    const slot =
        Math.min(
            playerIndex + 1,
            8
        );


    row.classList.add(
        `chat-player-${slot}`
    );


    if (isSelf) {

        row.classList.add(
            "chat-self"
        );
    }


    const prompt =
        document.createElement(
            "span"
        );


    prompt.className =
        "chat-prompt";


    prompt.textContent =
        "> ";


    const hostMark =
        document.createElement(
            "span"
        );


    hostMark.className =
        "chat-host-mark";


    hostMark.textContent =
        isHost
            ? "★ "
            : "";


    const name =
        document.createElement(
            "span"
        );


    name.className =
        "chat-name";


    name.textContent =
        `${message.player_name}:`;


    const text =
        document.createElement(
            "span"
        );


    text.className =
        "chat-text";


    text.textContent =
        ` ${message.text}`;


    row.append(
        prompt,
        hostMark,
        name,
        text,
    );


    chatLog.appendChild(
        row
    );


    chatLog.scrollTop =
        chatLog.scrollHeight;
}


/* =========================================================
   GAME ACTIONS
========================================================= */

function createRoom() {

    if (
        !selectedCharacter
    ) {

        return;
    }


    socket.emit(
        "create_room",
        {
            character_id:
                selectedCharacter.character_id,
        }
    );
}


function joinRoom() {

    if (
        !selectedCharacter
    ) {

        return;
    }


    const roomCode =
        roomCodeInput
        .value
        .trim()
        .toUpperCase();


    if (!roomCode) {

        return;
    }


    socket.emit(
        "join_room",
        {
            room_code:
                roomCode,

            character_id:
                selectedCharacter.character_id,
        }
    );
}


function submitChoice(
    choiceId,
) {

    if (!sessionReady) {

        return;
    }


    socket.emit(
        "submit_choice",
        {
            choice_id:
                choiceId,
        }
    );
}


function sendChat() {

    const text =
        chatInput
        .value
        .trim();


    if (
        !text
        || !sessionReady
    ) {

        return;
    }


    socket.emit(
        "send_chat",
        {
            text,
        }
    );


    chatInput.value =
        "";
}


/* =========================================================
   SOCKET EVENTS
========================================================= */

socket.on(
    "connect",
    () => {

        setNetworkStatus(
            "CONNECTED"
        );


        /*
           Socket.IO reconnects automatically after a server restart or
           network interruption, but the new socket id is not associated
           with the adventure until we explicitly resume it. Without this
           step the browser can still LOOK like it is inside the room while
           every game action reaches the server from an unbound socket.

           Rebind the currently viewed Hero/room immediately. The server's
           resume_adventure handler is authoritative and will follow with
           fresh room_state + game_state payloads, which also lets the
           transition/intermission recovery logic reconstruct an in-flight
           turn.
        */
        if (
            currentRoomCode
            && selectedCharacter?.character_id
        ) {

            sessionReady =
                false;


            setStatus(
                "RECONNECTING TO ADVENTURE_"
            );


            socket.emit(
                "resume_adventure",
                {
                    room_code:
                        currentRoomCode,

                    character_id:
                        selectedCharacter.character_id,
                }
            );


            return;
        }


        if (
            !currentRoomCode
        ) {

            setStatus(
                "GAME NETWORK ONLINE_"
            );
        }
    }
);


socket.on(
    "disconnect",
    () => {

        sessionReady =
            false;


        setNetworkStatus(
            "DISCONNECTED"
        );
    }
);


socket.on(
    "room_joined",
    data => {

        const character =
            characters.find(
                item =>
                    item.character_id
                    === data.character_id
            );


        if (character) {

            selectedCharacter =
                character;


            localStorage.setItem(
                CHARACTER_STORAGE_KEY,
                character.character_id
            );


            setCharacterStatus(
                character.name.toUpperCase()
            );
        }


        sessionReady =
            true;


        enterRoomUI(
            data.room.code
        );
    }
);


socket.on(
    "resume_success",
    data => {

        const character =
            characters.find(
                item =>
                    item.character_id
                    === data.character_id
            );


        if (character) {

            selectedCharacter =
                character;


            setCharacterStatus(
                character.name.toUpperCase()
            );
        }


        sessionReady =
            true;


        enterRoomUI(
            data.room.code
        );
    }
);


socket.on(
    "room_state",
    room => {

        playerCountElement.textContent =
            `${String(
                room.player_count
            ).padStart(
                2,
                "0"
            )} / ${String(
                room.max_players
            ).padStart(
                2,
                "0"
            )}`;

        currentRoomPlayers =
            room.players 
            ?? [];

        renderPlayers(
            room.players
            ?? [],
            
        );
    }
);


socket.on(
    "game_state",
    state => {

        renderGameState(
            state
        );
    }
);


socket.on(
    "choice_accepted",
    data => {

        setStatus(
            `CHOICE LOCKED — ${data.choice_label}_`
        );
    }
);


socket.on(
    "turn_resolved",
    data => {

        showTurnResolution(
            data
        );
    }
);


socket.on(
    "chat_history",
    data => {

        clearChatMessages();


        for (
            const message
            of (
                data.messages
                ?? []
            )
        ) {

            appendChatMessage(
                message
            );
        }
    }
);


socket.on(
    "chat_message",
    message => {

        appendChatMessage(
            message
        );
    }
);


socket.on(
    "room_error",
    data => {

        setStatus(
            `ROOM ERROR — ${data.message}_`
        );
    }
);


socket.on(
    "game_error",
    data => {

        setStatus(
            `GAME ERROR — ${data.message}_`
        );
    }
);


/* =========================================================
   EVENTS
========================================================= */

setupPasswordToggle(
    loginPasswordInput,
    loginPasswordToggle,
);


setupPasswordToggle(
    registerPasswordInput,
    registerPasswordToggle,
);


setupPasswordToggle(
    registerPasswordConfirmInput,
    registerPasswordConfirmToggle,
);


loginButton.addEventListener(
    "click",
    login
);


headerLoginButton?.addEventListener(
    "click",
    () => {

        openAuthModal(
            "login"
        );
    }
);


headerRegisterButton?.addEventListener(
    "click",
    () => {

        openAuthModal(
            "register"
        );
    }
);


showRegisterButton.addEventListener(
    "click",
    showRegisterView
);


registerButton.addEventListener(
    "click",
    register
);


showLoginButton.addEventListener(
    "click",
    showLoginView
);


accountHeroHomeButton
?.addEventListener(
    "click",
    () => {

        closeAccountManager();


        selectedCharacterSummary
        ?.click();
    }
);


logoutButton.addEventListener(
    "click",
    logout
);


showCharacterBuilderButton
.addEventListener(
    "click",
    openCharacterBuilder
);


cancelCharacterBuilderButton
.addEventListener(
    "click",
    closeCharacterBuilder
);


newCharacterNameInput
.addEventListener(
    "input",
    refreshCharacterBuilderControls
);


createCharacterButton
.addEventListener(
    "click",
    createCharacter
);


createRoomButton.addEventListener(
    "click",
    createRoom
);


joinRoomButton.addEventListener(
    "click",
    joinRoom
);


roomCodeInput.addEventListener(
    "input",
    () => {

        roomCodeInput.value =
            roomCodeInput
            .value
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ""
            );
    }
);


roomCodeInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key
            === "Enter"
        ) {

            joinRoom();
        }
    }
);


sendChatButton.addEventListener(
    "click",
    sendChat
);


chatInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key
            === "Enter"
        ) {

            sendChat();
        }
    }
);


loginPasswordInput
.addEventListener(
    "keydown",
    event => {

        if (
            event.key
            === "Enter"
        ) {

            login();
        }
    }
);


/* =========================================================
   BOOT
========================================================= */

resetAuthenticatedUI();

checkAuthentication();