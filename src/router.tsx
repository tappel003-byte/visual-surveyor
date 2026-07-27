import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
// NOTE: Service worker registration lives inline in public/survey.html — that
// iframe document is the visible UI, so it owns the SW lifecycle and update
// banner. The outer React shell intentionally does NOT register to guarantee
// exactly one registration path across the app.


export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
