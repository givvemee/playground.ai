import { Effect, pipe } from "effect"
import { v4 as uuidv4 } from "uuid"
import { addMessage, formatHistoryForPrompt } from "../services/chatHistory.js"
import { generateEmbedding, generateResponse, splitTextIntoChunks } from "../services/gemini.js"
import { CHAT_MESSAGE, publishChatMessage, pubsub, TYPING_INDICATOR } from "../services/pubsub.js"
import { insertData, searchSimilar } from "../services/qdrant.js"

// 채팅 서비스 구현
const chatService = (message: string, sessionId: string) =>
  pipe(
    Effect.sync(() => addMessage(sessionId, "user", message)),
    // 메시지 임베딩 생성
    Effect.flatMap(() => Effect.promise(() => generateEmbedding(message))),
    // 유사 문서 검색
    Effect.flatMap((queryVector) => Effect.promise(() => searchSimilar(queryVector, 5))),
    Effect.flatMap((searchResults) => {
      // RAG 컨텍스트 준비
      const ragContext = searchResults
        .map((result) => result.payload.contents)
        .join("\n\n")

      // 히스토리 가져오기
      const conversationHistory = formatHistoryForPrompt(sessionId, 5)

      // 컨텍스트 구성
      const fullContext = conversationHistory
        ? `Previous conversation:\n${conversationHistory}\n\nRelevant information:\n${ragContext}`
        : `Relevant information:\n${ragContext}`

      return Effect.promise(() => generateResponse(message, fullContext))
    }),
    Effect.flatMap((response) => {
      // 어시스턴트 응답 저장
      addMessage(sessionId, "assistant", response)

      return Effect.succeed({
        id: uuidv4(),
        response,
        sources: [],
        timestamp: new Date().toISOString()
      })
    })
  )

// 지식 업로드 서비스 구현
const uploadKnowledgeService = (content: string, title: string) =>
  pipe(
    Effect.succeed(splitTextIntoChunks(content, 1000, 100)),
    Effect.flatMap((chunks) =>
      Effect.promise(async () => {
        const embeddings = await Promise.all(
          chunks.map((chunk) => generateEmbedding(chunk))
        )

        const documents = chunks.map((chunk, index) => ({
          documentId: Date.now() + index,
          documentName: title,
          contents: chunk,
          contentsVector: embeddings[index]
        }))

        await insertData(documents)
        return documents.length
      })
    ),
    Effect.map((count) => ({
      success: true,
      documentId: uuidv4(),
      message: `Successfully uploaded ${count} document chunks`,
      documentsCreated: count
    })),
    Effect.catchAll((error) =>
      Effect.succeed({
        success: false,
        documentId: null,
        message: `Upload failed: ${error}`,
        documentsCreated: 0
      })
    )
  )

export const resolvers = {
  Query: {
    search: async (_, { limit = 5, query }) => {
      try {
        const vector = await generateEmbedding(query)
        const results = await searchSimilar(vector, limit)

        return results.map((result) => ({
          id: String(result.id),
          title: result.payload.docTitle,
          content: result.payload.contents,
          score: result.score
        }))
      } catch (error) {
        console.error("Search error:", error)
        return []
      }
    }
  },
  Mutation: {
    chat: async (_, { message, sessionId }) => {
      const result = await Effect.runPromise(chatService(message, sessionId))

      // WebSocket으로 실시간 전송
      publishChatMessage(sessionId, result)

      return result
    },
    uploadKnowledgeBase: async (_, { content, title }) => {
      return Effect.runPromise(uploadKnowledgeService(content, title))
    }
  },
  Subscription: {
    chatStream: {
      subscribe: (_, { sessionId }) => {
        return pubsub.asyncIterator([CHAT_MESSAGE])
      },
      resolve: (payload, { sessionId }) => {
        // 해당 세션의 메시지만 필터링
        if (payload.sessionId === sessionId) {
          return payload.chatStream
        }
        return null
      }
    },
    typingIndicator: {
      subscribe: (_, { sessionId }) => {
        return pubsub.asyncIterator([TYPING_INDICATOR])
      },
      resolve: (payload, { sessionId }) => {
        if (payload.sessionId === sessionId) {
          return payload.typingIndicator
        }
        return null
      }
    }
  }
}
