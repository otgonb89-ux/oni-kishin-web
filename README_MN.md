# ONI AI V9 Backend

Энэ нь GitHub Pages дээр ажилладаг ONI AI frontend-д зориулсан secure backend.

## Яагаад backend хэрэгтэй вэ?
OpenAI secret API key-г GitHub Pages-ийн HTML/JS дотор хийж болохгүй.
Энэ Worker дээр `OPENAI_API_KEY` secret хэлбэрээр хадгална.

## Deploy
1. Cloudflare account → Workers & Pages → Create Worker.
2. Энэ folder-ийг deploy хийнэ.
3. `npx wrangler secret put OPENAI_API_KEY` ашиглаж secret нэм. Key-г source, HTML, Firestore, эсвэл GitHub variable-д бүү хадгал.
4. `wrangler deploy`
5. Гарсан Worker URL-ээ ONI frontend-ийн:
   `window.ONI_AI_CONFIG = { endpoint: "https://YOUR-WORKER.workers.dev" }`
   гэж тохируулна.

## ONI AI V9
- Ерөнхий multi-turn conversation
- Монгол хэлний personality
- Conversation history
- Firebase members / garage / music / meet tools
- Bounded, allowlisted clan-data tools
- Unknown facts дээр hallucination хийхгүй байх policy
- OpenAI key server-side
- Tool calling
