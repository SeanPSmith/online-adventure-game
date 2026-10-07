"use strict";

const byId = id => document.getElementById(id);

const ui = {
    adventureList: byId("adventure-list"),
    emptyState: byId("empty-state"),
    editor: byId("editor"),
    form: byId("adventure-form"),
    authorUser: byId("author-user"),
    returnToGameLink: byId("return-to-game-link"),
    authorGuideButton: byId("author-guide-button"),
    authorGuideDialog: byId("author-guide-dialog"),
    authorGuideClose: byId("author-guide-close"),
    authorGuideDone: byId("author-guide-done"),
    editorKicker: byId("editor-kicker"),
    editorTitle: byId("editor-title"),
    editorMeta: byId("editor-meta"),
    strengthLabel: byId("strength-label"),
    strengthScore: byId("strength-score"),
    progressFill: byId("progress-fill"),
    sectionStrengths: byId("section-strengths"),
    saveState: byId("save-state"),
    saveButton: byId("save-button"),
    publishButton: byId("publish-button"),
    newVersionButton: byId("new-version-button"),
    versionsButton: byId("versions-button"),
    newBriefButton: byId("new-brief-button"),
    duplicateButton: byId("duplicate-button"),
    archiveButton: byId("archive-button"),
    previewDocumentButton: byId("preview-document-button"),
    previewCompiledButton: byId("preview-compiled-button"),
    worldLinkPanel: byId("world-link-panel"),
    worldLinkTitle: byId("world-link-title"),
    migrationPanel: byId("migration-panel"),
    migrationTitle: byId("migration-title"),
    migrationReviewList: byId("migration-review-list"),
    worldReferencePicker: byId("world-reference-picker"),
    locationsSectionNumber: byId("locations-section-number"),
    locationsSectionTitle: byId("locations-section-title"),
    locationsSectionHelp: byId("locations-section-help"),
    locationsAddButton: byId("locations-add-button"),
    npcsSectionNumber: byId("npcs-section-number"),
    npcsSectionTitle: byId("npcs-section-title"),
    npcsSectionHelp: byId("npcs-section-help"),
    npcsAddButton: byId("npcs-add-button"),
    loreSectionNumber: byId("lore-section-number"),
    loreSectionTitle: byId("lore-section-title"),
    loreSectionHelp: byId("lore-section-help"),
    loreAddButton: byId("lore-add-button"),
    guidanceSectionNumber: byId("guidance-section-number"),
    guidanceSectionTitle: byId("guidance-section-title"),
    forbiddenSectionNumber: byId("forbidden-section-number"),
    forbiddenSectionTitle: byId("forbidden-section-title"),
    forbiddenSectionHelp: byId("forbidden-section-help"),
    forbiddenAddButton: byId("forbidden-add-button"),
    threadsSectionNumber: byId("threads-section-number"),
    threadsSectionTitle: byId("threads-section-title"),
    threadsSectionHelp: byId("threads-section-help"),
    threadsAddButton: byId("threads-add-button"),
    notesSectionNumber: byId("notes-section-number"),

    authorAiDialog: byId("author-ai-dialog"),
    authorAiTitle: byId("author-ai-title"),
    authorAiContext: byId("author-ai-context"),
    authorAiPrompt: byId("author-ai-prompt"),
    authorAiState: byId("author-ai-state"),
    authorAiSubmit: byId("author-ai-submit"),
    authorAiCancel: byId("author-ai-cancel"),
    authorAiClose: byId("author-ai-close"),

    generationPanel: byId("generation-panel"),
    generationProviderName: byId("generation-provider-name"),
    generationProviderModel: byId("generation-provider-model"),
    generationQualityTier: byId("generation-quality-tier"),
    generationQualityHelp: byId("generation-quality-help"),
    generationReadiness: byId("generation-readiness"),
    generationInfoButton: byId("generation-info-button"),
    generationInfoDialog: byId("generation-info-dialog"),
    generationInfoChecklist: byId("generation-info-checklist"),
    generationInfoClose: byId("generation-info-close"),
    generationInfoDone: byId("generation-info-done"),
    generationSpecialRequest: byId("generation-special-request"),
    generateSeedButton: byId("generate-seed-button"),
    refreshGeneratedButton: byId("refresh-generated-button"),
    generatedSeedList: byId("generated-seed-list"),

    newDialog: byId("new-adventure-dialog"),
    newDialogTitle: byId("new-dialog-title"),
    newKind: byId("new-kind"),
    newParentLabel: byId("new-parent-label"),
    newParent: byId("new-parent"),
    newTitle: byId("new-title"),
    newSlug: byId("new-slug"),
    createConfirm: byId("create-adventure-confirm"),
    newCancel: byId("new-cancel"),

    duplicateDialog: byId("duplicate-dialog"),
    duplicateTitle: byId("duplicate-title"),
    duplicateSlug: byId("duplicate-slug"),
    duplicateConfirm: byId("duplicate-confirm"),
    duplicateCancel: byId("duplicate-cancel"),

    versionsDialog: byId("versions-dialog"),
    versionsList: byId("versions-list"),
    versionsClose: byId("versions-close"),

    previewDialog: byId("preview-dialog"),
    previewKicker: byId("preview-kicker"),
    previewTitle: byId("preview-title"),
    previewContent: byId("preview-content"),
    previewClose: byId("preview-close"),

    confirmDialog: byId("author-confirm-dialog"),
    confirmKicker: byId("author-confirm-kicker"),
    confirmTitle: byId("author-confirm-title"),
    confirmMessage: byId("author-confirm-message"),
    confirmAccept: byId("author-confirm-accept"),
    confirmCancel: byId("author-confirm-cancel"),

    toast: byId("toast"),
};

let library = [];
let generatedAdventures = [];
let activeVersion = null;
let activeSource = null;
let dirty = false;
let revision = 0;
let saveInFlight = false;
let autosaveTimer = null;
let toastTimer = null;
let currentFilter = "all";
let createContextParentId = null;
let authorAssistInFlight = false;
let authorAiTarget = null;
let linkedWorldSource = null;
let linkedWorldVersionLabel = "";


/*
   Keep provider presentation in one place.
   The OpenAI integration can replace these values without
   redesigning the Author console.
*/
let generationProviderStatus = {
    provider: "unknown",
    available: false,
    default_quality: "story",
    profiles: [],
};



/* =========================================================
   AUTHOR CONFIRM MODAL
========================================================= */

let confirmResolver = null;

function closeAuthorConfirm(result) {
    if (ui.confirmDialog.open) {
        ui.confirmDialog.close();
    }

    if (confirmResolver) {
        const resolve = confirmResolver;
        confirmResolver = null;
        resolve(result);
    }
}

function authorConfirm({
    kicker = "CONFIRM ACTION",
    title = "Are you sure?",
    message = "",
    confirmLabel = "CONFIRM",
    danger = false,
} = {}) {
    if (confirmResolver) {
        closeAuthorConfirm(false);
    }

    ui.confirmKicker.textContent = kicker;
    ui.confirmTitle.textContent = title;
    ui.confirmMessage.textContent = message;
    ui.confirmAccept.textContent = confirmLabel;

    ui.confirmAccept.classList.toggle("danger", Boolean(danger));
    ui.confirmAccept.classList.toggle("primary", !danger);

    ui.confirmDialog.showModal();

    return new Promise(resolve => {
        confirmResolver = resolve;
    });
}


/* =========================================================
   HTTP
========================================================= */

async function api(url, options = {}) {
    const headers = {
        ...(options.headers ?? {}),
    };

    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        headers["X-TOT-Author-Request"] = "1";
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin",
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error = new Error(
            data?.detail
            ?? `REQUEST FAILED (${response.status})`
        );

        error.status = response.status;
        throw error;
    }

    return data;
}


/* =========================================================
   HELPERS
========================================================= */

function showToast(message, isError = false) {
    ui.toast.textContent = message;
    ui.toast.classList.toggle("error", isError);
    ui.toast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        ui.toast.hidden = true;
    }, 2800);
}


function makeId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36)
        + Math.random().toString(36).slice(2)
    );
}


function slugify(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}


function getPath(object, path) {
    return path.split(".").reduce(
        (current, key) => current?.[key],
        object,
    );
}


function setPath(object, path, value) {
    const parts = path.split(".");
    let current = object;

    for (let index = 0; index < parts.length - 1; index += 1) {
        const key = parts[index];

        if (
            !current[key]
            || typeof current[key] !== "object"
        ) {
            current[key] = {};
        }

        current = current[key];
    }

    current[parts[parts.length - 1]] = value;
}


function formatTime(value) {
    try {
        return new Date(value).toLocaleString();
    } catch {
        return String(value ?? "");
    }
}


/* =========================================================
   STRENGTH
========================================================= */

function textStrength(value, target) {
    const length = String(value ?? "").trim().length;

    if (!length) {
        return 0;
    }

    return Math.min(1, length / target);
}


function listStrength(list, target) {
    if (!Array.isArray(list)) {
        return 0;
    }

    let useful = 0;

    for (const item of list) {
        const text = (
            typeof item === "string"
                ? item
                : Object.values(item ?? {})
                    .filter(value => typeof value === "string")
                    .join(" ")
        ).trim();

        if (text) {
            useful += Math.min(
                1,
                0.35 + text.length / 400,
            );
        }
    }

    return Math.min(1, useful / target);
}


function strengthLabel(score) {
    if (score <= 0) return "EMPTY";
    if (score < 20) return "SPARSE";
    if (score < 40) return "DEVELOPING";
    if (score < 60) return "SOLID";
    if (score < 80) return "ROBUST";
    return "EXTENSIVE";
}


function referenceStrength(source) {
    const refs = source?.world_references ?? {};
    const total = ["locations", "npcs", "lore_secrets"].reduce(
        (sum, key) => sum + (Array.isArray(refs[key]) ? refs[key].length : 0),
        0,
    );
    return Math.min(1, total / 4);
}


function assessStrength(source) {
    const identity = source.identity ?? {};
    const kind = identity.document_kind ?? "world";

    let sections;
    let weights;

    if (kind === "world") {
        const identityFields = [
            identity.title,
            identity.genre,
            identity.tone,
            identity.one_sentence_pitch,
        ];
        const identityScore = (
            identityFields.filter(value => String(value ?? "").trim()).length
            / identityFields.length
        );
        const guidance = source.story_guidance ?? {};
        const guidanceScore = ["humor", "danger", "violence", "weirdness"].reduce(
            (total, key) => total + textStrength(guidance[key], 80),
            0,
        ) / 4;

        sections = {
            identity: identityScore,
            setting: textStrength(source.premise, 300),
            canon: listStrength(source.world_truths, 5),
            rules: listStrength(source.world_rules, 3),
            locations: listStrength(source.locations, 4),
            people: listStrength(source.npcs, 4),
            lore: listStrength(source.lore_secrets, 4),
            boundaries: listStrength(source.forbidden_rules, 3),
            tensions: listStrength(source.story_threads, 3),
            defaults: guidanceScore,
            director_notes: textStrength(source.director_notes, 220),
        };
        weights = {
            identity: 12, setting: 12, canon: 14, rules: 8, locations: 12,
            people: 12, lore: 10, boundaries: 8, tensions: 6, defaults: 4,
            director_notes: 2,
        };
    } else {
        const identityFields = [
            identity.title,
            identity.primary_type,
            identity.one_sentence_pitch,
            identity.player_experience,
        ];
        const identityScore = (
            identityFields.filter(value => String(value ?? "").trim()).length
            / identityFields.length
        );
        const guidance = source.story_guidance ?? {};
        const guidanceScore = [
            "humor", "danger", "violence", "weirdness", "choice_guidance",
        ].reduce(
            (total, key) => total + textStrength(guidance[key], 80),
            0,
        ) / 5;
        const replay = source.replayability ?? {};
        const replayScore = ["variable_elements", "fixed_elements", "notes"].reduce(
            (total, key) => total + textStrength(replay[key], 100),
            0,
        ) / 3;

        sections = {
            identity: identityScore,
            starting_situation: textStrength(source.starting_situation, 280),
            core_goal: textStrength(source.core_goal, 140),
            adventure_facts: listStrength(source.adventure_facts, 4),
            world_references: referenceStrength(source),
            local_locations: listStrength(source.locations, 2),
            local_npcs: listStrength(source.npcs, 2),
            local_secrets: listStrength(source.lore_secrets, 2),
            moments: listStrength(source.moments, 4),
            restrictions: listStrength(source.forbidden_rules, 2),
            guidance: guidanceScore,
            threads: listStrength(source.story_threads, 3),
            replayability: replayScore,
            director_notes: textStrength(source.director_notes, 180),
        };
        weights = {
            identity: 10, starting_situation: 12, core_goal: 10,
            adventure_facts: 8, world_references: 10, local_locations: 6,
            local_npcs: 6, local_secrets: 6, moments: 10, restrictions: 6,
            guidance: 6, threads: 4, replayability: 4, director_notes: 2,
        };
    }

    const score = Math.round(
        Object.entries(weights).reduce(
            (total, [key, weight]) => total + sections[key] * weight,
            0,
        )
    );

    return {
        score,
        label: strengthLabel(score),
        sections: Object.fromEntries(
            Object.entries(sections).map(([key, value]) => {
                const sectionScore = Math.round(value * 100);
                return [key, {score: sectionScore, label: strengthLabel(sectionScore)}];
            })
        ),
    };
}



/* =========================================================
   AI AUTHOR ASSIST
========================================================= */

const authorAssistPlaceholders = {
    world_truths: "Rough canon fact: the mine fire never actually went out...",
    world_rules: "Magic can only cross running water when invited...",
    adventure_facts: "Tonight the bridge is washed out and the phones are dead...",
    locations: "Some field behind a farm; seems ordinary now, matters later...",
    npcs: "An unnamed evil entity; mysterious, cruel, speaks in riddles...",
    lore_secrets: "People think the bell is haunted, but it is warning them...",
    moments: "At some point the power dies while they are separated...",
    forbidden_rules: "Never reveal the creature's true name...",
    story_threads: "A missing delivery keeps resurfacing in increasingly weird ways...",
};


function renderAuthorAssistState(message = null, isError = false) {
    if (!ui.authorAiState) {
        return;
    }

    const available = Boolean(generationProviderStatus.available);

    ui.authorAiState.textContent = (
        message
        ?? (
            authorAssistInFlight
                ? "WRITING_"
                : available
                    ? "READY"
                    : "AI OFFLINE"
        )
    );

    ui.authorAiState.classList.toggle(
        "working",
        authorAssistInFlight && !isError,
    );
    ui.authorAiState.classList.toggle(
        "error",
        Boolean(isError),
    );
}


function scheduleAiAssistedAutosave() {
    dirty = true;
    revision += 1;
    ui.saveState.textContent = "UNSAVED // AI ASSIST";

    clearTimeout(autosaveTimer);

    renderEditor();

    autosaveTimer = setTimeout(() => {
        saveDraft({
            silent: true,
        });
    }, 2200);
}


async function stableSourceForAiAssist() {
    if (
        !activeSource
        || !activeVersion
        || activeVersion.status !== "draft"
    ) {
        throw new Error("AI assistance is only available on a draft.");
    }

    syncFormToSource();

    if (dirty) {
        const saved = await saveDraft({
            silent: true,
        });

        if (!saved) {
            throw new Error(
                "Save the current draft before asking AI to expand it."
            );
        }
    }

    return {
        source: structuredClone(activeSource),
        revisionAtStart: revision,
    };
}


function applyAiAssistResult(result, revisionAtStart, successMessage) {
    if (revision !== revisionAtStart) {
        throw new Error(
            "The draft changed while AI was writing. Nothing was applied; run the helper again."
        );
    }

    if (!result?.source) {
        throw new Error("AI assistance returned no source update.");
    }

    activeSource = structuredClone(result.source);
    scheduleAiAssistedAutosave();

    const changedCount = Array.isArray(result.changed_paths)
        ? result.changed_paths.length
        : 0;

    showToast(
        changedCount
            ? `${successMessage} // ${changedCount} FIELD${changedCount === 1 ? "" : "S"}`
            : "AI FOUND NOTHING TO CHANGE_"
    );
}


function aiHelperAvailable() {
    return Boolean(
        activeVersion?.status === "draft"
        && generationProviderStatus.available
        && !authorAssistInFlight
    );
}


function fieldLabelForPath(path) {
    return String(path ?? "")
        .replaceAll("_", " ")
        .replace(/\[(\d+)\]/g, " $1")
        .split(".")
        .at(-1)
        ?.toUpperCase()
        ?? "FIELD";
}


function openAuthorAiHelper(target) {
    if (!activeVersion || activeVersion.status !== "draft") {
        showToast("AI HELPERS ARE ONLY AVAILABLE ON A DRAFT_", true);
        return;
    }

    if (!generationProviderStatus.available) {
        showToast("THE AI AUTHORING HELPER IS OFFLINE_", true);
        return;
    }

    authorAiTarget = target;
    ui.authorAiPrompt.value = "";

    if (target.kind === "field") {
        ui.authorAiTitle.textContent = `EXPAND // ${target.label}`;
        ui.authorAiContext.textContent = (
            `Only ${target.label} will change. Give the helper one rough sentence; `
            + "it will use the rest of this source as context."
        );
        ui.authorAiPrompt.placeholder = (
            target.placeholder
            || `Rough direction for ${target.label.toLowerCase()}...`
        );
    } else {
        ui.authorAiTitle.textContent = `EXPAND // ${target.label}`;
        ui.authorAiContext.textContent = (
            `This fills blank/default fields inside ${target.label} while preserving `
            + "details you already authored."
        );
        ui.authorAiPrompt.placeholder = (
            authorAssistPlaceholders[target.section]
            ?? "Give the helper one rough sentence about this item..."
        );
    }

    ui.authorAiSubmit.disabled = false;
    renderAuthorAssistState();
    ui.authorAiDialog.showModal();

    requestAnimationFrame(() => {
        ui.authorAiPrompt.focus();
    });
}


function closeAuthorAiHelper() {
    if (authorAssistInFlight) {
        return;
    }

    authorAiTarget = null;
    ui.authorAiDialog.close();
}


async function submitAuthorAiHelper() {
    if (!authorAiTarget || authorAssistInFlight) {
        return;
    }

    const instruction = String(ui.authorAiPrompt.value ?? "").trim();
    if (!instruction) {
        showToast("GIVE THE AI HELPER ONE ROUGH SENTENCE FIRST_", true);
        ui.authorAiPrompt.focus();
        return;
    }

    authorAssistInFlight = true;
    ui.authorAiSubmit.disabled = true;
    renderAuthorAssistState("WRITING_");
    refreshAiHelperButtons();

    try {
        const {
            source,
            revisionAtStart,
        } = await stableSourceForAiAssist();

        const body = {
            source,
            instruction,
            section: (
                authorAiTarget.kind === "field"
                    ? "field"
                    : authorAiTarget.section
            ),
            item_index: (
                authorAiTarget.kind === "item"
                    ? authorAiTarget.index
                    : null
            ),
            field_path: (
                authorAiTarget.kind === "field"
                    ? authorAiTarget.fieldPath
                    : null
            ),
            document_id: activeVersion?.document_id ?? null,
            version_number: activeVersion?.version_number ?? null,
        };

        const result = await api(
            "/api/author/assist",
            {
                method: "POST",
                body: JSON.stringify(body),
            }
        );

        applyAiAssistResult(
            result,
            revisionAtStart,
            authorAiTarget.kind === "field"
                ? `AI UPDATED ${authorAiTarget.label}`
                : `AI EXPANDED ${authorAiTarget.label}`,
        );

        renderAuthorAssistState("APPLIED");
        authorAiTarget = null;
        ui.authorAiDialog.close();

    } catch (error) {
        renderAuthorAssistState("FAILED", true);
        showToast(error.message, true);

    } finally {
        authorAssistInFlight = false;
        ui.authorAiSubmit.disabled = false;
        refreshAiHelperButtons();

        setTimeout(() => {
            renderAuthorAssistState();
        }, 1600);
    }
}


function createAiPill({label = "AI", title, onClick}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "author-ai-pill";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.dataset.authorAiTrigger = "1";
    button.disabled = !aiHelperAvailable();
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });
    return button;
}


function refreshAiHelperButtons() {
    for (const button of document.querySelectorAll("[data-author-ai-trigger]")) {
        button.disabled = !aiHelperAvailable();
    }
}


function decorateSimpleAiFields() {
    if (!ui.form) {
        return;
    }

    for (const control of ui.form.querySelectorAll("[data-path]")) {
        if (
            control.dataset.aiDecorated === "1"
            || !(
                control instanceof HTMLTextAreaElement
                || (
                    control instanceof HTMLInputElement
                    && control.type === "text"
                )
            )
            || control.dataset.path === "identity.slug"
            || control.dataset.path === "private_notes"
            || !controlMatchesActiveDocument(control)
        ) {
            continue;
        }

        const label = control.closest("label");
        if (!label) {
            continue;
        }

        const textNode = Array.from(label.childNodes).find(
            node => node.nodeType === Node.TEXT_NODE && String(node.textContent ?? "").trim()
        );
        const labelText = String(textNode?.textContent ?? fieldLabelForPath(control.dataset.path)).trim();

        if (textNode) {
            textNode.remove();
        }

        const heading = document.createElement("span");
        heading.className = "author-field-heading";

        const title = document.createElement("span");
        title.textContent = labelText;

        const pill = createAiPill({
            title: `AI helper for ${labelText}`,
            onClick: () => openAuthorAiHelper({
                kind: "field",
                fieldPath: control.dataset.path,
                label: labelText.toUpperCase(),
                placeholder: control.placeholder
                    ? `Rough idea: ${control.placeholder}`
                    : "One sentence is enough...",
            }),
        });

        heading.append(title, pill);
        label.insertBefore(heading, control);
        control.dataset.aiDecorated = "1";
    }

    refreshAiHelperButtons();
}


/* =========================================================
   REPEATABLE TEMPLATES
========================================================= */

const templates = {
    world_truths: () => ({
        id: makeId(),
        authority: "canon",
        text: "",
    }),

    world_rules: () => ({
        id: makeId(),
        authority: "canon",
        text: "",
    }),

    adventure_facts: () => ({
        id: makeId(),
        authority: "canon",
        text: "",
    }),

    locations: () => ({
        id: makeId(),
        name: "",
        role: "",
        description: "",
        canon: "",
        ai_freedom: "medium",
        importance: "supporting",
    }),

    npcs: () => ({
        id: makeId(),
        name: "",
        role: "",
        availability: "flexible",
        introduction_timing: "anytime",
        occupation: "",
        appearance: "",
        personality: "",
        wants: "",
        knows: "",
        secret: "",
        relationship: "",
        canonical_facts: "",
        introduction_conditions: "",
        location_constraints: "",
        forbidden_uses: "",
        ai_freedom: "high",
        importance: "supporting",
        recurring: false,
    }),

    lore_secrets: () => ({
        id: makeId(),
        title: "",
        text: "",
        authority: "inspiration",
        who_knows: "",
        importance: "supporting",
        reveal_guidance: "",
        ai_can_alter: true,
    }),

    moments: () => ({
        id: makeId(),
        authority: "preferred",
        text: "",
    }),

    forbidden_rules: () => ({
        id: makeId(),
        authority: "forbidden",
        text: "",
    }),

    story_threads: () => ({
        id: makeId(),
        title: "",
        description: "",
        importance: "supporting",
        recurrence: "optional",
    }),
};


const containers = {
    world_truths: byId("world-truths-list"),
    world_rules: byId("world-rules-list"),
    adventure_facts: byId("adventure-facts-list"),
    locations: byId("locations-list"),
    npcs: byId("npcs-list"),
    lore_secrets: byId("lore-secrets-list"),
    moments: byId("moments-list"),
    forbidden_rules: byId("forbidden-rules-list"),
    story_threads: byId("story-threads-list"),
};


function makeField(
    labelText,
    key,
    value,
    {
        type = "text",
        wide = false,
        options = null,
        rows = 4,
    } = {},
) {
    const label = document.createElement("label");

    if (wide) {
        label.classList.add("wide");
    }

    const heading = document.createElement("span");
    heading.className = "author-field-heading";

    const headingText = document.createElement("span");
    headingText.textContent = labelText;
    heading.appendChild(headingText);
    label.appendChild(heading);

    let control;

    if (options) {
        control = document.createElement("select");

        for (const [optionValue, optionLabel] of options) {
            const option = document.createElement("option");
            option.value = optionValue;
            option.textContent = optionLabel;
            control.appendChild(option);
        }

    } else if (type === "textarea") {
        control = document.createElement("textarea");
        control.rows = rows;

    } else {
        control = document.createElement("input");
        control.type = type;
    }

    if (
        control instanceof HTMLInputElement
        || control instanceof HTMLTextAreaElement
    ) {
        control.spellcheck = true;
    }

    if (type === "checkbox") {
        control.checked = Boolean(value);
    } else {
        control.value = value ?? "";
    }

    label.appendChild(control);

    return {
        label,
        control,
        key,
        labelText,
    };
}


function sectionFields(sectionName, item) {
    const authorityOptions = [
        ["canon", "CANON"],
        ["required", "REQUIRED"],
        ["preferred", "PREFERRED"],
        ["inspiration", "INSPIRATION"],
        ["forbidden", "FORBIDDEN"],
    ];

    const importanceOptions = [
        ["minor", "MINOR"],
        ["supporting", "SUPPORTING"],
        ["major", "MAJOR"],
        ["critical", "CRITICAL"],
    ];

    if (
        sectionName === "world_truths"
        || sectionName === "world_rules"
        || sectionName === "adventure_facts"
        || sectionName === "moments"
        || sectionName === "forbidden_rules"
    ) {
        return [
            makeField(
                "Authority",
                "authority",
                item.authority,
                {options: authorityOptions},
            ),
            makeField(
                "Text",
                "text",
                item.text,
                {
                    type: "textarea",
                    wide: true,
                    rows: 4,
                },
            ),
        ];
    }

    if (sectionName === "locations") {
        return [
            makeField("Name", "name", item.name),
            makeField("Role / Type", "role", item.role),
            makeField(
                "Description",
                "description",
                item.description,
                {
                    type: "textarea",
                    wide: true,
                },
            ),
            makeField(
                "Canonical Facts",
                "canon",
                item.canon,
                {
                    type: "textarea",
                    wide: true,
                },
            ),
            makeField(
                "AI Freedom",
                "ai_freedom",
                item.ai_freedom,
                {
                    options: [
                        ["low", "LOW"],
                        ["medium", "MEDIUM"],
                        ["high", "HIGH"],
                    ],
                },
            ),
            makeField(
                "Importance",
                "importance",
                item.importance,
                {options: importanceOptions},
            ),
        ];
    }

    if (sectionName === "npcs") {
        const isWorld = (activeSource?.identity?.document_kind ?? "world") === "world";
        const fields = [
            makeField("Name", "name", item.name),
            makeField("Role / Archetype", "role", item.role),
            makeField(
                "Occupation / Affiliation",
                "occupation",
                item.occupation,
            ),
            makeField("Appearance", "appearance", item.appearance, {type: "textarea"}),
            makeField("Personality", "personality", item.personality, {type: "textarea"}),
            makeField("What They Want", "wants", item.wants, {type: "textarea"}),
            makeField("What They Know", "knows", item.knows, {type: "textarea"}),
            makeField("Secret", "secret", item.secret, {type: "textarea"}),
            makeField(
                "Relationship / Context",
                "relationship",
                item.relationship,
                {type: "textarea"},
            ),
            makeField(
                "Canonical Facts",
                "canonical_facts",
                item.canonical_facts,
                {type: "textarea", wide: true},
            ),
            makeField(
                "Location Constraints",
                "location_constraints",
                item.location_constraints,
                {type: "textarea", wide: true},
            ),
            makeField(
                "Forbidden Uses",
                "forbidden_uses",
                item.forbidden_uses,
                {type: "textarea", wide: true},
            ),
            makeField(
                "AI Freedom",
                "ai_freedom",
                item.ai_freedom,
                {options: [["low", "LOW"], ["medium", "MEDIUM"], ["high", "HIGH"]]},
            ),
            makeField("Importance", "importance", item.importance, {options: importanceOptions}),
            makeField("Recurring Character", "recurring", item.recurring, {type: "checkbox"}),
        ];

        if (!isWorld) {
            fields.splice(
                2,
                0,
                makeField(
                    "Availability In This Adventure",
                    "availability",
                    item.availability ?? "flexible",
                    {options: [
                        ["flexible", "FLEXIBLE"],
                        ["reserved", "RESERVED"],
                        ["unavailable", "UNAVAILABLE"],
                    ]},
                ),
                makeField(
                    "Introduction Timing",
                    "introduction_timing",
                    item.introduction_timing ?? "anytime",
                    {options: [
                        ["anytime", "ANYTIME"],
                        ["early", "EARLY"],
                        ["mid", "MID"],
                        ["late", "LATE"],
                        ["finale", "FINALE"],
                    ]},
                ),
            );
            fields.splice(
                fields.findIndex(definition => definition.key === "location_constraints"),
                0,
                makeField(
                    "Introduction Conditions",
                    "introduction_conditions",
                    item.introduction_conditions,
                    {type: "textarea", wide: true},
                ),
            );
        }

        return fields;
    }


    if (sectionName === "lore_secrets") {
        return [
            makeField("Title", "title", item.title),
            makeField(
                "Authority",
                "authority",
                item.authority,
                {
                    options: authorityOptions.filter(
                        option => option[0] !== "forbidden"
                    ),
                },
            ),
            makeField(
                "Lore / Secret",
                "text",
                item.text,
                {
                    type: "textarea",
                    wide: true,
                    rows: 5,
                },
            ),
            makeField("Who Knows", "who_knows", item.who_knows),
            makeField(
                "Importance",
                "importance",
                item.importance,
                {options: importanceOptions},
            ),
            makeField(
                "Reveal Guidance",
                "reveal_guidance",
                item.reveal_guidance,
                {
                    type: "textarea",
                    wide: true,
                },
            ),
            makeField(
                "AI May Alter",
                "ai_can_alter",
                item.ai_can_alter,
                {type: "checkbox"},
            ),
        ];
    }

    return [
        makeField("Thread", "title", item.title),
        makeField(
            "Importance",
            "importance",
            item.importance,
            {options: importanceOptions},
        ),
        makeField(
            "Description",
            "description",
            item.description,
            {
                type: "textarea",
                wide: true,
            },
        ),
        makeField(
            "Recurrence",
            "recurrence",
            item.recurrence,
            {
                options: [
                    ["optional", "OPTIONAL"],
                    ["recurring", "RECURRING"],
                    ["must_resolve", "MUST RESOLVE"],
                ],
            },
        ),
    ];
}


function renderRepeatSection(sectionName) {
    const container = containers[sectionName];
    const items = activeSource?.[sectionName] ?? [];
    const isDraft = activeVersion?.status === "draft";

    container.replaceChildren();

    items.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "repeat-card";

        const header = document.createElement("div");
        header.className = "repeat-card-header";

        const title = document.createElement("div");
        title.className = "repeat-card-title";
        title.textContent = (
            `${sectionName.replaceAll("_", " ").toUpperCase()} ${index + 1}`
        );

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-button";
        remove.textContent = "REMOVE";
        remove.disabled = !isDraft;

        remove.addEventListener("click", () => {
            activeSource[sectionName].splice(index, 1);
            markDirty();
            renderRepeatSection(sectionName);
        });

        header.append(title, remove);

        const itemAiButton = createAiPill({
            label: "AI ITEM",
            title: `AI helper for ${title.textContent}`,
            onClick: () => openAuthorAiHelper({
                kind: "item",
                section: sectionName,
                index,
                label: title.textContent,
            }),
        });

        const headerActions = document.createElement("div");
        headerActions.className = "repeat-card-actions";
        headerActions.append(itemAiButton, remove);

        header.replaceChildren(title, headerActions);

        const fields = document.createElement("div");
        fields.className = "repeat-card-fields";

        for (const definition of sectionFields(sectionName, item)) {
            const {label, control, key, labelText} = definition;
            control.disabled = !isDraft;

            if (
                control instanceof HTMLTextAreaElement
                || (control instanceof HTMLInputElement && control.type === "text")
            ) {
                const heading = label.querySelector(".author-field-heading");
                if (heading) {
                    heading.appendChild(
                        createAiPill({
                            title: `AI helper for ${labelText}`,
                            onClick: () => openAuthorAiHelper({
                                kind: "field",
                                fieldPath: `${sectionName}[${index}].${key}`,
                                label: `${title.textContent} // ${labelText.toUpperCase()}`,
                                placeholder: (
                                    authorAssistPlaceholders[sectionName]
                                    ?? "One sentence is enough..."
                                ),
                            }),
                        })
                    );
                }
            }

            control.dataset.repeatSection = sectionName;
            control.dataset.repeatIndex = String(index);
            control.dataset.repeatKey = key;

            const syncControl = () => {
                item[key] = (
                    control.type === "checkbox"
                        ? control.checked
                        : control.value
                );

                markDirty();
            };

            control.addEventListener("input", syncControl);
            control.addEventListener("change", syncControl);

            fields.appendChild(label);
        }

        card.append(header, fields);
        container.appendChild(card);
    });
}


/* =========================================================
   FORM
========================================================= */

function controlMatchesActiveDocument(control) {
    const scoped = control.closest("[data-doc-kind]");
    if (!scoped) {
        return true;
    }
    const kind = activeSource?.identity?.document_kind ?? "world";
    return scoped.dataset.docKind === kind;
}


function readSimpleFields() {
    if (!activeSource) {
        return;
    }

    for (const control of ui.form.querySelectorAll("[data-path]")) {
        if (!controlMatchesActiveDocument(control)) {
            continue;
        }

        let value = control.value;

        if (control.type === "range") {
            value = Number(value);
        }

        setPath(
            activeSource,
            control.dataset.path,
            value,
        );
    }
}


function readRepeatFields() {
    if (!activeSource) {
        return;
    }

    for (
        const control
        of ui.form.querySelectorAll(
            "[data-repeat-section][data-repeat-index][data-repeat-key]"
        )
    ) {
        const sectionName = control.dataset.repeatSection;
        const index = Number(control.dataset.repeatIndex);
        const key = control.dataset.repeatKey;

        if (
            !sectionName
            || !key
            || !Number.isInteger(index)
            || !Array.isArray(activeSource[sectionName])
            || !activeSource[sectionName][index]
        ) {
            continue;
        }

        activeSource[sectionName][index][key] = (
            control.type === "checkbox"
                ? control.checked
                : control.value
        );
    }
}


function syncFormToSource() {
    readSimpleFields();
    readRepeatFields();
}


function renderSimpleFields() {
    for (const control of ui.form.querySelectorAll("[data-path]")) {
        if (!controlMatchesActiveDocument(control)) {
            continue;
        }
        const value = getPath(activeSource, control.dataset.path);
        if (control.type === "checkbox") {
            control.checked = Boolean(value);
        } else {
            control.value = value ?? "";
        }
    }
}


function updateStrengthUI() {
    if (!activeSource) {
        return;
    }

    syncFormToSource();

    const strength = assessStrength(activeSource);

    ui.strengthLabel.textContent = strength.label;
    ui.strengthScore.textContent = `${strength.score}%`;
    ui.progressFill.style.width = `${strength.score}%`;
    ui.sectionStrengths.replaceChildren();

    for (const [key, value] of Object.entries(strength.sections)) {
        const card = document.createElement("div");
        card.className = "section-strength";

        const name = document.createElement("span");
        name.textContent = key.toUpperCase();

        const result = document.createElement("strong");
        result.textContent = `${value.label} ${value.score}%`;

        card.append(name, result);
        ui.sectionStrengths.appendChild(card);
    }
}


function renderMigrationPanel() {
    const migration = activeSource?.migration ?? {};
    const fromVersion = migration?.from_schema_version;
    const reviewQueue = Array.isArray(migration?.review_queue)
        ? migration.review_queue
        : [];

    ui.migrationPanel.hidden = !fromVersion;
    if (!fromVersion) {
        ui.migrationReviewList.replaceChildren();
        return;
    }

    ui.migrationTitle.textContent = `SCHEMA V${fromVersion} → V3`;
    ui.migrationReviewList.replaceChildren();

    if (!reviewQueue.length) {
        const clean = document.createElement("div");
        clean.className = "migration-review-item clean";
        clean.textContent = "AUTOMATIC PORT COMPLETE // NO AMBIGUOUS FIELDS";
        ui.migrationReviewList.appendChild(clean);
        return;
    }

    for (const item of reviewQueue) {
        if (!item || typeof item !== "object") continue;
        const row = document.createElement("div");
        row.className = "migration-review-item";
        const strong = document.createElement("strong");
        strong.textContent = String(item.label ?? "Legacy field");
        const note = document.createElement("span");
        note.textContent = "REVIEW // ported conservatively; original value preserved below";
        row.append(strong, note);

        if (item.value !== undefined && item.value !== null) {
            const details = document.createElement("details");
            details.className = "migration-review-value";
            const summary = document.createElement("summary");
            summary.textContent = "VIEW LEGACY VALUE";
            const pre = document.createElement("pre");
            pre.textContent = typeof item.value === "string"
                ? item.value
                : JSON.stringify(item.value, null, 2);
            details.append(summary, pre);
            row.appendChild(details);
        }

        ui.migrationReviewList.appendChild(row);
    }
}


function setDocumentScopedVisibility(kind) {
    for (const element of ui.form.querySelectorAll("[data-doc-kind]")) {
        element.hidden = element.dataset.docKind !== kind;
    }

    for (const label of ui.form.querySelectorAll("[data-kind-label-world]")) {
        label.textContent = (
            kind === "world"
                ? label.dataset.kindLabelWorld
                : label.dataset.kindLabelBrief
        );
    }
}


function renderSectionLanguage(kind) {
    const isWorld = kind === "world";

    ui.locationsSectionNumber.textContent = isWorld ? "05" : "05";
    ui.locationsSectionTitle.textContent = isWorld ? "World Locations" : "Adventure-Only Locations";
    ui.locationsSectionHelp.textContent = isWorld
        ? "Persistent places that exist across stories in this World."
        : "Only add places unique to this adventure. Feature existing World locations above instead of copying them.";
    ui.locationsAddButton.textContent = isWorld ? "+ ADD WORLD LOCATION" : "+ ADD ADVENTURE LOCATION";

    ui.npcsSectionNumber.textContent = "06";
    ui.npcsSectionTitle.textContent = isWorld ? "People & Factions" : "Adventure-Only Cast";
    ui.npcsSectionHelp.textContent = isWorld
        ? "Define who they are in the World. Adventure timing belongs in a Brief."
        : "Only add characters unique to this adventure. Feature recurring World characters above.";
    ui.npcsAddButton.textContent = isWorld ? "+ ADD PERSON / FACTION" : "+ ADD ADVENTURE NPC";

    ui.loreSectionNumber.textContent = "07";
    ui.loreSectionTitle.textContent = isWorld ? "World Lore & Secrets" : "Adventure-Only Secrets";
    ui.loreSectionHelp.textContent = isWorld
        ? "Persistent history, mysteries, hidden truths, and who knows them."
        : "Secrets specific to this run. Reference existing World secrets above instead of rewriting them.";
    ui.loreAddButton.textContent = isWorld ? "+ ADD WORLD LORE / SECRET" : "+ ADD ADVENTURE SECRET";

    ui.guidanceSectionNumber.textContent = isWorld ? "08" : "09";
    ui.guidanceSectionTitle.textContent = isWorld ? "Default Story Flavor" : "Story & Choice Guidance";

    ui.forbiddenSectionNumber.textContent = isWorld ? "09" : "10";
    ui.forbiddenSectionTitle.textContent = isWorld ? "Canon Boundaries" : "Adventure Restrictions";
    ui.forbiddenSectionHelp.textContent = isWorld
        ? "Things no adventure in this World should contradict or permanently change."
        : "Limits for this adventure only. World canon boundaries still outrank these.";
    ui.forbiddenAddButton.textContent = isWorld ? "+ ADD CANON BOUNDARY" : "+ ADD ADVENTURE RESTRICTION";

    ui.threadsSectionNumber.textContent = isWorld ? "10" : "11";
    ui.threadsSectionTitle.textContent = isWorld ? "Ongoing Tensions" : "Adventure Threads";
    ui.threadsSectionHelp.textContent = isWorld
        ? "Wars, rivalries, mysteries, pressures, and unresolved conflicts that can fuel many stories."
        : "Plot threads this particular adventure should open, revisit, or resolve.";
    ui.threadsAddButton.textContent = isWorld ? "+ ADD WORLD TENSION" : "+ ADD ADVENTURE THREAD";

    ui.notesSectionNumber.textContent = isWorld ? "11" : "13";
}


function referenceLabel(item, key) {
    if (key === "lore_secrets") {
        return String(item?.title ?? item?.text ?? "Untitled secret");
    }
    return String(item?.name ?? item?.role ?? "Unnamed item");
}


function selectedWorldReference(key, sourceId) {
    const refs = activeSource?.world_references?.[key];
    if (!Array.isArray(refs)) return null;
    return refs.find(ref => ref?.source_id === sourceId) ?? null;
}


function ensureReferenceBuckets() {
    if (!activeSource.world_references || typeof activeSource.world_references !== "object") {
        activeSource.world_references = {};
    }
    for (const key of ["locations", "npcs", "lore_secrets"]) {
        if (!Array.isArray(activeSource.world_references[key])) {
            activeSource.world_references[key] = [];
        }
    }
}


function toggleWorldReference(key, item, enabled) {
    ensureReferenceBuckets();
    const sourceId = String(item?.id ?? "");
    if (!sourceId) return;
    const refs = activeSource.world_references[key];
    const existingIndex = refs.findIndex(ref => ref?.source_id === sourceId);

    if (enabled && existingIndex < 0) {
        const label = referenceLabel(item, key);
        refs.push({
            id: makeId(),
            source_id: sourceId,
            name: key === "lore_secrets" ? "" : label,
            title: key === "lore_secrets" ? label : "",
            use: "",
            importance: "major",
            timing: "anytime",
            treatment: key === "lore_secrets" ? "may_reveal" : "feature",
        });
    } else if (!enabled && existingIndex >= 0) {
        refs.splice(existingIndex, 1);
    }

    markDirty();
    renderWorldReferencePicker();
}


function renderWorldReferencePicker() {
    if (!ui.worldReferencePicker) return;
    ui.worldReferencePicker.replaceChildren();

    if ((activeSource?.identity?.document_kind ?? "world") !== "brief") {
        return;
    }

    if (!linkedWorldSource) {
        const empty = document.createElement("div");
        empty.className = "world-reference-empty";
        empty.textContent = "LINKED WORLD CONTENT IS NOT AVAILABLE YET. SAVE/PUBLISH WORLD MATERIAL, THEN REOPEN THIS BRIEF.";
        ui.worldReferencePicker.appendChild(empty);
        return;
    }

    ensureReferenceBuckets();
    const isDraft = activeVersion?.status === "draft";

    const heading = document.createElement("div");
    heading.className = "world-reference-source";
    heading.textContent = `${linkedWorldSource.identity?.title ?? activeVersion?.parent_title ?? "WORLD"} // ${linkedWorldVersionLabel}`;
    ui.worldReferencePicker.appendChild(heading);

    const groups = [
        ["locations", "LOCATIONS"],
        ["npcs", "PEOPLE / FACTIONS"],
        ["lore_secrets", "LORE / SECRETS"],
    ];

    for (const [key, titleText] of groups) {
        const section = document.createElement("section");
        section.className = "world-reference-group";
        const title = document.createElement("h4");
        title.textContent = titleText;
        section.appendChild(title);

        const items = Array.isArray(linkedWorldSource[key]) ? linkedWorldSource[key] : [];
        if (!items.length) {
            const none = document.createElement("p");
            none.className = "helper";
            none.textContent = "No authored items in this World yet.";
            section.appendChild(none);
        }

        for (const item of items) {
            const sourceId = String(item?.id ?? "");
            if (!sourceId) continue;
            const selected = selectedWorldReference(key, sourceId);

            const card = document.createElement("article");
            card.className = "world-reference-card";
            card.classList.toggle("selected", Boolean(selected));

            const row = document.createElement("label");
            row.className = "world-reference-toggle";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(selected);
            checkbox.disabled = !isDraft;
            checkbox.addEventListener("change", () => {
                toggleWorldReference(key, item, checkbox.checked);
            });
            const name = document.createElement("strong");
            name.textContent = referenceLabel(item, key);
            row.append(checkbox, name);
            card.appendChild(row);

            const summary = document.createElement("p");
            summary.className = "world-reference-summary";
            summary.textContent = String(
                item.canon ?? item.canonical_facts ?? item.text ?? item.description ?? item.role ?? ""
            ).slice(0, 280);
            if (summary.textContent) card.appendChild(summary);

            if (selected) {
                const controls = document.createElement("div");
                controls.className = "world-reference-controls";

                const useLabel = document.createElement("label");
                useLabel.textContent = "Adventure Use";
                const use = document.createElement("textarea");
                use.rows = 3;
                use.value = selected.use ?? "";
                use.disabled = !isDraft;
                use.placeholder = key === "npcs"
                    ? "How should this person matter in this adventure?"
                    : key === "locations"
                        ? "How is this place used in this adventure?"
                        : "How should this secret/lore matter here?";
                use.addEventListener("input", () => {
                    selected.use = use.value;
                    markDirty();
                });
                useLabel.appendChild(use);
                controls.appendChild(useLabel);

                const importanceLabel = document.createElement("label");
                importanceLabel.textContent = "Importance";
                const importance = document.createElement("select");
                for (const value of ["minor", "supporting", "major", "critical"]) {
                    const option = document.createElement("option");
                    option.value = value;
                    option.textContent = value.toUpperCase();
                    importance.appendChild(option);
                }
                importance.value = selected.importance ?? "major";
                importance.disabled = !isDraft;
                importance.addEventListener("change", () => {
                    selected.importance = importance.value;
                    markDirty();
                });
                importanceLabel.appendChild(importance);
                controls.appendChild(importanceLabel);

                const timingLabel = document.createElement("label");
                timingLabel.textContent = "Timing";
                const timing = document.createElement("select");
                for (const value of ["anytime", "early", "mid", "late", "finale"]) {
                    const option = document.createElement("option");
                    option.value = value;
                    option.textContent = value.toUpperCase();
                    timing.appendChild(option);
                }
                timing.value = selected.timing ?? "anytime";
                timing.disabled = !isDraft;
                timing.addEventListener("change", () => {
                    selected.timing = timing.value;
                    markDirty();
                });
                timingLabel.appendChild(timing);
                controls.appendChild(timingLabel);

                if (key === "lore_secrets") {
                    const treatmentLabel = document.createElement("label");
                    treatmentLabel.textContent = "Reveal Treatment";
                    const treatment = document.createElement("select");
                    for (const [value, text] of [
                        ["do_not_reveal", "DO NOT REVEAL"],
                        ["foreshadow", "FORESHADOW ONLY"],
                        ["may_reveal", "MAY REVEAL"],
                        ["must_reveal", "MUST REVEAL"],
                    ]) {
                        const option = document.createElement("option");
                        option.value = value;
                        option.textContent = text;
                        treatment.appendChild(option);
                    }
                    treatment.value = selected.treatment ?? "may_reveal";
                    treatment.disabled = !isDraft;
                    treatment.addEventListener("change", () => {
                        selected.treatment = treatment.value;
                        markDirty();
                    });
                    treatmentLabel.appendChild(treatment);
                    controls.appendChild(treatmentLabel);
                }

                card.appendChild(controls);
            }

            section.appendChild(card);
        }

        ui.worldReferencePicker.appendChild(section);
    }
}


async function refreshLinkedWorldSource() {
    linkedWorldSource = null;
    linkedWorldVersionLabel = "";

    if (
        !activeVersion
        || activeVersion.document_kind !== "brief"
        || !activeVersion.parent_document_id
    ) {
        return;
    }

    const world = library.find(
        item => item.document_id === activeVersion.parent_document_id
    );
    if (!world) return;

    const versionNumber = world.latest_published_version ?? world.latest_version;
    if (!versionNumber) return;

    try {
        const version = await api(
            `/api/author/adventures/${world.document_id}/versions/${versionNumber}`
        );
        linkedWorldSource = structuredClone(version.source);
        linkedWorldVersionLabel = (
            `${String(version.status ?? "draft").toUpperCase()} v${version.version_number}`
        );
    } catch {
        linkedWorldSource = null;
        linkedWorldVersionLabel = "UNAVAILABLE";
    }
}


function renderEditor() {
    if (!activeVersion || !activeSource) {
        ui.editor.hidden = true;
        ui.emptyState.hidden = false;
        return;
    }

    ui.emptyState.hidden = true;
    ui.editor.hidden = false;

    const kind = activeVersion.document_kind ?? "world";
    const isWorld = kind === "world";
    const isDraft = activeVersion.status === "draft";
    const archived = Boolean(activeVersion.is_archived);

    setDocumentScopedVisibility(kind);
    renderSectionLanguage(kind);
    renderMigrationPanel();

    ui.editorKicker.textContent = (
        `${kind.toUpperCase()} // ${activeVersion.status.toUpperCase()} v${activeVersion.version_number}`
    );

    ui.editorTitle.textContent = (
        activeSource.identity.title
        || "UNTITLED SOURCE"
    );

    ui.editorMeta.textContent = (
        `${activeSource.identity.slug}`
        + ` // UPDATED ${formatTime(activeVersion.updated_at)}`
    );

    ui.saveButton.hidden = !isDraft;
    ui.publishButton.hidden = !isDraft;
    ui.newVersionButton.hidden = isDraft;
    ui.newBriefButton.hidden = !isWorld;
    ui.archiveButton.textContent = archived ? "RESTORE" : "ARCHIVE";

    renderAuthorAssistState();

    ui.worldLinkPanel.hidden = (
        kind !== "brief"
        || !activeVersion.parent_title
    );

    ui.worldLinkTitle.textContent = (
        activeVersion.parent_title
            ? `${activeVersion.parent_title}${linkedWorldVersionLabel ? ` // ${linkedWorldVersionLabel}` : ""}`
            : ""
    );

    ui.generationPanel.hidden = (
        kind !== "brief"
    );

    if (kind === "brief") {
        renderGenerationPanel();
    }

    /*
       Published World/Brief source fields are immutable, but generation
       controls are not authored source fields. They must remain interactive
       after a Brief is published.
    */
    for (const control of ui.form.querySelectorAll("input, textarea, select")) {
        if (ui.generationPanel.contains(control)) {
            continue;
        }

        control.disabled = !isDraft;
    }

    for (const button of document.querySelectorAll("[data-add]")) {
        button.disabled = !isDraft;
    }

    renderSimpleFields();
    decorateSimpleAiFields();

    for (const sectionName of Object.keys(containers)) {
        renderRepeatSection(sectionName);
    }

    renderWorldReferencePicker();
    refreshAiHelperButtons();
    updateStrengthUI();
}


/* =========================================================
   DIRTY + AUTOSAVE
========================================================= */

function markDirty() {
    if (
        !activeVersion
        || activeVersion.status !== "draft"
    ) {
        return;
    }

    dirty = true;
    revision += 1;
    ui.saveState.textContent = "UNSAVED";
    updateStrengthUI();

    clearTimeout(autosaveTimer);

    autosaveTimer = setTimeout(() => {
        saveDraft({
            silent: true,
        });
    }, 2200);
}


function markSaved() {
    dirty = false;
    ui.saveState.textContent = "SAVED";
}


async function saveDraft({silent = false} = {}) {
    if (
        !activeVersion
        || activeVersion.status !== "draft"
        || saveInFlight
    ) {
        return false;
    }

    if (!dirty && silent) {
        return true;
    }

    syncFormToSource();

    const revisionAtStart = revision;
    const documentId = activeVersion.document_id;
    const versionNumber = activeVersion.version_number;
    const expectedUpdatedAt = activeVersion.updated_at;

    saveInFlight = true;
    ui.saveState.textContent = (
        silent
            ? "AUTOSAVING..."
            : "SAVING..."
    );

    try {
        const saved = await api(
            `/api/author/adventures/${documentId}/versions/${versionNumber}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    source: activeSource,
                    expected_updated_at: expectedUpdatedAt,
                }),
            }
        );

        activeVersion = saved;

        if (revision === revisionAtStart) {
            activeSource = structuredClone(saved.source);
            markSaved();
        } else {
            ui.saveState.textContent = "UNSAVED";
        }

        await refreshLibrary();

        if (!silent) {
            renderEditor();
            showToast("DRAFT SAVED_");
        }

        return true;

    } catch (error) {
        ui.saveState.textContent = "SAVE FAILED";

        if (error.status === 409) {
            clearTimeout(autosaveTimer);
            showToast(
                "EDIT CONFLICT — another author changed this draft. Reload before saving.",
                true,
            );
        } else {
            showToast(error.message, true);
        }

        return false;

    } finally {
        saveInFlight = false;

        if (
            dirty
            && revision !== revisionAtStart
        ) {
            clearTimeout(autosaveTimer);

            autosaveTimer = setTimeout(() => {
                saveDraft({
                    silent: true,
                });
            }, 1800);
        }
    }
}


/* =========================================================
   LIBRARY
========================================================= */

function filteredLibrary() {
    if (currentFilter === "archived") {
        return library.filter(
            item => item.is_archived
        );
    }

    return library.filter(item => {
        if (item.is_archived) {
            return false;
        }

        if (currentFilter === "all") {
            return true;
        }

        return item.document_kind === currentFilter;
    });
}


function renderLibrary() {
    ui.adventureList.replaceChildren();

    const items = filteredLibrary();

    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "helper";
        empty.textContent = "NO SOURCES IN THIS VIEW_";
        ui.adventureList.appendChild(empty);
        return;
    }

    for (const source of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "adventure-list-item";

        if (source.is_archived) {
            button.classList.add("archived-item");
        }

        if (
            activeVersion
            && activeVersion.document_id === source.document_id
        ) {
            button.classList.add("active");
        }

        const title = document.createElement("span");
        title.className = "adventure-list-title";

        const badge = document.createElement("span");
        badge.className = "document-kind-badge";
        badge.textContent = (
            source.document_kind === "brief"
                ? "BRIEF"
                : "WORLD"
        );

        const titleText = document.createElement("span");
        titleText.textContent = source.title;

        title.append(badge, titleText);

        const meta = document.createElement("span");
        meta.className = "adventure-list-meta";

        const left = document.createElement("span");
        left.textContent = (
            `v${source.latest_version} ${source.latest_status.toUpperCase()}`
        );

        const right = document.createElement("span");
        right.textContent = (
            `${source.strength_label} ${source.strength_score}%`
        );

        meta.append(left, right);

        if (source.parent_title) {
            const parent = document.createElement("span");
            parent.className = "adventure-list-meta";
            parent.textContent = `WORLD: ${source.parent_title}`;
            button.append(title, meta, parent);
        } else {
            button.append(title, meta);
        }

        button.addEventListener("click", async () => {
            if (
                dirty
                && !await authorConfirm({
                    kicker: "UNSAVED CHANGES",
                    title: "Discard changes?",
                    message: "You have unsaved changes. Loading another source will discard them.",
                    confirmLabel: "DISCARD & LOAD",
                    danger: true,
                })
            ) {
                return;
            }

            await loadVersion(
                source.document_id,
                source.latest_version,
            );
        });

        ui.adventureList.appendChild(button);
    }
}


async function refreshLibrary() {
    const result = await api(
        "/api/author/adventures?include_archived=true"
    );

    library = result.adventures ?? [];
    renderLibrary();
}


/* =========================================================
   GENERATION PROVIDER
========================================================= */

function selectedGenerationProfile() {
    const selectedId = (
        ui.generationQualityTier.value
        || generationProviderStatus.default_quality
        || "story"
    );

    return (
        generationProviderStatus.profiles.find(
            profile => profile.id === selectedId
        )
        ?? generationProviderStatus.profiles[0]
        ?? null
    );
}


function renderGenerationProviderStatus() {
    const providerName = (
        generationProviderStatus.provider
        ?? "unknown"
    ).toUpperCase();

    const profile = selectedGenerationProfile();

    ui.generationProviderName.textContent =
        providerName;

    ui.generationProviderModel.textContent = (
        profile
            ? `MODEL // ${String(profile.model ?? "unknown").toUpperCase()}`
            : "MODEL // UNAVAILABLE"
    );

    if (profile) {
        ui.generationQualityHelp.textContent = (
            `${String(profile.label ?? profile.id).toUpperCase()} // `
            + `${profile.description ?? ""} `
            + `MODEL ${String(profile.model ?? "unknown").toUpperCase()}`
        ).trim();
    } else {
        ui.generationQualityHelp.textContent = (
            "No generation profile is available."
        );
    }
}


async function refreshGenerationProviderStatus() {
    generationProviderStatus = await api(
        "/api/author/generated/provider"
    );

    const current = (
        ui.generationQualityTier.value
        || generationProviderStatus.default_quality
        || "story"
    );

    ui.generationQualityTier.replaceChildren();

    for (
        const profile
        of (
            generationProviderStatus.profiles
            ?? []
        )
    ) {
        const option = document.createElement(
            "option"
        );

        option.value = profile.id;
        option.textContent = (
            `${String(profile.label ?? profile.id).toUpperCase()}`
            + ` // ${String(profile.model ?? "unknown").toUpperCase()}`
        );

        ui.generationQualityTier.appendChild(
            option
        );
    }

    const validCurrent = (
        generationProviderStatus.profiles
        ?? []
    ).some(
        profile => profile.id === current
    );

    ui.generationQualityTier.value = (
        validCurrent
            ? current
            : (
                generationProviderStatus.default_quality
                ?? generationProviderStatus.profiles?.[0]?.id
                ?? "story"
            )
    );

    renderGenerationProviderStatus();
    renderAuthorAssistState();

    if (activeVersion && activeSource) {
        renderEditor();
    }
}


/* =========================================================
   GENERATED ADVENTURES
========================================================= */

function activeParentWorldSummary() {
    if (!activeVersion?.parent_document_id) {
        return null;
    }

    return library.find(
        item =>
            item.document_id
            === activeVersion.parent_document_id
    ) ?? null;
}


function generatedForActiveBrief() {
    if (!activeVersion) {
        return [];
    }

    return generatedAdventures.filter(
        item =>
            item.brief_document_id
            === activeVersion.document_id
    );
}


function seedSequenceNumber(generated) {
    const matching = generatedForActiveBrief()
        .slice()
        .sort(
            (a, b) =>
                new Date(a.created_at)
                - new Date(b.created_at)
        );

    const index = matching.findIndex(
        item =>
            item.generated_adventure_id
            === generated.generated_adventure_id
    );

    return (
        index >= 0
            ? index + 1
            : 1
    );
}


async function regenerateSeed(generated) {
    try {
        const created = await api(
            "/api/author/generated",
            {
                method: "POST",
                body: JSON.stringify({
                    world_document_id:
                        generated.world_document_id,

                    world_version_number:
                        generated.world_version_number,

                    brief_document_id:
                        generated.brief_document_id,

                    brief_version_number:
                        generated.brief_version_number,

                    special_request:
                        generated.seed?.special_request
                        ?? "",

                    quality_tier:
                        generated.seed?.quality_tier
                        ?? "story",
                }),
            }
        );

        await refreshGenerated();
        renderGenerationPanel();

        showToast(
            `NEW SEED GENERATED // ${created.seed?.title ?? "UNTITLED"}`
        );

    } catch (error) {
        showToast(error.message, true);
    }
}


function showSeedPreview(generated) {
    ui.previewKicker.textContent = (
        `ADVENTURE SEED #${seedSequenceNumber(generated)}`
    );
    ui.previewTitle.textContent = (
        generated.seed?.title
        ?? "GENERATED ADVENTURE"
    );

    ui.previewContent.textContent = JSON.stringify(
        generated.seed,
        null,
        2,
    );

    ui.previewDialog.showModal();
}


async function updateGeneratedStatus(
    generatedAdventureId,
    action,
) {
    try {
        await api(
            `/api/author/generated/${generatedAdventureId}/${action}`,
            {
                method: "POST",
                body: JSON.stringify({}),
            }
        );

        await refreshGenerated();
        renderGenerationPanel();

        if (action === "approve") {
            showToast(
                "APPROVED — reload the game lobby and it will appear as a generated adventure."
            );
        } else if (action === "retire") {
            showToast("GENERATED ADVENTURE RETIRED_");
        } else {
            showToast("GENERATED ADVENTURE REJECTED_");
        }

    } catch (error) {
        showToast(error.message, true);
    }
}


function renderGeneratedSeeds() {
    ui.generatedSeedList.replaceChildren();

    const items = generatedForActiveBrief();

    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "helper";
        empty.textContent = "NO GENERATED SEEDS YET // GENERATE ONE ABOVE_";
        ui.generatedSeedList.appendChild(empty);
        return;
    }

    for (const generated of items) {
        const card = document.createElement("article");
        card.className = (
            `generated-seed-card ${generated.status}`
        );

        const top = document.createElement("div");
        top.className = "generated-seed-top";

        const title = document.createElement("div");
        title.className = "generated-seed-title";

        const sequence = (
            seedSequenceNumber(
                generated
            )
        );

        title.textContent = (
            `SEED #${sequence} // `
            + (
                generated.seed?.title
                ?? "GENERATED ADVENTURE"
            )
        );

        const status = document.createElement("div");
        status.className = "generated-seed-status";
        status.textContent = generated.status.toUpperCase();

        top.append(title, status);

        const meta = document.createElement("div");
        meta.className = "generated-seed-meta";

        const provider = (
            generated.seed?.generator?.toUpperCase()
            ?? "UNKNOWN"
        );

        const facts = [
            ["WORLD", `v${generated.world_version_number}`],
            ["BRIEF", `v${generated.brief_version_number}`],
            ["PROVIDER", provider],
        ];

        if (generated.seed?.model) {
            facts.push([
                "MODEL",
                String(
                    generated.seed.model
                ).toUpperCase(),
            ]);
        }

        if (generated.seed?.quality_tier) {
            facts.push([
                "QUALITY",
                String(
                    generated.seed.quality_tier
                ).toUpperCase(),
            ]);
        }

        facts.push(
            ["CREATED", formatTime(generated.created_at)]
        );

        if (generated.status === "approved") {
            facts.push(
                ["RUNTIME", "GENERATED SHELL"]
            );
        }

        for (const [label, value] of facts) {
            const fact = document.createElement("span");
            fact.className = "generated-seed-fact";

            const factLabel = document.createElement("strong");
            factLabel.textContent = `${label} // `;

            const factValue = document.createElement("span");
            factValue.textContent = value;

            fact.append(factLabel, factValue);
            meta.appendChild(fact);
        }

        const goal = document.createElement("div");
        goal.className = "generated-seed-goal";
        goal.textContent = (
            generated.seed?.core_goal
            ?? generated.seed?.premise
            ?? ""
        );

        const actions = document.createElement("div");
        actions.className = "generated-seed-actions";

        const view = document.createElement("button");
        view.type = "button";
        view.className = "button subtle";
        view.textContent = "VIEW SEED";
        view.addEventListener(
            "click",
            () => showSeedPreview(generated)
        );
        actions.appendChild(view);

        const regenerate = document.createElement("button");
        regenerate.type = "button";
        regenerate.className = "button subtle";
        regenerate.textContent = "REGENERATE";
        regenerate.title = (
            "Create another seed from the exact same "
            + "published world + brief versions."
        );

        regenerate.addEventListener(
            "click",
            () => regenerateSeed(
                generated
            )
        );

        actions.appendChild(
            regenerate
        );

        if (
            generated.status === "generated"
            || generated.status === "rejected"
        ) {
            const approve = document.createElement("button");
            approve.type = "button";
            approve.className = "button primary";
            approve.textContent = "APPROVE";
            approve.addEventListener(
                "click",
                () => updateGeneratedStatus(
                    generated.generated_adventure_id,
                    "approve",
                )
            );
            actions.appendChild(approve);
        }

        if (generated.status === "generated") {
            const reject = document.createElement("button");
            reject.type = "button";
            reject.className = "button subtle";
            reject.textContent = "REJECT";
            reject.addEventListener(
                "click",
                () => updateGeneratedStatus(
                    generated.generated_adventure_id,
                    "reject",
                )
            );
            actions.appendChild(reject);
        }

        if (generated.status === "approved") {
            const openGame = document.createElement("a");
            openGame.className = "button subtle";
            openGame.href = "/";
            openGame.textContent = "OPEN GAME";

            const retire = document.createElement("button");
            retire.type = "button";
            retire.className = "button subtle";
            retire.textContent = "RETIRE";
            retire.addEventListener(
                "click",
                () => updateGeneratedStatus(
                    generated.generated_adventure_id,
                    "retire",
                )
            );

            actions.append(openGame, retire);
        }

        card.append(top, meta, goal, actions);
        ui.generatedSeedList.appendChild(card);
    }
}


function generationReadinessSnapshot() {
    const isBrief = (
        Boolean(activeVersion)
        && activeVersion.document_kind === "brief"
    );

    const world = isBrief
        ? activeParentWorldSummary()
        : null;

    const worldPublishedVersion = (
        world?.latest_published_version
        ?? null
    );

    const briefPublished = (
        isBrief
        && activeVersion.status === "published"
    );

    return {
        isBrief,
        world,
        worldPublishedVersion,
        briefPublished,
        providerAvailable: Boolean(
            generationProviderStatus.available
        ),
    };
}


function renderGenerationInfoChecklist() {
    const state = generationReadinessSnapshot();

    const rows = [
        {
            ok: state.isBrief,
            label: "ADVENTURE BRIEF SELECTED",
            detail: state.isBrief
                ? `Brief v${activeVersion.version_number}`
                : "Open an Adventure Brief to generate a seed.",
        },
        {
            ok: Boolean(state.world),
            label: "LINKED WORLD",
            detail: state.world
                ? state.world.title
                : "This Brief is not linked to a World.",
        },
        {
            ok: Boolean(state.worldPublishedVersion),
            label: "WORLD PUBLISHED",
            detail: state.worldPublishedVersion
                ? `${state.world?.title ?? "World"} v${state.worldPublishedVersion}`
                : "Publish the linked World first.",
        },
        {
            ok: state.briefPublished,
            label: "BRIEF PUBLISHED",
            detail: state.briefPublished
                ? `Brief v${activeVersion.version_number}`
                : (
                    state.isBrief
                        ? `Brief v${activeVersion.version_number} is ${String(activeVersion.status ?? "draft").toUpperCase()}.`
                        : "No eligible Brief version selected."
                ),
        },
        {
            ok: state.providerAvailable,
            label: "GENERATION PROVIDER",
            detail: state.providerAvailable
                ? `${String(generationProviderStatus.provider ?? "provider").toUpperCase()} // AVAILABLE`
                : "Generation provider is not configured.",
        },
    ];

    ui.generationInfoChecklist.replaceChildren();

    for (const row of rows) {
        const item = document.createElement("div");
        item.className = (
            "generation-info-check "
            + (row.ok ? "ready" : "blocked")
        );

        const mark = document.createElement("span");
        mark.className = "generation-info-mark";
        mark.textContent = row.ok ? "[✓]" : "[!]";

        const copy = document.createElement("div");

        const label = document.createElement("strong");
        label.textContent = row.label;

        const detail = document.createElement("span");
        detail.textContent = row.detail;

        copy.append(label, detail);
        item.append(mark, copy);
        ui.generationInfoChecklist.appendChild(item);
    }
}


function openGenerationInfo() {
    renderGenerationInfoChecklist();
    ui.generationInfoDialog.showModal();
}


function closeGenerationInfo() {
    ui.generationInfoDialog.close();
}


function renderGenerationPanel() {
    if (
        !activeVersion
        || activeVersion.document_kind !== "brief"
    ) {
        ui.generationPanel.hidden = true;
        return;
    }

    ui.generationPanel.hidden = false;

    /*
       Generation settings remain editable for a published Brief.
    */
    ui.generationQualityTier.disabled = false;
    ui.generationSpecialRequest.disabled = false;

    renderGenerationProviderStatus();

    const world = activeParentWorldSummary();
    const briefPublished = (
        activeVersion.status === "published"
    );

    const worldPublishedVersion = (
        world?.latest_published_version
        ?? null
    );

    const ready = (
        briefPublished
        && Boolean(world)
        && Boolean(worldPublishedVersion)
        && Boolean(generationProviderStatus.available)
    );

    ui.generateSeedButton.disabled = !ready;

    if (!world) {
        ui.generationReadiness.textContent = (
            "NO LINKED WORLD"
        );

    } else if (!worldPublishedVersion) {
        ui.generationReadiness.textContent = (
            "PUBLISH THE LINKED WORLD FIRST"
        );

    } else if (!briefPublished) {
        ui.generationReadiness.textContent = (
            "PUBLISH THIS BRIEF TO GENERATE"
        );

    } else if (!generationProviderStatus.available) {
        ui.generationReadiness.textContent = (
            "GENERATION PROVIDER NOT CONFIGURED"
        );

    } else {
        const profile = selectedGenerationProfile();

        ui.generationReadiness.textContent = (
            `READY // ${world.title} v${worldPublishedVersion}`
            + ` + BRIEF v${activeVersion.version_number}`
            + (
                profile
                    ? ` // ${String(profile.label ?? profile.id).toUpperCase()}`
                    : ""
            )
        );
    }

    renderGeneratedSeeds();
}


async function refreshGenerated() {
    try {
        const result = await api(
            "/api/author/generated"
        );

        generatedAdventures = (
            result.generated_adventures
            ?? []
        );

        if (
            activeVersion?.document_kind
            === "brief"
        ) {
            renderGenerationPanel();
        }

    } catch (error) {
        showToast(error.message, true);
    }
}


async function generateSeed() {
    if (
        !activeVersion
        || activeVersion.document_kind !== "brief"
    ) {
        return;
    }

    const world = activeParentWorldSummary();

    if (
        !world
        || !world.latest_published_version
        || activeVersion.status !== "published"
        || !generationProviderStatus.available
    ) {
        renderGenerationPanel();
        return;
    }

    ui.generateSeedButton.disabled = true;

    const profile = selectedGenerationProfile();

    ui.generationReadiness.textContent = (
        "GENERATING "
        + String(
            profile?.label
            ?? ui.generationQualityTier.value
            ?? "STORY"
        ).toUpperCase()
        + " SEED..."
    );

    try {
        await api(
            "/api/author/generated",
            {
                method: "POST",
                body: JSON.stringify({
                    world_document_id:
                        world.document_id,

                    world_version_number:
                        world.latest_published_version,

                    brief_document_id:
                        activeVersion.document_id,

                    brief_version_number:
                        activeVersion.version_number,

                    special_request:
                        ui.generationSpecialRequest.value.trim(),

                    quality_tier:
                        ui.generationQualityTier.value
                        || "story",
                }),
            }
        );

        ui.generationSpecialRequest.value = "";

        await refreshGenerated();
        renderGenerationPanel();

        showToast("ADVENTURE SEED GENERATED_");

    } catch (error) {
        showToast(error.message, true);
        renderGenerationPanel();
    }
}


/* =========================================================
   LOAD / VERSIONING
========================================================= */

async function loadVersion(documentId, versionNumber) {
    try {
        activeVersion = await api(
            `/api/author/adventures/${documentId}/versions/${versionNumber}`
        );

        activeSource = structuredClone(activeVersion.source);
        dirty = false;
        revision = 0;
        clearTimeout(autosaveTimer);
        markSaved();
        renderLibrary();
        await refreshLinkedWorldSource();
        renderEditor();

    } catch (error) {
        showToast(error.message, true);
    }
}


async function publishVersion() {
    if (
        !activeVersion
        || activeVersion.status !== "draft"
    ) {
        return;
    }

    syncFormToSource();

    if (dirty) {
        const saved = await saveDraft();

        if (!saved) {
            return;
        }
    }

    if (
        !await authorConfirm({
            kicker: "PUBLISH VERSION",
            title: "Publish this version?",
            message: "Published versions are immutable. Future changes require a new version.",
            confirmLabel: "PUBLISH VERSION",
            danger: false,
        })
    ) {
        return;
    }

    try {
        activeVersion = await api(
            `/api/author/adventures/${activeVersion.document_id}/versions/${activeVersion.version_number}/publish`,
            {
                method: "POST",
                body: JSON.stringify({}),
            }
        );

        activeSource = structuredClone(activeVersion.source);
        markSaved();
        await refreshLibrary();
        renderEditor();
        showToast("VERSION PUBLISHED_");

    } catch (error) {
        showToast(error.message, true);
    }
}


async function createNewVersion() {
    if (!activeVersion) {
        return;
    }

    try {
        const created = await api(
            `/api/author/adventures/${activeVersion.document_id}/new-version`,
            {
                method: "POST",
                body: JSON.stringify({}),
            }
        );

        activeVersion = created;
        activeSource = structuredClone(created.source);
        dirty = false;
        revision = 0;
        markSaved();
        await refreshLibrary();
        renderEditor();
        showToast(`DRAFT v${created.version_number} CREATED_`);

    } catch (error) {
        showToast(error.message, true);
    }
}


async function showVersions() {
    if (!activeVersion) {
        return;
    }

    try {
        const result = await api(
            `/api/author/adventures/${activeVersion.document_id}/versions`
        );

        ui.versionsList.replaceChildren();

        for (const version of result.versions ?? []) {
            const row = document.createElement("div");
            row.className = "version-row";

            const meta = document.createElement("div");
            meta.className = "version-row-meta";
            meta.textContent = (
                `v${version.version_number} ${version.status.toUpperCase()}`
                + `\nUpdated ${formatTime(version.updated_at)}`
                + (
                    version.published_at
                        ? `\nPublished ${formatTime(version.published_at)}`
                        : ""
                )
            );
            meta.style.whiteSpace = "pre-line";

            const actions = document.createElement("div");
            actions.className = "version-row-actions";

            const load = document.createElement("button");
            load.type = "button";
            load.className = "button subtle";
            load.textContent = "LOAD";

            load.addEventListener("click", async () => {
                if (
                    dirty
                    && !await authorConfirm({
                        kicker: "UNSAVED CHANGES",
                        title: "Discard changes?",
                        message: "You have unsaved changes. Loading this version will discard them.",
                        confirmLabel: "DISCARD & LOAD",
                        danger: true,
                    })
                ) {
                    return;
                }

                ui.versionsDialog.close();

                await loadVersion(
                    version.document_id,
                    version.version_number,
                );
            });

            actions.appendChild(load);
            row.append(meta, actions);
            ui.versionsList.appendChild(row);
        }

        ui.versionsDialog.showModal();

    } catch (error) {
        showToast(error.message, true);
    }
}


/* =========================================================
   CREATE / BRIEF / DUPLICATE
========================================================= */

function populateWorldSelect() {
    ui.newParent.replaceChildren();

    const worlds = library.filter(
        item =>
            item.document_kind === "world"
            && !item.is_archived
    );

    for (const world of worlds) {
        const option = document.createElement("option");
        option.value = world.document_id;
        option.textContent = world.title;
        ui.newParent.appendChild(option);
    }
}


function updateCreateDialogKind() {
    const isBrief = ui.newKind.value === "brief";
    ui.newParentLabel.hidden = !isBrief;

    if (isBrief && createContextParentId) {
        ui.newParent.value = createContextParentId;
    }
}


function openNewSource({
    kind = "world",
    parentDocumentId = null,
} = {}) {
    createContextParentId = parentDocumentId;

    populateWorldSelect();

    ui.newKind.value = kind;
    ui.newTitle.value = "";
    ui.newSlug.value = "";
    ui.newSlug.dataset.manual = "";
    ui.newDialogTitle.textContent = (
        kind === "brief"
            ? "New Adventure Brief"
            : "New World Bible"
    );

    updateCreateDialogKind();
    ui.newDialog.showModal();
    ui.newTitle.focus();
}


async function createSource() {
    const title = ui.newTitle.value.trim();
    const slug = slugify(
        ui.newSlug.value
        || title
    );

    if (!title || !slug) {
        return;
    }

    const kind = ui.newKind.value;
    const parentDocumentId = (
        kind === "brief"
            ? (
                ui.newParent.value
                || null
            )
            : null
    );

    try {
        const created = await api(
            "/api/author/adventures",
            {
                method: "POST",
                body: JSON.stringify({
                    title,
                    slug,
                    document_kind: kind,
                    parent_document_id: parentDocumentId,
                }),
            }
        );

        ui.newDialog.close();
        createContextParentId = null;

        await refreshLibrary();
        await loadVersion(
            created.document_id,
            created.version_number,
        );

        showToast("SOURCE CREATED_");

    } catch (error) {
        showToast(error.message, true);
    }
}


function openDuplicateDialog() {
    if (!activeSource || !activeVersion) {
        return;
    }

    const title = `${activeSource.identity.title} Copy`;

    ui.duplicateTitle.value = title;
    ui.duplicateSlug.value = slugify(title);
    ui.duplicateDialog.showModal();
}


async function duplicateSource() {
    if (!activeVersion) {
        return;
    }

    const title = ui.duplicateTitle.value.trim();
    const slug = slugify(
        ui.duplicateSlug.value
        || title
    );

    if (!title || !slug) {
        return;
    }

    try {
        const created = await api(
            `/api/author/adventures/${activeVersion.document_id}/duplicate`,
            {
                method: "POST",
                body: JSON.stringify({
                    title,
                    slug,
                }),
            }
        );

        ui.duplicateDialog.close();

        await refreshLibrary();
        await loadVersion(
            created.document_id,
            created.version_number,
        );

        showToast("SOURCE DUPLICATED_");

    } catch (error) {
        showToast(error.message, true);
    }
}


/* =========================================================
   ARCHIVE
========================================================= */

async function toggleArchive() {
    if (!activeVersion) {
        return;
    }

    if (dirty) {
        const saved = await saveDraft();

        if (!saved) {
            return;
        }
    }

    const archived = !Boolean(
        activeVersion.is_archived
    );

    if (
        !await authorConfirm({
            kicker: archived ? "ARCHIVE SOURCE" : "RESTORE SOURCE",
            title: archived ? "Archive this source?" : "Restore this source?",
            message: archived
                ? "It will leave the normal library view but remain available under Archived."
                : "It will return to the normal library view.",
            confirmLabel: archived ? "ARCHIVE" : "RESTORE",
            danger: archived,
        })
    ) {
        return;
    }

    try {
        await api(
            `/api/author/adventures/${activeVersion.document_id}/archive`,
            {
                method: "POST",
                body: JSON.stringify({
                    archived,
                }),
            }
        );

        activeVersion.is_archived = archived;

        await refreshLibrary();
        renderEditor();

        showToast(
            archived
                ? "SOURCE ARCHIVED_"
                : "SOURCE RESTORED_"
        );

    } catch (error) {
        showToast(error.message, true);
    }
}


/* =========================================================
   PREVIEW
========================================================= */

async function showPreview(kind) {
    if (!activeSource) {
        return;
    }

    syncFormToSource();

    try {
        const preview = await api(
            "/api/author/preview",
            {
                method: "POST",
                body: JSON.stringify({
                    source: activeSource,
                }),
            }
        );

        ui.previewKicker.textContent = (
            kind === "document"
                ? "DESIGN DOCUMENT"
                : "COMPILED PACK"
        );

        ui.previewTitle.textContent = (
            activeSource.identity.title
            || "UNTITLED"
        );

        ui.previewContent.textContent = (
            kind === "document"
                ? preview.design_document
                : JSON.stringify(
                    preview.compiled,
                    null,
                    2,
                )
        );

        ui.previewDialog.showModal();

    } catch (error) {
        showToast(error.message, true);
    }
}


/* =========================================================
   EVENTS
========================================================= */

ui.form.addEventListener("input", markDirty);


for (const button of document.querySelectorAll("[data-add]")) {
    button.addEventListener("click", () => {
        const sectionName = button.dataset.add;

        if (
            !activeSource
            || !templates[sectionName]
        ) {
            return;
        }

        activeSource[sectionName].push(
            templates[sectionName]()
        );

        markDirty();
        renderRepeatSection(sectionName);
    });
}

for (const button of document.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document
            .querySelectorAll("[data-filter]")
            .forEach(
                item => item.classList.toggle(
                    "active",
                    item === button,
                )
            );

        renderLibrary();
    });
}

byId("new-adventure-button").addEventListener(
    "click",
    () => openNewSource()
);

byId("empty-new-button").addEventListener(
    "click",
    () => openNewSource()
);

ui.newBriefButton.addEventListener(
    "click",
    () => openNewSource({
        kind: "brief",
        parentDocumentId: activeVersion?.document_id ?? null,
    })
);

ui.newKind.addEventListener(
    "change",
    () => {
        ui.newDialogTitle.textContent = (
            ui.newKind.value === "brief"
                ? "New Adventure Brief"
                : "New World Bible"
        );

        updateCreateDialogKind();
    }
);

ui.newTitle.addEventListener("input", () => {
    if (!ui.newSlug.dataset.manual) {
        ui.newSlug.value = slugify(
            ui.newTitle.value
        );
    }
});

ui.newSlug.addEventListener("input", () => {
    ui.newSlug.dataset.manual = (
        ui.newSlug.value
            ? "1"
            : ""
    );
});

ui.createConfirm.addEventListener(
    "click",
    createSource
);

ui.newCancel.addEventListener(
    "click",
    () => ui.newDialog.close()
);

ui.saveButton.addEventListener(
    "click",
    () => saveDraft()
);

ui.publishButton.addEventListener(
    "click",
    publishVersion
);

ui.newVersionButton.addEventListener(
    "click",
    createNewVersion
);

ui.versionsButton.addEventListener(
    "click",
    showVersions
);

ui.versionsClose.addEventListener(
    "click",
    () => ui.versionsDialog.close()
);

ui.previewDocumentButton.addEventListener(
    "click",
    () => showPreview("document")
);

ui.previewCompiledButton.addEventListener(
    "click",
    () => showPreview("compiled")
);

ui.previewClose.addEventListener(
    "click",
    () => ui.previewDialog.close()
);

ui.duplicateButton.addEventListener(
    "click",
    openDuplicateDialog
);

ui.duplicateConfirm.addEventListener(
    "click",
    duplicateSource
);

ui.duplicateCancel.addEventListener(
    "click",
    () => ui.duplicateDialog.close()
);

ui.archiveButton.addEventListener(
    "click",
    toggleArchive
);

ui.generationQualityTier.addEventListener(
    "change",
    () => {
        renderGenerationProviderStatus();
        renderGenerationPanel();
    }
);

ui.generateSeedButton.addEventListener(
    "click",
    generateSeed
);

ui.refreshGeneratedButton.addEventListener(
    "click",
    refreshGenerated
);

ui.authorAiSubmit.addEventListener(
    "click",
    submitAuthorAiHelper
);

ui.authorAiCancel.addEventListener(
    "click",
    closeAuthorAiHelper
);

ui.authorAiClose.addEventListener(
    "click",
    closeAuthorAiHelper
);

ui.authorAiPrompt.addEventListener(
    "keydown",
    event => {
        if (
            event.key === "Enter"
            && (event.metaKey || event.ctrlKey)
        ) {
            event.preventDefault();
            void submitAuthorAiHelper();
        }
    }
);

ui.authorAiDialog.addEventListener(
    "cancel",
    event => {
        event.preventDefault();
        closeAuthorAiHelper();
    }
);

ui.authorAiDialog.addEventListener(
    "click",
    event => {
        if (event.target === ui.authorAiDialog) {
            closeAuthorAiHelper();
        }
    }
);

window.addEventListener("beforeunload", event => {
    if (dirty || saveInFlight) {
        event.preventDefault();
        event.returnValue = "";
    }
});



ui.confirmAccept.addEventListener(
    "click",
    () => closeAuthorConfirm(true)
);

ui.confirmCancel.addEventListener(
    "click",
    () => closeAuthorConfirm(false)
);

ui.confirmDialog.addEventListener(
    "cancel",
    event => {
        event.preventDefault();
        closeAuthorConfirm(false);
    }
);

ui.confirmDialog.addEventListener(
    "click",
    event => {
        if (event.target === ui.confirmDialog) {
            closeAuthorConfirm(false);
        }
    }
);


/* =========================================================
   GENERATION INFO
========================================================= */

ui.generationInfoButton.addEventListener(
    "click",
    openGenerationInfo
);

ui.generationInfoClose.addEventListener(
    "click",
    closeGenerationInfo
);

ui.generationInfoDone.addEventListener(
    "click",
    closeGenerationInfo
);

ui.generationInfoDialog.addEventListener(
    "cancel",
    event => {
        event.preventDefault();
        closeGenerationInfo();
    }
);

ui.generationInfoDialog.addEventListener(
    "click",
    event => {
        if (event.target === ui.generationInfoDialog) {
            closeGenerationInfo();
        }
    }
);


/* =========================================================
   BEGINNER AUTHORING GUIDE
========================================================= */

function openAuthorGuide() {
    ui.authorGuideDialog.showModal();
}


function closeAuthorGuide() {
    ui.authorGuideDialog.close();
}


ui.authorGuideButton.addEventListener(
    "click",
    openAuthorGuide
);


ui.authorGuideClose.addEventListener(
    "click",
    closeAuthorGuide
);


ui.authorGuideDone.addEventListener(
    "click",
    closeAuthorGuide
);


ui.authorGuideDialog.addEventListener(
    "click",
    event => {
        if (
            event.target
            === ui.authorGuideDialog
        ) {
            closeAuthorGuide();
        }
    }
);


/* =========================================================
   RETURN ROUTE
========================================================= */

function restoreReturnToGameRoute() {
    if (!ui.returnToGameLink) {
        return;
    }

    let route = "/game";

    try {
        const stored = (
            sessionStorage
            .getItem("tot:last-game-route")
            ?? ""
        ).trim();

        if (
            stored === "/game"
            || stored.startsWith("/game/")
            || stored.startsWith("/game?")
        ) {
            route = stored;
        }
    } catch {
        route = "/game";
    }

    ui.returnToGameLink.href = route;
}


/* =========================================================
   SITE-NATIVE SELECT MENUS
========================================================= */

function installTerminalSelect(nativeSelect) {
    if (
        !(nativeSelect instanceof HTMLSelectElement)
        || nativeSelect.dataset.terminalSelect === "ready"
    ) {
        return;
    }

    nativeSelect.dataset.terminalSelect = "ready";
    nativeSelect.classList.add("author-native-select-shadow");

    const shell = document.createElement("div");
    shell.className = "author-terminal-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "author-terminal-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "author-terminal-select-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    function selectedLabel() {
        const option = nativeSelect.options[nativeSelect.selectedIndex];
        return option ? option.textContent.trim() : "—";
    }

    function syncTrigger() {
        trigger.textContent = selectedLabel();
        trigger.disabled = nativeSelect.disabled;
    }

    function closeMenu() {
        menu.hidden = true;
        shell.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
    }

    function renderMenu() {
        menu.replaceChildren();

        Array.from(nativeSelect.options).forEach(option => {
            const item = document.createElement("button");
            item.type = "button";
            item.setAttribute("role", "option");
            item.setAttribute(
                "aria-selected",
                option.value === nativeSelect.value ? "true" : "false",
            );
            item.className = (
                option.value === nativeSelect.value
                    ? "is-selected"
                    : ""
            );
            item.textContent = option.textContent.trim();
            item.disabled = option.disabled;
            item.addEventListener("click", () => {
                nativeSelect.value = option.value;
                nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
                syncTrigger();
                closeMenu();
            });
            menu.appendChild(item);
        });
    }

    trigger.addEventListener("click", () => {
        if (!menu.hidden) {
            closeMenu();
            return;
        }
        renderMenu();
        menu.hidden = false;
        shell.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
    });

    nativeSelect.addEventListener("change", syncTrigger);

    const selectObserver = new MutationObserver(() => {
        syncTrigger();
        if (!menu.hidden) {
            renderMenu();
        }
    });
    selectObserver.observe(nativeSelect, {
        childList: true,
        subtree: true,
        attributes: true,
    });

    document.addEventListener("pointerdown", event => {
        if (!shell.contains(event.target)) {
            closeMenu();
        }
    });

    shell.append(trigger, menu);
    nativeSelect.insertAdjacentElement("afterend", shell);
    syncTrigger();
}


function installTerminalSelects() {
    document.querySelectorAll("select").forEach(installTerminalSelect);
}


/* =========================================================
   BOOT
========================================================= */

async function boot() {
    restoreReturnToGameRoute();
    installTerminalSelects();
    try {
        const auth = await api(
            "/api/author/me"
        );

        ui.authorUser.textContent = (
            `${auth.user.username.toUpperCase()} // AUTHOR`
        );

        await refreshLibrary();

        await refreshGenerationProviderStatus();

        await refreshGenerated();

        const first = library.find(
            item => !item.is_archived
        );

        if (first) {
            await loadVersion(
                first.document_id,
                first.latest_version,
            );
        } else {
            renderEditor();
        }

    } catch {
        document.body.innerHTML = (
            "<main class='empty-state'>"
            + "<h2>NOT AVAILABLE</h2>"
            + "<p>This private authoring console is not available to this account.</p>"
            + "<a class='button subtle' href='/game'>RETURN</a>"
            + "</main>"
        );
    }
}


boot();
