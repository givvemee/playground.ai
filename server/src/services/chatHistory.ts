// 세션별 대화 히스토리 관리
// In-memory 저장소 (프로덕션에서는 Redis 등 사용 권장)

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ChatSession {
  sessionId: string
  messages: ChatMessage[]
  createdAt: Date
  lastUpdated: Date
}

// 세션별 대화 히스토리 저장소
const chatSessions = new Map<string, ChatSession>()

// 새 세션 생성
export function createSession(sessionId: string): ChatSession {
  const session: ChatSession = {
    sessionId,
    messages: [],
    createdAt: new Date(),
    lastUpdated: new Date()
  }
  chatSessions.set(sessionId, session)
  return session
}

// 세션 가져오기 (없으면 생성)
export function getOrCreateSession(sessionId: string): ChatSession {
  let session = chatSessions.get(sessionId)
  if (!session) {
    session = createSession(sessionId)
  }
  return session
}

// 메시지 추가
export function addMessage(
  sessionId: string, 
  role: "user" | "assistant", 
  content: string
): void {
  const session = getOrCreateSession(sessionId)
  session.messages.push({
    role,
    content,
    timestamp: new Date()
  })
  session.lastUpdated = new Date()
  
  // 메시지 수 제한 (최근 20개만 유지)
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20)
  }
}

// 대화 히스토리 가져오기
export function getHistory(sessionId: string): ChatMessage[] {
  const session = chatSessions.get(sessionId)
  return session ? session.messages : []
}

// 대화 컨텍스트 문자열로 변환 (프롬프트에 사용)
export function formatHistoryForPrompt(sessionId: string, limit: number = 10): string {
  const history = getHistory(sessionId)
  const recentHistory = history.slice(-limit)
  
  if (recentHistory.length === 0) {
    return ""
  }
  
  return recentHistory
    .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n")
}

// 세션 정리 (24시간 이상 된 세션 삭제)
export function cleanupOldSessions(): void {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  for (const [sessionId, session] of chatSessions.entries()) {
    if (session.lastUpdated < oneDayAgo) {
      chatSessions.delete(sessionId)
    }
  }
}

// 주기적으로 오래된 세션 정리 (1시간마다)
setInterval(cleanupOldSessions, 60 * 60 * 1000)