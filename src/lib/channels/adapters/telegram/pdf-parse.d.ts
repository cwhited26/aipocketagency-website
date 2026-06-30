// Ambient declaration for the pdf-parse lib entry (no @types package ships for it). We lazy-import
// "pdf-parse/lib/pdf-parse.js" — the subpath that skips the package's index.js debug self-read — and
// only read `.text`, so this minimal shape keeps documents.ts free of an implicit `any`.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
