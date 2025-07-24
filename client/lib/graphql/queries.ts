import { gql } from '@apollo/client';

export const SEARCH_DOCUMENTS = gql`
  query SearchDocuments($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      id
      title
      content
      score
    }
  }
`;

export const CHAT_MUTATION = gql`
  mutation Chat($message: String!, $sessionId: String) {
    chat(message: $message, sessionId: $sessionId) {
      id
      response
      sources {
        id
        title
        content
        score
      }
      timestamp
    }
  }
`;

export const UPLOAD_KNOWLEDGE = gql`
  mutation UploadKnowledge($content: String!, $title: String!) {
    uploadKnowledgeBase(content: $content, title: $title) {
      success
      documentId
      message
      documentsCreated
    }
  }
`;

// WebSocket Subscriptions
export const CHAT_STREAM_SUBSCRIPTION = gql`
  subscription ChatStream($sessionId: String!) {
    chatStream(sessionId: $sessionId) {
      id
      response
      sources {
        id
        title
        content
        score
      }
      timestamp
    }
  }
`;

export const TYPING_INDICATOR_SUBSCRIPTION = gql`
  subscription TypingIndicator($sessionId: String!) {
    typingIndicator(sessionId: $sessionId) {
      userId
      isTyping
      timestamp
    }
  }
`;