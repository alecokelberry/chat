// Whether this is a dev or e2e (`--mode test`) build, never live. A
// constant, so a production build drops everything it guards: the agent
// bridge (components/ui/dev-agent.ts) and the worst-case preview
// (worst-case.ts).
export const devBuild = import.meta.env.DEV || import.meta.env.MODE === "test"
