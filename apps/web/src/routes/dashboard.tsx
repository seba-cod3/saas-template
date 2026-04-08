import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  // TODO: There's a bug here, is redirecting to login when it should not
  // When logging in, you need to login twice, so there must be some race condition between the isPending and session
  useEffect(() => {
    if (!isPending && !session) {
        console.log("Redirecting to login");
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Redirecting...</div>;

  async function handleLogout() {
    await authClient.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.name}</p>
      <p>Email: {session.user.email}</p>
      <p>Role: {session.user.role ?? "member"}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
