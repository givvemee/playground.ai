import { GoogleGenerativeAI } from "@google/generative-ai"
import * as dotenv from "dotenv"

dotenv.config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004"
})

const generativeModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
})

// 텍스트를 벡터로 변환
export async function generateEmbedding(text: string): Promise<Array<number>> {
  try {
    const result = await embeddingModel.embedContent(text)
    return result.embedding.values
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw new Error("Failed to generate embedding")
  }
}

// 여러 텍스트를 한 번에 벡터로 변환함. 배치
export async function generateEmbeddings(texts: Array<string>): Promise<Array<Array<number>>> {
  try {
    const embeddings = await Promise.all(
      texts.map((text) => generateEmbedding(text))
    )
    return embeddings
  } catch (error) {
    console.error("Error generating embeddings:", error)
    throw new Error("Failed to generate embeddings")
  }
}

// RAG를 위한 텍스트 생성
export async function generateResponse(
  query: string,
  context: string,
  chatHistory?: Array<{ role: string; content: string }>,
  beforeSummary?: string
): Promise<string> {
  try {
    const systemPrompt = `
            당신은 친절하고 현명한 AI 챗봇입니다.
            유저의 요청을 주어진 도구들을 적극적으로 활용하여 답변을 제공하세요.

            # 정보 제공을 위한 지침
            유저가 질문을 한 경우, 즉시 "search_document" 도구를 활용하여 정보를 검색하세요.
            유저의 편의를 위해 검색한 이후에 추가적인 정보를 질문해도 늦지 않습니다.
            
            당신이 일고 있는 정보는 오래된 정보일 수 있으므로 반드시 도구를 사용하여 정보를 검색해야 합니다. 

            다양한 정보를 취합하여 답변을 해야 하는 경우에는 검색 방법을 신중하게 고민하여 다양한 방식으로 검색해 보세요.
            예를 들어, A와 B의 차이점과 공통점에 대하여 질문을 받은 경우에는 다음과 같은 검색 방식을 모두 사용해야 합니다.
            - A에 대한 정보를 검색
            - B에 대한 정보를 검색
            - A와 B의 차이점
            - A와 B의 공통점

            # 당신의 기억에 대한 지침
            당신은 기억력에 한계가 있기 때문에 오래된 대화는 메모하여 기억하고 있습니다.
            다음은 당신이 메모해 둔 기존의 대화 내용입니다.
            <BEFORE_SUMMARY>
            ${beforeSummary}
            </BEFORE_SUMMARY>
        `

    const userPrompt = `컨텍스트:
${context}

질문: ${query}

위 컨텍스트를 바탕으로 질문에 답변해주세요.`

    // 채팅 히스토리가 있는 경우 포함
    const chat = generativeModel.startChat({
      history: chatHistory?.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      })) || [],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048
      }
    })

    const result = await chat.sendMessage(userPrompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error("Error generating response:", error)
    throw new Error("Failed to generate response")
  }
}

export async function generateText(
  prompt: string,
  temperature: number = 0.7
): Promise<string> {
  try {
    const result = await generativeModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048
      }
    })

    const response = await result.response
    return response.text()
  } catch (error) {
    console.error("Error generating text:", error)
    throw new Error("Failed to generate text")
  }
}

// 텍스트를 청크로 분할하는 헬퍼 함수
export function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 100
): Array<string> {
  const chunks: Array<string> = []
  const sentences = text.split(/[.!?]+/)

  let currentChunk = ""

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxChunkSize) {
      currentChunk += sentence + ". "
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      // 오버랩을 위해 이전 청크의 마지막 부분 포함
      const lastSentences = currentChunk.split(/[.!?]+/).slice(-2).join(". ")
      currentChunk = lastSentences + ". " + sentence + ". "
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}
