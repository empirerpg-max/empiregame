import { createFileRoute, Outlet } from "@tanstack/react-router";

function PontoPlaylistsLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/ponto/playlists")({
  component: PontoPlaylistsLayout,
});
