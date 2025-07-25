export const typeDefs = `#graphql
type Query {
  search(query: String!, limit: Int): [Document!]!
}

type Mutation {
  chat(message: String!, sessionId: String): ChatResponse!
  uploadKnowledgeBase(content: String!, title: String!): UploadResult!
}

type Subscription {
  chatStream(sessionId: String!): ChatResponse!
  typingIndicator(sessionId: String!): TypingStatus!
}

type TypingStatus {
  userId: String!
  isTyping: Boolean!
  timestamp: String!
}

type ChatResponse {
  id: String!
  response: String!
  sources: [Document!]
  timestamp: String!
}

type Document {
  id: String!
  title: String!
  content: String!
  score: Float
}

type UploadResult {
  success: Boolean!
  documentId: String
  message: String!
  documentsCreated: Int
}
`
