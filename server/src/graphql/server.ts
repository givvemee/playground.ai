import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import { makeExecutableSchema } from "@graphql-tools/schema"
import * as dotenv from "dotenv"

import { useServer } from "graphql-ws/use/ws"
import { WebSocketServer } from "ws"
import { initializeDB } from "../services/qdrant.js"
import { resolvers } from "./resolvers.js"
import { typeDefs } from "./schema.js"

dotenv.config()

export async function startGraphQLServer() {
  try {
    await initializeDB()
    console.log("Qdrant 초기화 완료")

    // GraphQL schema 생성
    const schema = makeExecutableSchema({ typeDefs, resolvers })

    // Apollo Server 생성 (HTTP)
    const server = new ApolloServer({
      schema
    })

    // HTTP 서버 시작
    const { server: httpServer, url } = await startStandaloneServer(server, {
      listen: { port: 4000 },
      context: async ({ req }) => ({
        headers: req.headers
      }),
      cors: {
        origin: true,
        credentials: true
      }
    })

    // WebSocket 서버 추가 (포트 4001)
    const wsServer = new WebSocketServer({
      port: 4001,
      path: "/graphql"
    })

    const serverCleanup = useServer({ schema }, wsServer)

    console.log(`🚀 GraphQL Server running on ${url}`)
    console.log(`🔌 WebSocket Server running on ws://localhost:4001/graphql`)

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      await serverCleanup.dispose()
      await server.stop()
    })

    return url
  } catch (error) {
    console.error("서버 시작 실패:", error)
    throw error
  }
}
