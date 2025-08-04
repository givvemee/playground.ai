import * as fs from "fs/promises"
import * as path from "path"
import { generateEmbedding, splitTextIntoChunks } from "../services/gemini.js"
import { initializeDB, insertData } from "../services/qdrant.js"

const HAPPYTALK_DOCS_PATH = path.join(process.cwd(), "happytalk_help")

interface DocumentChunk {
  documentId: number
  documentName: string
  contents: string
  contentsVector: Array<number>
}

async function readAllDocuments(): Promise<Array<{ filename: string; content: string }>> {
  try {
    const files = await fs.readdir(HAPPYTALK_DOCS_PATH)
    const txtFiles = files.filter((file) => file.endsWith(".txt"))

    console.log(`${txtFiles.length}, 실행ㄹ 중 `)

    const documents = []

    for (const filename of txtFiles) {
      const filePath = path.join(HAPPYTALK_DOCS_PATH, filename)
      const content = await fs.readFile(filePath, "utf-8")

      if (content.trim()) {
        documents.push({ filename, content: content.trim() })
        console.log(`${filename} (${content.length} 문자)`)
      } else {
        console.log(`empty? ${filename}`)
      }
    }

    return documents
  } catch (error) {
    console.error("오류 발생:", error)
    throw error
  }
}

async function processDocuments(
  documents: Array<{ filename: string; content: string }>
): Promise<Array<DocumentChunk>> {
  const allChunks: Array<DocumentChunk> = []
  let documentId = 1

  for (const doc of documents) {
    console.log(`Processing: ${doc.filename}`)

    // 파일명에서 확장자 제거하고 정리
    const cleanFilename = doc.filename.replace(".txt", "").replace(/_/g, " ")

    // 문서를 청크로 분할 (1000자, 100자 오버랩)
    const chunks = splitTextIntoChunks(doc.content, 1000, 100)
    console.log(`${chunks.length} 청크 `)

    // 각 청크에 대해 임베딩 생성
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        // VIVI
        console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}...`)
        const embedding = await generateEmbedding(chunk)

        allChunks.push({
          documentId: documentId++,
          documentName: `${cleanFilename} (${i + 1}/${chunks.length})`,
          contents: chunk,
          contentsVector: embedding
        })

        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error processing chunk ${i + 1} of ${doc.filename}:`, error)
      }
    }
  }

  return allChunks
}

async function saveToQdrant(chunks: Array<DocumentChunk>): Promise<void> {
  console.log(`Qdrant에 저장되는 ㅋ청크: ${chunks.length}`)

  // 배치 크기 설정 (한 번에 너무 많이 저장하지 않도록)
  const batchSize = 10

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)

    try {
      await insertData(batch)
      // console.log(
      //   ` Saved batch ${Math.floor(i / batchSize) + 1}/${
      //     Math.ceil(chunks.length / batchSize)
      //   } (${batch.length} chunks)`
      // )

      // 배치 간 지연
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`오류 발생: Qdrant 저장 실패   ${Math.floor(i / batchSize) + 1}:`, error)
      // 실패한 배치는 재시도
      try {
        console.log(`Retrying batch ${Math.floor(i / batchSize) + 1}...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await insertData(batch)
      } catch (retryError) {
        console.error(`배치 실패  : ${Math.floor(i / batchSize) + 1}`, retryError)
      }
    }
  }
}

export async function loadHappytalkDocs(): Promise<void> {
  console.log("🚀 Starting Happytalk documentation loading process...\n")

  try {
    // 1. Qdrant 초기화
    console.log("1. Initializing Qdrant database...")
    await initializeDB()
    console.log(" Qdrant initialized\n")

    // 2. 문서 읽기
    console.log("2. Reading all documents...")
    const documents = await readAllDocuments()
    console.log(` Loaded ${documents.length} documents\n`)

    if (documents.length === 0) {
      console.log("No documents found to process.")
      return
    }

    // 3. 문서 처리 (청킹 + 임베딩)
    console.log("3. Processing documents (chunking + embedding)...")
    const chunks = await processDocuments(documents)
    console.log(` Processed ${chunks.length} chunks\n`)

    if (chunks.length === 0) {
      console.log("No chunks generated to save.")
      return
    }

    // 4. Qdrant에 저장
    console.log("4. Saving to Qdrant...")
    await saveToQdrant(chunks)
    console.log(` Successfully saved ${chunks.length} chunks to Qdrant\n`)

    console.log("🎉 Happytalk documentation loading completed successfully!")

    // 통계 출력
    const uniqueDocuments = new Set(chunks.map((c) => c.documentName.split(" (")[0])).size
    console.log(`\n📊 Summary:`)
    console.log(`- Documents processed: ${uniqueDocuments}`)
    console.log(`- Total chunks created: ${chunks.length}`)
    console.log(`- Average chunks per document: ${Math.round(chunks.length / uniqueDocuments)}`)
  } catch (error) {
    console.error("❌ Failed to load Happytalk documentation:", error)
    throw error
  }
}
