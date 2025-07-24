import { PubSub } from "graphql-subscriptions"

export const pubsub = new PubSub()

// Event names
export const CHAT_MESSAGE = "CHAT_MESSAGE"
export const TYPING_INDICATOR = "TYPING_INDICATOR"

// Typing status management
const typingUsers = new Map<string, Set<string>>()

export function setUserTyping(sessionId: string, userId: string, isTyping: boolean) {
  if (!typingUsers.has(sessionId)) {
    typingUsers.set(sessionId, new Set())
  }

  const sessionUsers = typingUsers.get(sessionId)!

  if (isTyping) {
    sessionUsers.add(userId)
  } else {
    sessionUsers.delete(userId)
  }

  // Publish typing status
  pubsub.publish(TYPING_INDICATOR, {
    typingIndicator: {
      userId,
      isTyping,
      timestamp: new Date().toISOString()
    },
    sessionId
  })
}

export function publishChatMessage(sessionId: string, chatResponse: any) {
  pubsub.publish(CHAT_MESSAGE, {
    chatStream: chatResponse,
    sessionId
  })
}
