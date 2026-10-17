import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Layout for `/office` and child routes (e.g. `/office/jobs/$jobId`). */
export const Route = createFileRoute("/office")({
  component: OfficeLayout,
});

function OfficeLayout() {
  return <Outlet />;
}
