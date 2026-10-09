import { Outlet, useNavigation } from "react-router";

export function RootLayout() {
  const navigation = useNavigation();

  return (
    <>
      {navigation.state !== "idle" ? (
        <div className="route-transition-status" role="status" aria-live="polite">
          LOADING PAGE…
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
