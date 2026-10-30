import "../styles/quillairoAdventureBoot.css";
import { Outlet, useNavigation } from "react-router";
import { RouteSkeleton } from "../components/skeleton/RouteSkeleton";

export function RootLayout() {
  const navigation = useNavigation();

  return (
    <>
      {navigation.state !== "idle" ? <RouteSkeleton path={navigation.location?.pathname} /> : null}
      <Outlet />
    </>
  );
}
