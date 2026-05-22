import { createFileRoute, Outlet } from "@tanstack/react-router";

function PontoDistribuirLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/ponto/distribuir")({
  component: PontoDistribuirLayout,
});
