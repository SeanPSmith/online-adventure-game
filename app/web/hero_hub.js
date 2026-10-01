"use strict";

(() => {

    const CHARACTER_LIMIT =
        5;


    const ui = {
        pickerButton:
            document.getElementById(
                "hero-picker-button"
            ),

        pickerName:
            document.getElementById(
                "hero-picker-name"
            ),

        pickerMenu:
            document.getElementById(
                "hero-picker-menu"
            ),

        nativeSelect:
            document.getElementById(
                "hero-quick-select"
            ),

        characterPanel:
            document.getElementById(
                "character-panel"
            ),

        builderPanel:
            document.getElementById(
                "character-builder-panel"
            ),

        lobbyPanel:
            document.getElementById(
                "lobby-panel"
            ),

        roomPanel:
            document.getElementById(
                "room-panel"
            ),

        gamePanel:
            document.getElementById(
                "game-panel"
            ),

        chatPanel:
            document.getElementById(
                "chat-panel"
            ),

        workspace:
            document.querySelector(
                ".adventure-workspace"
            ),

        homeName:
            document.getElementById(
                "hero-home-name"
            ),

        homeMeta:
            document.getElementById(
                "hero-home-meta"
            ),

        homeMission:
            document.getElementById(
                "hero-home-mission"
            ),

        homeBack:
            document.getElementById(
                "hero-home-back-button"
            ),

        tabs:
            document.getElementById(
                "hero-home-tabs"
            ),

        characterView:
            document.getElementById(
                "hero-home-character"
            ),

        statsView:
            document.getElementById(
                "hero-home-stats"
            ),

        storyView:
            document.getElementById(
                "hero-home-story"
            ),

        empty:
            document.getElementById(
                "hero-home-empty"
            ),

        emptyCreate:
            document.getElementById(
                "hero-home-empty-create"
            ),

        builderLaunch:
            document.getElementById(
                "show-character-builder-button"
            ),

        selectedLobbyHero:
            document.getElementById(
                "selected-character-summary"
            ),
    };


    const state = {
        dropdownOpen:
            false,

        activeTab:
            "character",

        completedStories:
            new Map(),

        completedStoriesLoading:
            new Set(),

        completedStoriesErrors:
            new Set(),

        lifetimeStats:
            new Map(),

        lifetimeStatsLoading:
            new Set(),

        lifetimeStatsErrors:
            new Set(),
    };


    function gameCharacters() {

        try {

            return (
                Array.isArray(
                    characters
                )
                    ? characters
                    : []
            );

        } catch {

            return [];
        }
    }


    function activeHero() {

        try {

            return (
                selectedCharacter
                ?? null
            );

        } catch {

            return null;
        }
    }


    function activeAdventures() {

        try {

            return (
                Array.isArray(
                    adventures
                )
                    ? adventures
                    : []
            );

        } catch {

            return [];
        }
    }


    function roomCode() {

        try {

            return (
                currentRoomCode
                ?? null
            );

        } catch {

            return null;
        }
    }


    function adventureForHero(
        characterId,
    ) {

        try {

            if (
                typeof adventureForCharacter
                === "function"
            ) {

                return (
                    adventureForCharacter(
                        characterId
                    )
                    ?? null
                );
            }

        } catch {
            // Fall through.
        }


        return (
            activeAdventures()
            .find(
                adventure =>
                    adventure.character_id
                    === characterId
            )
            ?? null
        );
    }


    function chooseHero(
        characterId,
    ) {

        if (
            typeof selectCharacter
            !== "function"
        ) {

            return;
        }


        selectCharacter(
            characterId
        );


        closePicker();

        render();
    }


    function openBuilder() {

        if (
            gameCharacters().length
            >= CHARACTER_LIMIT
        ) {

            return;
        }


        const returnTarget =
            document.body.classList.contains(
                "view-hero-home"
            )
                ? "hero-home"
                : "lobby";


        closePicker();

        closeHeroHome(
            {
                revealDestination:
                    false,
            }
        );


        if (
            typeof openCharacterBuilder
            === "function"
        ) {

            openCharacterBuilder(
                returnTarget
            );

        } else {

            ui.builderLaunch?.click();
        }
    }


    function openPicker() {

        if (
            gameCharacters().length
            === 0
        ) {

            openBuilder();

            return;
        }


        state.dropdownOpen =
            true;


        ui.pickerMenu.hidden =
            false;


        ui.pickerButton.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    function closePicker() {

        state.dropdownOpen =
            false;


        if (
            ui.pickerMenu
        ) {

            ui.pickerMenu.hidden =
                true;
        }


        ui.pickerButton?.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    function togglePicker() {

        if (
            state.dropdownOpen
        ) {

            closePicker();

        } else {

            openPicker();
        }
    }


    function renderPicker() {

        if (
            !ui.pickerButton
            || !ui.pickerMenu
            || !ui.pickerName
        ) {

            return;
        }


        const heroes =
            gameCharacters();

        const selected =
            activeHero();


        ui.pickerMenu.replaceChildren();


        if (
            ui.nativeSelect
        ) {

            ui.nativeSelect.replaceChildren();


            for (
                const hero
                of heroes
            ) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    hero.character_id;

                option.textContent =
                    hero.name;


                ui.nativeSelect.appendChild(
                    option
                );
            }


            ui.nativeSelect.value =
                selected?.character_id
                ?? "";
        }


        if (
            heroes.length === 0
        ) {

            ui.pickerName.textContent =
                "+ ADD CHARACTER TO PLAY";


            ui.pickerButton.classList.add(
                "is-empty"
            );


            ui.pickerButton.classList.remove(
                "is-on-mission"
            );


            closePicker();

            return;
        }


        ui.pickerButton.classList.remove(
            "is-empty"
        );


        const selectedAdventure =
            (
                selected
                    ? adventureForHero(
                        selected.character_id
                    )
                    : null
            );


        ui.pickerName.textContent =
            (
                selected
                    ? (
                        selected.name.toUpperCase()
                        + (
                            selectedAdventure
                                ? " // ON MISSION"
                                : ""
                        )
                    )
                    : "SELECT HERO_"
            );


        ui.pickerButton.classList.toggle(
            "is-on-mission",
            Boolean(
                selectedAdventure
            )
        );


        for (
            const hero
            of heroes
        ) {

            const adventure =
                adventureForHero(
                    hero.character_id
                );


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "hero-picker-row";


            const choose =
                document.createElement(
                    "button"
                );


            choose.type =
                "button";

            choose.className =
                "hero-picker-choice";


            if (
                selected?.character_id
                === hero.character_id
            ) {

                choose.classList.add(
                    "is-selected"
                );
            }


            if (
                adventure
            ) {

                choose.classList.add(
                    "is-on-mission"
                );
            }


            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                hero.name.toUpperCase();


            const meta =
                document.createElement(
                    "span"
                );


            meta.textContent =
                (
                    `LVL ${hero.level}`
                    + ` // HP ${hero.health}/${hero.max_health}`
                    + (
                        adventure
                            ? " // ON MISSION"
                            : ""
                    )
                );


            choose.append(
                name,
                meta,
            );


            choose.addEventListener(
                "click",
                () => {

                    chooseHero(
                        hero.character_id
                    );
                }
            );


            row.appendChild(
                choose
            );


            ui.pickerMenu.appendChild(
                row
            );
        }


        const divider =
            document.createElement(
                "div"
            );


        divider.className =
            "hero-picker-divider";


        if (
            selectedAdventure
        ) {

            const continueAdventure =
                document.createElement(
                    "button"
                );


            continueAdventure.type =
                "button";

            continueAdventure.className =
                "hero-picker-action primary";

            continueAdventure.textContent =
                "CONTINUE ADVENTURE";


            continueAdventure.addEventListener(
                "click",
                () => {

                    closePicker();


                    if (
                        typeof resumeAdventure
                        === "function"
                    ) {

                        resumeAdventure(
                            selectedAdventure
                        );
                    }
                }
            );


            ui.pickerMenu.appendChild(
                continueAdventure
            );
        }


        const home =
            document.createElement(
                "button"
            );


        home.type =
            "button";

        home.className =
            "hero-picker-action";

        home.textContent =
            "OPEN HERO HOME";

        home.disabled =
            !selected;


        home.addEventListener(
            "click",
            () => {

                closePicker();

                openHeroHome();
            }
        );


        const add =
            document.createElement(
                "button"
            );


        add.type =
            "button";

        add.className =
            "hero-picker-action";


        add.textContent =
            (
                heroes.length
                >= CHARACTER_LIMIT
                    ? (
                        "CHARACTER SLOTS FULL"
                        + ` // ${CHARACTER_LIMIT}/${CHARACTER_LIMIT}`
                    )
                    : "+ ADD CHARACTER"
            );


        add.disabled =
            heroes.length
            >= CHARACTER_LIMIT;


        add.addEventListener(
            "click",
            openBuilder
        );


        const slots =
            document.createElement(
                "div"
            );


        slots.className =
            "hero-picker-slots";

        slots.textContent =
            (
                `${heroes.length}`
                + ` / ${CHARACTER_LIMIT}`
                + " CHARACTER SLOTS"
            );


        ui.pickerMenu.append(
            divider,
            home,
            add,
            slots,
        );
    }


    function hidePlayViews() {

        for (
            const element
            of [
                ui.lobbyPanel,
                ui.roomPanel,
                ui.gamePanel,
                ui.chatPanel,
                ui.workspace,
            ]
        ) {

            if (
                element
            ) {

                element.hidden =
                    true;
            }
        }
    }


    function openHeroHome() {

        hidePlayViews();


        if (
            ui.builderPanel
        ) {

            ui.builderPanel.hidden =
                true;
        }


        if (
            ui.characterPanel
        ) {

            ui.characterPanel.hidden =
                false;
        }


        document.body.classList.add(
            "view-hero-home"
        );


        renderHeroHome();


        ui.characterPanel?.scrollIntoView({
            behavior:
                "smooth",

            block:
                "start",
        });
    }


    function closeHeroHome({
        revealDestination =
            true,
    } = {}) {

        document.body.classList.remove(
            "view-hero-home"
        );


        if (
            ui.characterPanel
        ) {

            ui.characterPanel.hidden =
                true;
        }


        if (
            !revealDestination
        ) {

            return;
        }


        if (
            roomCode()
        ) {

            if (
                typeof showAdventureWorkspace
                === "function"
            ) {

                showAdventureWorkspace();

            } else {

                ui.workspace.hidden =
                    false;

                ui.gamePanel.hidden =
                    false;

                ui.chatPanel.hidden =
                    false;
            }

        } else if (
            activeHero()
        ) {

            ui.lobbyPanel.hidden =
                false;
        }
    }


    function setTab(
        tabName,
    ) {

        const validTabs =
            new Set([
                "character",
                "stats",
                "story",
            ]);


        if (
            !validTabs.has(
                tabName
            )
        ) {

            return;
        }


        state.activeTab =
            tabName;


        for (
            const button
            of ui.tabs?.querySelectorAll(
                "[data-hero-tab]"
            )
            ?? []
        ) {

            button.classList.toggle(
                "is-active",
                button.dataset.heroTab
                === tabName
            );
        }


        for (
            const view
            of ui.characterPanel?.querySelectorAll(
                "[data-hero-view]"
            )
            ?? []
        ) {

            view.hidden =
                view.dataset.heroView
                !== tabName;
        }
    }


    function statLine(
        values,
    ) {

        if (
            !values
            || typeof values
                !== "object"
        ) {

            return "—";
        }


        const entries =
            Object.entries(
                values
            );


        return (
            entries.length
                ? entries
                    .map(
                        (
                            [
                                key,
                                value,
                            ]
                        ) =>
                            (
                                `${String(
                                    key
                                ).toUpperCase()} ${value}`
                            )
                    )
                    .join(
                        "  //  "
                    )
                : "—"
        );
    }


    function renderCharacterTab(
        hero,
    ) {

        ui.characterView.replaceChildren();


        const adventure =
            adventureForHero(
                hero.character_id
            );


        const overview =
            document.createElement(
                "section"
            );

        overview.className =
            "hero-sheet-overview";


        const identity =
            document.createElement(
                "div"
            );

        identity.className =
            "hero-sheet-identity";


        const kicker =
            document.createElement(
                "span"
            );

        kicker.className =
            "hero-sheet-kicker";

        kicker.textContent =
            "ACTIVE CHARACTER FILE";


        const heroName =
            document.createElement(
                "strong"
            );

        heroName.className =
            "hero-sheet-name";

        heroName.textContent =
            String(
                hero.name
                ?? "HERO"
            ).toUpperCase();


        const mission =
            document.createElement(
                "span"
            );

        mission.className =
            adventure
                ? "hero-sheet-status is-on-mission"
                : "hero-sheet-status";

        mission.textContent =
            adventure
                ? (
                    "ON MISSION // "
                    + (
                        adventure.adventure_title
                        ?? adventure.scene_title
                        ?? adventure.room_code
                        ?? "ACTIVE ADVENTURE"
                    )
                )
                : "AVAILABLE FOR ADVENTURE";


        identity.append(
            kicker,
            heroName,
            mission,
        );


        const vitals =
            document.createElement(
                "div"
            );

        vitals.className =
            "hero-sheet-vitals";


        const hpMax =
            Number(
                hero.max_health
                ?? 0
            );

        const hpCurrent =
            Number(
                hero.health
                ?? 0
            );

        const hpPercent =
            hpMax > 0
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        (
                            hpCurrent
                            / hpMax
                        )
                        * 100
                    )
                )
                : 0;


        vitals.innerHTML =
            `
            <article class="hero-vital-card">
                <span>LEVEL</span>
                <strong>${hero.level ?? 1}</strong>
            </article>

            <article class="hero-vital-card hero-vital-hp">
                <span>HEALTH</span>
                <strong>${hpCurrent}/${hpMax}</strong>
                <div class="hero-hp-track" aria-hidden="true">
                    <i style="width:${hpPercent}%"></i>
                </div>
            </article>

            <article class="hero-vital-card">
                <span>EXPERIENCE</span>
                <strong>${hero.experience ?? 0} XP</strong>
            </article>
            `;


        overview.append(
            identity,
            vitals,
        );


        const detailGrid =
            document.createElement(
                "div"
            );

        detailGrid.className =
            "hero-sheet-detail-grid";


        const buildAttributeSection =
            (
                label,
                values,
                className,
            ) => {

                const section =
                    document.createElement(
                        "section"
                    );

                section.className =
                    `hero-attribute-section ${className}`;


                const heading =
                    document.createElement(
                        "div"
                    );

                heading.className =
                    "hero-attribute-heading";

                heading.textContent =
                    label;


                const grid =
                    document.createElement(
                        "div"
                    );

                grid.className =
                    "hero-attribute-grid";


                const entries =
                    Object.entries(
                        values
                        ?? {}
                    );


                if (
                    entries.length === 0
                ) {

                    const empty =
                        document.createElement(
                            "div"
                        );

                    empty.className =
                        "hero-attribute-empty";

                    empty.textContent =
                        "NO DATA_";

                    grid.appendChild(
                        empty
                    );

                } else {

                    for (
                        const [
                            key,
                            value,
                        ]
                        of entries
                    ) {

                        const item =
                            document.createElement(
                                "div"
                            );

                        item.className =
                            "hero-attribute";


                        const itemLabel =
                            document.createElement(
                                "span"
                            );

                        itemLabel.textContent =
                            String(
                                key
                            )
                            .replaceAll(
                                "_",
                                " "
                            )
                            .toUpperCase();


                        const itemValue =
                            document.createElement(
                                "strong"
                            );

                        itemValue.textContent =
                            String(
                                value
                            );


                        item.append(
                            itemLabel,
                            itemValue,
                        );


                        grid.appendChild(
                            item
                        );
                    }
                }


                section.append(
                    heading,
                    grid,
                );


                return section;
            };


        detailGrid.append(
            buildAttributeSection(
                "CORE STATS",
                hero.stats,
                "stats",
            ),

            buildAttributeSection(
                "SKILLS",
                hero.skills,
                "skills",
            ),
        );


        const lifecycle =
            document.createElement(
                "section"
            );

        lifecycle.className =
            "hero-lifecycle";


        const label =
            document.createElement(
                "div"
            );

        label.className =
            "hero-data-label";

        label.textContent =
            "HERO FILE";


        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "hero-lifecycle-actions";


        const current =
            document.createElement(
                "button"
            );

        current.type =
            "button";

        current.className =
            "terminal-button primary";

        current.textContent =
            "CURRENT HERO";

        current.disabled =
            true;


        const remove =
            document.createElement(
                "button"
            );

        remove.type =
            "button";

        remove.className =
            "terminal-button danger";

        remove.textContent =
            "DELETE HERO";

        remove.disabled =
            Boolean(
                adventure
            )
            || Boolean(
                roomCode()
            );


        remove.title =
            adventure
                ? (
                    "Leave this hero's active adventure "
                    + "before deleting the hero."
                )
                : "";


        remove.addEventListener(
            "click",
            async () => {

                if (
                    typeof deleteCharacter
                    !== "function"
                ) {

                    return;
                }


                await deleteCharacter(
                    hero
                );


                render();


                if (
                    gameCharacters().length
                    === 0
                ) {

                    openHeroHome();
                }
            }
        );


        actions.append(
            current,
            remove,
        );


        lifecycle.append(
            label,
            actions,
        );


        ui.characterView.append(
            overview,
            detailGrid,
            lifecycle,
        );
    }


    function renderStatsTab(
        hero,
    ) {

        const characterId =
            hero.character_id;


        if (
            !state.lifetimeStats.has(
                characterId
            )
        ) {

            ui.statsView.innerHTML =
                `
                <div class="hero-tab-intro">
                    ${
                        state.lifetimeStatsErrors.has(
                            characterId
                        )
                            ? "COULD NOT LOAD LIFETIME STATS_"
                            : "LOADING LIFETIME STATS_"
                    }
                </div>
                `;


            if (
                !state.lifetimeStatsErrors.has(
                    characterId
                )
            ) {

                void loadLifetimeStats(
                    characterId
                );
            }


            return;
        }


        const stats =
            state.lifetimeStats.get(
                characterId
            )
            ?? {};


        const achievements =
            Array.isArray(
                stats.achievements
            )
                ? stats.achievements
                : [];


        const checksTotal =
            Number(
                stats.checks_total
                ?? 0
            );

        const criticals =
            Number(
                stats.critical_successes
                ?? 0
            )
            + Number(
                stats.critical_failures
                ?? 0
            );


        ui.statsView.innerHTML =
            `
            <div class="hero-tab-intro">
                Permanent totals recorded from completed adventures.
            </div>

            <div class="hero-stat-grid">
                <article>
                    <span>ADVENTURES COMPLETED</span>
                    <strong>${stats.adventures_completed ?? 0}</strong>
                </article>

                <article>
                    <span>CHECKS / CRITICALS</span>
                    <strong>${checksTotal} / ${criticals}</strong>
                </article>

                <article>
                    <span>INTERMISSION WINS</span>
                    <strong>${stats.intermission_wins ?? 0}</strong>
                </article>

                <article>
                    <span>PLAY STREAK</span>
                    <strong>${stats.longest_play_streak ?? 0} DAY${Number(stats.longest_play_streak ?? 0) === 1 ? "" : "S"}</strong>
                </article>
            </div>

            <section class="hero-achievement-list">
                <div class="hero-data-label">ACHIEVEMENTS</div>

                ${
                    achievements.map(
                        achievement => `
                            <div class="hero-achievement-row ${achievement.unlocked ? "is-unlocked" : ""}">
                                <span>[ ${achievement.unlocked ? "UNLOCKED" : "LOCKED"} ]</span>
                                <strong>${achievement.name}</strong>
                                <small>${achievement.description}</small>
                            </div>
                        `
                    ).join(
                        ""
                    )
                }
            </section>
            `;
    }


    async function loadLifetimeStats(
        characterId,
        {
            force =
                false,
        } = {},
    ) {

        if (
            !characterId
        ) {

            return;
        }


        if (
            !force
            && (
                state.lifetimeStats.has(
                    characterId
                )
                || state.lifetimeStatsLoading.has(
                    characterId
                )
            )
        ) {

            return;
        }


        state.lifetimeStatsLoading.add(
            characterId
        );

        state.lifetimeStatsErrors.delete(
            characterId
        );


        try {

            const response =
                await apiRequest(
                    `/api/characters/${characterId}/stats`,
                    {
                        method:
                            "GET",
                    }
                );


            state.lifetimeStats.set(
                characterId,
                response
                ?? {}
            );


        } catch {

            state.lifetimeStatsErrors.add(
                characterId
            );

        } finally {

            state.lifetimeStatsLoading.delete(
                characterId
            );


            const current =
                activeHero();


            if (
                current?.character_id
                === characterId
            ) {

                renderStatsTab(
                    current
                );


                setTab(
                    state.activeTab
                );
            }
        }
    }


    async function loadCompletedStories(
        characterId,
        {
            force =
                false,
        } = {},
    ) {

        if (
            !characterId
        ) {

            return;
        }


        if (
            !force
            && (
                state.completedStories.has(
                    characterId
                )
                || state.completedStoriesLoading.has(
                    characterId
                )
            )
        ) {

            return;
        }


        state.completedStoriesLoading.add(
            characterId
        );

        state.completedStoriesErrors.delete(
            characterId
        );


        try {

            const response =
                await apiRequest(
                    `/api/characters/${characterId}/stories`,
                    {
                        method:
                            "GET",
                    }
                );


            state.completedStories.set(
                characterId,
                Array.isArray(
                    response?.stories
                )
                    ? response.stories
                    : []
            );


        } catch {

            state.completedStoriesErrors.add(
                characterId
            );

        } finally {

            state.completedStoriesLoading.delete(
                characterId
            );


            const current =
                activeHero();


            if (
                current?.character_id
                === characterId
            ) {

                renderStoryTab(
                    current
                );


                setTab(
                    state.activeTab
                );
            }
        }
    }


    function renderStoryTab(
        hero,
    ) {

        ui.storyView.replaceChildren();


        const intro =
            document.createElement(
                "div"
            );


        intro.className =
            "hero-tab-intro";

        intro.textContent =
            (
                "Your Hero Chronicle keeps the story you are playing now "
                + "and the adventures this hero has already survived."
            );


        ui.storyView.appendChild(
            intro
        );


        const activeHeading =
            document.createElement(
                "div"
            );

        activeHeading.className =
            "hero-story-section-title current";

        activeHeading.textContent =
            "CURRENT STORY";


        ui.storyView.appendChild(
            activeHeading
        );


        const activeStories =
            activeAdventures()
            .filter(
                adventure =>
                    adventure.character_id
                    === hero.character_id
            );


        if (
            activeStories.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );


            empty.className =
                "hero-story-empty";

            empty.textContent =
                "NO ACTIVE STORY FOR THIS HERO_";


            ui.storyView.appendChild(
                empty
            );

        } else {

            for (
                const story
                of activeStories
            ) {

                const card =
                    document.createElement(
                        "article"
                    );


                card.className =
                    "hero-story-card is-current-mission";


                const title =
                    document.createElement(
                        "strong"
                    );


                title.textContent =
                    story.adventure_title
                    ?? "CURRENT ADVENTURE";


                const scene =
                    document.createElement(
                        "span"
                    );


                scene.textContent =
                    (
                        `TURN ${story.turn_number ?? "?"}`
                        + ` // ${story.scene_title ?? "CURRENT SCENE"}`
                    );


                const room =
                    document.createElement(
                        "small"
                    );


                room.textContent =
                    (
                        "CURRENT MISSION"
                        + (
                            story.room_code
                                ? ` // ROOM ${story.room_code}`
                                : ""
                        )
                    );


                card.append(
                    title,
                    scene,
                    room,
                );


                ui.storyView.appendChild(
                    card
                );
            }
        }


        const completedHeading =
            document.createElement(
                "div"
            );

        completedHeading.className =
            "hero-story-section-title completed";

        completedHeading.textContent =
            "COMPLETED STORIES";


        ui.storyView.appendChild(
            completedHeading
        );


        if (
            !state.completedStories.has(
                hero.character_id
            )
        ) {

            const loading =
                document.createElement(
                    "div"
                );


            loading.className =
                "hero-story-empty";

            loading.textContent =
                state.completedStoriesErrors.has(
                    hero.character_id
                )
                    ? "COULD NOT LOAD CHRONICLE_"
                    : "LOADING CHRONICLE_";


            ui.storyView.appendChild(
                loading
            );


            if (
                !state.completedStoriesErrors.has(
                    hero.character_id
                )
            ) {

                void loadCompletedStories(
                    hero.character_id
                );
            }


            return;
        }


        const completedStories =
            state.completedStories.get(
                hero.character_id
            )
            ?? [];


        if (
            completedStories.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );


            empty.className =
                "hero-story-empty";

            empty.textContent =
                "NO COMPLETED STORIES YET_";


            ui.storyView.appendChild(
                empty
            );

            return;
        }


        for (
            const story
            of completedStories
        ) {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "hero-story-card is-completed-story";


            const header =
                document.createElement(
                    "div"
                );

            header.className =
                "hero-story-completed-header";


            const title =
                document.createElement(
                    "strong"
                );

            title.textContent =
                story.adventure_title
                ?? "COMPLETED ADVENTURE";


            const badge =
                document.createElement(
                    "span"
                );

            badge.className =
                "hero-story-complete-badge";

            badge.textContent =
                "COMPLETE";


            header.append(
                title,
                badge,
            );


            const ending =
                document.createElement(
                    "div"
                );

            ending.className =
                "hero-story-ending";

            ending.textContent =
                story.ending_label
                    ? `ENDING // ${story.ending_label}`
                    : "ENDING RECORDED";


            const meta =
                document.createElement(
                    "div"
                );

            meta.className =
                "hero-story-completed-meta";


            const partnerNames =
                (
                    Array.isArray(
                        story.players
                    )
                        ? story.players
                            .filter(
                                player =>
                                    player.character_id
                                    !== hero.character_id
                            )
                            .map(
                                player =>
                                    player.character_name
                            )
                            .filter(
                                Boolean
                            )
                        : []
                );


            meta.textContent =
                (
                    `${story.turn_count ?? "?"} TURNS`
                    + (
                        partnerNames.length
                            ? ` // WITH ${partnerNames.join(", ").toUpperCase()}`
                            : ""
                    )
                );


            const recap =
                document.createElement(
                    "p"
                );

            recap.className =
                "hero-story-recap";

            recap.textContent =
                (
                    story.final_resolution
                    || story.recap
                    || "The story is complete."
                );


            const footer =
                document.createElement(
                    "small"
                );

            footer.className =
                "hero-story-completed-footer";


            const completedDate =
                story.completed_at
                    ? new Date(
                        `${story.completed_at}Z`
                    )
                    : null;


            footer.textContent =
                (
                    completedDate
                    && !Number.isNaN(
                        completedDate.getTime()
                    )
                )
                    ? `COMPLETED ${completedDate.toLocaleDateString()}`
                    : "COMPLETED";


            card.append(
                header,
                ending,
                meta,
                recap,
                footer,
            );


            ui.storyView.appendChild(
                card
            );
        }
    }


    function renderHeroHome() {

        if (
            !ui.characterPanel
        ) {

            return;
        }


        const hero =
            activeHero();


        if (
            !hero
        ) {

            ui.homeName.textContent =
                "NO HERO_";

            ui.homeMeta.textContent =
                "";

            ui.homeMission.hidden =
                true;

            ui.tabs.hidden =
                true;

            ui.characterView.hidden =
                true;

            ui.statsView.hidden =
                true;

            ui.storyView.hidden =
                true;

            ui.empty.hidden =
                false;

            return;
        }


        ui.empty.hidden =
            true;

        ui.tabs.hidden =
            false;


        ui.homeName.textContent =
            hero.name.toUpperCase();


        ui.homeMeta.textContent =
            (
                `LEVEL ${hero.level}`
                + ` // HP ${hero.health}/${hero.max_health}`
                + ` // XP ${hero.experience}`
            );


        const adventure =
            adventureForHero(
                hero.character_id
            );


        ui.homeMission.hidden =
            !adventure;


        ui.homeMission.textContent =
            (
                adventure
                    ? (
                        "ON MISSION // "
                        + (
                            adventure.adventure_title
                            ?? adventure.scene_title
                            ?? adventure.room_code
                            ?? "ACTIVE ADVENTURE"
                        )
                    )
                    : ""
            );


        renderCharacterTab(
            hero
        );

        renderStatsTab(
            hero
        );

        renderStoryTab(
            hero
        );

        setTab(
            state.activeTab
        );
    }


    function highlightCurrentMission() {

        const hero =
            activeHero();


        const adventure =
            (
                hero
                    ? adventureForHero(
                        hero.character_id
                    )
                    : null
            );


        ui.selectedLobbyHero
        ?.classList.toggle(
            "is-current-mission",
            Boolean(
                adventure
            )
        );
    }


    function render() {

        renderPicker();

        renderHeroHome();

        highlightCurrentMission();
    }


    function bind() {

        ui.pickerButton?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                togglePicker();
            }
        );


        ui.homeBack?.addEventListener(
            "click",
            () => {

                closeHeroHome();
            }
        );


        ui.selectedLobbyHero?.addEventListener(
            "click",
            () => {

                state.activeTab =
                    "character";

                openHeroHome();
            }
        );


        ui.emptyCreate?.addEventListener(
            "click",
            openBuilder
        );


        ui.tabs?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-hero-tab]"
                    );


                if (
                    !button
                ) {

                    return;
                }


                setTab(
                    button.dataset.heroTab
                );
            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !event.target.closest(
                        ".hero-picker-shell"
                    )
                ) {

                    closePicker();
                }
            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key
                    === "Escape"
                ) {

                    closePicker();
                }
            }
        );


        window.addEventListener(
            "tot:characters-loaded",
            render
        );


        window.addEventListener(
            "tot:character-selected",
            render
        );


        window.addEventListener(
            "tot:adventure-completed",
            event => {

                const characterId =
                    event.detail?.character_id
                    ?? activeHero()?.character_id;


                if (
                    characterId
                ) {

                    state.completedStories.delete(
                        characterId
                    );

                    state.lifetimeStats.delete(
                        characterId
                    );


                    void loadCompletedStories(
                        characterId,
                        {
                            force:
                                true,
                        }
                    );

                    void loadLifetimeStats(
                        characterId,
                        {
                            force:
                                true,
                        }
                    );
                }
            }
        );


        window.addEventListener(
            "focus",
            render
        );
    }


    bind();

    render();

})();
