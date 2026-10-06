/* Tales of Two // closed-page Web Push worker */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "TALES OF TWO", message: event.data?.text?.() || "Adventure activity is waiting." };
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const alreadyWatching = windows.some((client) => client.visibilityState === "visible" && client.focused);
    if (alreadyWatching) return;

    await self.registration.showNotification(payload.title || "TALES OF TWO", {
      body: payload.message || "Adventure activity is waiting.",
      tag: payload.tag || `tales-of-two:${payload.kind || "activity"}:${payload.room_code || "game"}`,
      renotify: true,
      data: {
        route: payload.route || "/game",
      },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification?.data?.route || "/game";
  const destination = new URL(route, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(destination);
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(destination);
  })());
});
