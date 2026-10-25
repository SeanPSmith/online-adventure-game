import "../styles/quillairoAdventureBoot.css";
import { Outlet, useNavigation } from "react-router";

export function RootLayout() {
  const navigation = useNavigation();

  return (
    <>
      {navigation.state !== "idle" ? (
        <div className="route-transition-status quillairo-route-transition" role="status" aria-live="polite">
          Opening the next page…
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
