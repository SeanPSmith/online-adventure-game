"use strict";

(() => {

    const CHARACTER_LIMIT =
        5;


    function safeCharacters() {

        try {

            return (
                typeof characters !== "undefined"
                    && Array.isArray(
                        characters
                    )
            )
                ? characters
                : [];

        } catch {

            return [];
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


    function safeAdventureForCharacter(
        characterId,
    ) {

        try {

            if (
                typeof adventureForCharacter
                === "function"
            ) {

                return adventureForCharacter(
                    characterId
                );
            }

        } catch {
            // no-op
        }


        return null;
    }


    function characterPanel() {

        return document.getElementById(
            "character-panel"
        );
    }


    function characterList() {

        return document.getElementById(
            "character-list"
        );
    }


    function builderLaunch() {

        return document.getElementById(
            "show-character-builder-button"
        );
    }


    function ensurePortalHeader() {

        const panel =
            characterPanel();


        if (
            !panel
        ) {

            return null;
        }


        let header =
            panel.querySelector(
                ".character-portal-header"
            );


        if (
            header
        ) {

            return header;
        }


        header =
            document.createElement(
                "div"
            );


        header.className =
            "character-portal-header";


        const titleWrap =
            document.createElement(
                "div"
            );


        const kicker =
            document.createElement(
                "div"
            );


        kicker.className =
            "character-portal-kicker";

        kicker.textContent =
            "CHARACTER MANAGEMENT";


        const count =
            document.createElement(
                "strong"
            );


        count.className =
            "character-portal-count";


        titleWrap.append(
            kicker,
            count,
        );


        const create =
            document.createElement(
                "button"
            );


        create.type =
            "button";

        create.className =
            (
                "terminal-button primary "
                + "character-portal-create"
            );


        create.addEventListener(
            "click",
            () => {

                const launch =
                    builderLaunch();


                if (
                    launch
                    && !launch.disabled
                ) {

                    launch.click();
                }
            }
        );


        header.append(
            titleWrap,
            create,
        );


        const list =
            characterList();


        panel.insertBefore(
            header,
            list
        );


        return header;
    }


    function characterByCard(
        card,
    ) {

        const cards =
            Array.from(
                characterList()
                ?.querySelectorAll(
                    ".character-card"
                )
                ?? []
            );


        const index =
            cards.indexOf(
                card
            );


        return safeCharacters()[
            index
        ]
        ?? null;
    }


    function findButton(
        card,
        label,
    ) {

        const expected =
            label.toUpperCase();


        return Array.from(
            card.querySelectorAll(
                "button"
            )
        )
        .find(
            button =>
                button.textContent
                .trim()
                .toUpperCase()
                === expected
        )
        ?? null;
    }


    function formatMap(
        value,
    ) {

        if (
            !value
            || typeof value
                !== "object"
        ) {

            return "—";
        }


        const rows =
            Object.entries(
                value
            )
            .map(
                (
                    [
                        key,
                        amount,
                    ]
                ) =>
                    (
                        `${String(
                            key
                        ).toUpperCase()}`
                        + ` ${amount}`
                    )
            );


        return (
            rows.length
                ? rows.join(
                    "  //  "
                )
                : "—"
        );
    }


    function showCharacterSheet(
        character,
        card,
    ) {

        document.querySelector(
            ".character-sheet-backdrop"
        )?.remove();


        const backdrop =
            document.createElement(
                "div"
            );


        backdrop.className =
            "character-sheet-backdrop";


        const sheet =
            document.createElement(
                "section"
            );


        sheet.className =
            "character-sheet-window";


        const selected =
            safeSelectedCharacter();


        const isSelected =
            Boolean(
                selected
                && selected.character_id
                    === character.character_id
            );


        const adventure =
            safeAdventureForCharacter(
                character.character_id
            );


        const title =
            document.createElement(
                "div"
            );


        title.className =
            "character-sheet-title";


        title.textContent =
            character.name.toUpperCase();


        const meta =
            document.createElement(
                "div"
            );


        meta.className =
            "character-sheet-meta";


        meta.textContent =
            (
                `LEVEL ${character.level}`
                + `  //  HP ${character.health}/${character.max_health}`
                + `  //  XP ${character.experience}`
            );


        const stats =
            document.createElement(
                "div"
            );


        stats.className =
            "character-sheet-block";


        stats.innerHTML =
            (
                "<span>CORE STATS</span>"
                + `<p>${formatMap(
                    character.stats
                )}</p>`
            );


        const skills =
            document.createElement(
                "div"
            );


        skills.className =
            "character-sheet-block";


        skills.innerHTML =
            (
                "<span>SKILLS</span>"
                + `<p>${formatMap(
                    character.skills
                )}</p>`
            );


        const lifecycle =
            document.createElement(
                "div"
            );


        lifecycle.className =
            "character-sheet-lifecycle";


        const select =
            document.createElement(
                "button"
            );


        select.type =
            "button";

        select.className =
            "terminal-button primary";


        select.textContent =
            (
                isSelected
                    ? "ACTIVE CHARACTER"
                    : "SELECT CHARACTER"
            );


        select.disabled =
            isSelected;


        select.addEventListener(
            "click",
            () => {

                findButton(
                    card,
                    "SELECT"
                )?.click();


                backdrop.remove();
            }
        );


        const remove =
            document.createElement(
                "button"
            );


        remove.type =
            "button";

        remove.className =
            "terminal-button danger";


        remove.textContent =
            "DELETE CHARACTER";


        remove.disabled =
            Boolean(
                adventure
            );


        remove.title =
            (
                adventure
                    ? "Leave the active adventure before deleting this character."
                    : ""
            );


        remove.addEventListener(
            "click",
            () => {

                findButton(
                    card,
                    "DELETE"
                )?.click();


                backdrop.remove();
            }
        );


        const close =
            document.createElement(
                "button"
            );


        close.type =
            "button";

        close.className =
            "terminal-button";


        close.textContent =
            "CLOSE";


        close.addEventListener(
            "click",
            () => {

                backdrop.remove();
            }
        );


        lifecycle.append(
            select,
            remove,
            close,
        );


        const adventureInfo =
            document.createElement(
                "div"
            );


        adventureInfo.className =
            "character-sheet-adventure";


        adventureInfo.textContent =
            (
                adventure
                    ? (
                        "ACTIVE ADVENTURE // "
                        + `${
                            adventure.adventure_title
                            ?? adventure.scene_title
                            ?? "UNKNOWN"
                        }`
                    )
                    : "AVAILABLE FOR ADVENTURE"
            );


        sheet.append(
            title,
            meta,
            stats,
            skills,
            adventureInfo,
            lifecycle,
        );


        backdrop.appendChild(
            sheet
        );


        backdrop.addEventListener(
            "pointerdown",
            event => {

                if (
                    event.target
                    === backdrop
                ) {

                    backdrop.remove();
                }
            }
        );


        document.body.appendChild(
            backdrop
        );
    }


    function decorateCard(
        card,
        character,
    ) {

        if (
            card.dataset.portalDecorated
            === "1"
        ) {

            return;
        }


        card.dataset.portalDecorated =
            "1";


        const oldButtons =
            card.querySelector(
                ".button-row"
            );


        if (
            oldButtons
        ) {

            oldButtons.hidden =
                true;
        }


        const actions =
            document.createElement(
                "div"
            );


        actions.className =
            "character-portal-row-actions";


        const open =
            document.createElement(
                "button"
            );


        open.type =
            "button";

        open.className =
            "terminal-button";


        open.textContent =
            "VIEW CHARACTER";


        open.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                showCharacterSheet(
                    character,
                    card
                );
            }
        );


        const quickSelect =
            document.createElement(
                "button"
            );


        quickSelect.type =
            "button";

        quickSelect.className =
            "terminal-button primary";


        const selected =
            safeSelectedCharacter();


        const isSelected =
            Boolean(
                selected
                && selected.character_id
                    === character.character_id
            );


        quickSelect.textContent =
            (
                isSelected
                    ? "ACTIVE"
                    : "SELECT"
            );


        quickSelect.disabled =
            isSelected;


        quickSelect.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                findButton(
                    card,
                    "SELECT"
                )?.click();
            }
        );


        actions.append(
            open,
            quickSelect,
        );


        card.appendChild(
            actions
        );


        card.addEventListener(
            "dblclick",
            () => {

                showCharacterSheet(
                    character,
                    card
                );
            }
        );
    }


    function enforceClientLimit() {

        const list =
            safeCharacters();


        const launch =
            builderLaunch();


        const atLimit =
            list.length
            >= CHARACTER_LIMIT;


        if (
            launch
        ) {

            launch.disabled =
                atLimit;


            launch.hidden =
                list.length > 0;


            launch.title =
                (
                    atLimit
                        ? `Character limit reached (${CHARACTER_LIMIT}).`
                        : ""
                );
        }


        const header =
            ensurePortalHeader();


        if (
            header
        ) {

            const count =
                header.querySelector(
                    ".character-portal-count"
                );


            const create =
                header.querySelector(
                    ".character-portal-create"
                );


            count.textContent =
                (
                    `${list.length} / ${CHARACTER_LIMIT} SLOTS`
                );


            create.textContent =
                (
                    list.length === 0
                        ? "CREATE NEW CHARACTER"
                        : "+ CREATE NEW"
                );


            create.disabled =
                atLimit;


            create.title =
                (
                    atLimit
                        ? `Character limit reached (${CHARACTER_LIMIT}).`
                        : ""
                );
        }
    }


    function renderPortal() {

        const listElement =
            characterList();


        if (
            !listElement
        ) {

            return;
        }


        const list =
            safeCharacters();


        ensurePortalHeader();


        const cards =
            Array.from(
                listElement.querySelectorAll(
                    ".character-card"
                )
            );


        cards.forEach(
            (
                card,
                index,
            ) => {

                const character =
                    list[
                        index
                    ];


                if (
                    character
                ) {

                    decorateCard(
                        card,
                        character
                    );
                }
            }
        );


        listElement.classList.toggle(
            "is-empty",
            list.length
                === 0
        );


        enforceClientLimit();
    }


    function setupLimitGuard() {

        const launch =
            builderLaunch();


        if (
            !launch
        ) {

            return;
        }


        launch.addEventListener(
            "click",
            event => {

                if (
                    safeCharacters()
                    .length
                    < CHARACTER_LIMIT
                ) {

                    return;
                }


                event.preventDefault();

                event.stopPropagation();

                event.stopImmediatePropagation();


                const message =
                    document.getElementById(
                        "character-message"
                    );


                if (
                    message
                ) {

                    message.textContent =
                        (
                            `CHARACTER LIMIT REACHED — `
                            + `${CHARACTER_LIMIT} / ${CHARACTER_LIMIT}_`
                        );


                    message.classList.add(
                        "is-error"
                    );
                }
            },
            true
        );
    }


    function boot() {

        const list =
            characterList();


        if (
            !list
        ) {

            return;
        }


        renderPortal();

        setupLimitGuard();


        if (
            "MutationObserver"
            in window
        ) {

            const observer =
                new MutationObserver(
                    () => {

                        window.requestAnimationFrame(
                            renderPortal
                        );
                    }
                );


            observer.observe(
                list,
                {
                    childList:
                        true,

                    subtree:
                        true,
                }
            );
        }
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
