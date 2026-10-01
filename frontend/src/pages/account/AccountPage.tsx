import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../state/AuthContext";

export function AccountPage() {
  const { user } = useAuth();

  return (
    <>
      <PageTitle eyebrow="ACCOUNT" title="USER ACCOUNT" />
      <Panel title="PROFILE">
        <div className="data-grid">
          <div><b>USERNAME</b><span>{user?.username}</span></div>
          <div><b>EMAIL</b><span>{user?.email}</span></div>
          <div><b>STATUS</b><span>{user?.is_active ? "ACTIVE" : "INACTIVE"}</span></div>
          <div><b>CREATED</b><span>{user?.created_at}</span></div>
        </div>
      </Panel>
    </>
  );
}
