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
  context: string
): Promise<string> {
  try {
    const systemPrompt = `당신은 해피톡 서비스에 대해 도움을 주는 친절한 AI 어시스턴트입니다.
주어진 컨텍스트를 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공하세요.
이전 대화 내용이 있다면 그 맥락을 고려하여 답변하세요.`

    const userPrompt = `${context}

현재 질문: ${query}

위 정보를 바탕으로 질문에 답변해주세요. 이전 대화가 있다면 그 맥락을 고려하여 자연스럽게 답변하세요.`

    const result = await generativeModel.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "이해했습니다. 해피톡 서비스에 대한 질문에 답변하겠습니다." }] },
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048
      }
    })

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
