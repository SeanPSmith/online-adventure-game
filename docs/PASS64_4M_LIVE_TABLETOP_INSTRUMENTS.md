# Pass 64.4M — Live Floating Tabletop Instruments

## Scope
Opt-in Living Book continues using the existing `AdventurePage` room state and authoritative choice/lock handlers. The default Character/Chat/Notes presentation is now floating brass-and-enamel instruments like `/game/tabletop-kit`, instead of mock-attached book tabs. "Use attached journal tabs" remains available as an optional comparison and fallback. No changes to game mechanics, authoring, cloud resources, persistence APIs, socket subscriptions, or game routes.

- **Character:** authenticated live Hero health/max, level, XP, life status and read-only stats. Never invented illustrative Hero stats.
- **Chat:** authenticated room messages and existing `AdventurePage.onSendChat`; one send per form submission. No additional sockets and no local mock-message display.
- **Notes:** `AdventurePage` keeps the local draft when Living Book unmounts during intermission. Not saved across page refresh/navigation and not advertised as persistent.
- **Accessibility:** named icon buttons with pressed/expanded states, panel headings and close buttons, Escape-to-close, focus return, reduced motion, mobile bottom dock, empty/error/disconnected states and live-message notifications.
- **Presentation:** the desk, book, ink masking, paginator, server-approved choices, and default adventure view do not change. Floating sheets appear as intentional game HUD overlays, not physically attached tabs.

## Install and acceptance

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4m-live-floating-instruments.zip && ./scripts/check-project.sh
```

Only after full green suite, run `./scripts/release-staging.sh "Pass 64.4M: Live floating tabletop instruments"`.

In staging, enter an existing adventure with `?reader=book`. Confirm Character matches the actual Hero, Chat sends **once** to the current room, and Notes survives temporary UI fallback to an intermission (but does not claim server persistence). Confirm the style toggle exposes attached tabs without remounting the adventure, choices lock exactly once, and standard reader still works. Test 1280×800, 1600×900, and 390px; focus/Tab/Escape and reduced motion. Verify no extra WebSocket in DevTools. Check the ink mask and pagination still behave.

**Not implemented:** notes storage, cosmetic entitlements/store, isolated anchor props, Story Time/inventory HUD, porting dice/QTE/intermission into the Living Book, changing camera or book photograph.
