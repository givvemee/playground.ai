import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import * as dotenv from "dotenv"
import { initializeDB } from "../services/qdrant.js"
import { resolvers } from "./resolvers.js"
import { typeDefs } from "./schema.js"

dotenv.config()

const server = new ApolloServer({
  typeDefs,
  resolvers
})

export async function startGraphQLServer() {
  try {
    await initializeDB()
    console.log("qdrant 초기화")

    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },
      context: async ({ req }) => ({
        headers: req.headers
      })
    })

    console.log(`🚀 GraphQL Server running on ${url}`)
    return url
  } catch (error) {
    console.error("??", error)
    throw error
  }
}
