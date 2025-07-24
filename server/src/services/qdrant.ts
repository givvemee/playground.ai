import { QdrantClient } from "@qdrant/js-client-rest"
import * as dotenv from "dotenv"

dotenv.config()

// typeof Payload
export interface DocumentPayload {
  docId: number
  docTitle: string
  contents: string
  createdAt?: string
  sourceUrl?: string
  metadata?: Record<string, any>
}

export const VectorConfig = {
  size: 768,
  distance: "Cosine" as const
}
export interface DocumentPoint {
  id: number | string
  vector: Array<number>
  payload: DocumentPayload
}

export const CollectionConfig = {
  name: "knowledgeBase",
  vectors: VectorConfig,
  optimizers_config: {
    indexing_threshold: 10000,
    memmap_threshold: 20000
  }
}

const url = process.env.QDRANT_URL!
const client = new QdrantClient({ url })
const collectionName = "knowledgeBase"

// 컬렉션 생성 함수
export async function createCollection() {
  await client.createCollection(collectionName, {
    vectors: VectorConfig
  })
}

// 데이터 삽입
export async function insertData(
  data: Array<{
    documentId: number
    documentName: string
    contents: string
    contentsVector: Array<number>
  }>
) {
  const points = data.map((item) => ({
    id: item.documentId,
    vector: item.contentsVector,
    payload: {
      docId: item.documentId,
      docTitle: item.documentName,
      contents: item.contents,
      createdAt: new Date().toISOString()
    }
  }))
  await client.upsert(collectionName, {
    wait: true,
    points
  })
}

// 유사도 검색
export async function searchSimilar(queryVector: Array<number>, topK: number = 5) {
  const results = await client.search(collectionName, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    with_vector: false
  })
  return results.map((result) => ({
    id: result.id,
    score: result.score,
    payload: result.payload as unknown as DocumentPayload
  }))
}

// 초기화
export async function initializeDB() {
  try {
    const collections = await client.getCollections()
    const exists = collections.collections.some(
      (collection) => collection.name === collectionName
    )
    if (!exists) {
      await createCollection()
      console.log(`Collection ${collectionName} created successfully.`)
    } else {
      console.log(`Collection ${collectionName} already exists.`)
    }
  } catch (error) {
    console.error("Error initializing database:", error)
  }
}
