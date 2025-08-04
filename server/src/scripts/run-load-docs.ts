import * as dotenv from "dotenv"
import { loadHappytalkDocs } from "./load-happytalk-docs.js"

// 환경변수 로드
dotenv.config()

console.log("🚀, 문서 적재 스크립트 시작...\n")

// 환경변수 확인
if (!process.env.GEMINI_API_KEY) {
  console.error("no GEMINI_API_KEY")
  process.exit(1)
}

if (!process.env.QDRANT_URL) {
  console.error("no QDRANT_URL")
  process.exit(1)
}

console.log("✓ 환경변수 확인 완료")
console.log(`✓ Qdrant URL: ${process.env.QDRANT_URL}`)
console.log(`✓ Gemini API Key: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`)
console.log()

// 문서 로딩 실행
loadHappytalkDocs()
  .then(() => {
    console.log("문서 적재 완료")
    process.exit(0)
  })
  .catch((error) => {
    console.error("문서 적재 오류:", error)
    process.exit(1)
  })
