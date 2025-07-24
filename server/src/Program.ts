import * as Effect from "effect/Effect"
import { startGraphQLServer } from "./graphql/server.js"

Effect.runPromise(
  Effect.promise(async () => {
    await startGraphQLServer()
    console.log("Graphql server 시작")
  })
).catch((error) => {
  console.error("Server startup failed:", error)
  process.exit(1)
})
