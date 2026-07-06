// Workbook auto-scroll registry for the Business Brain Workshop (PA-POS-38, §24.4).
// The player watches video.currentTime; when a trigger_sec is crossed the workbook panel
// scrolls the PDF to page_number. The PDF itself lives at /public/workshop/workbook.pdf
// (Chase drops the real 15-page workbook there on recording day).
//
// Chase tunes this file directly — keep trigger_sec ascending.

export type WorkbookMapEntry = {
  /** Video position in seconds. */
  trigger_sec: number;
  /** 1-indexed page of /public/workshop/workbook.pdf. */
  page_number: number;
};

export const WORKSHOP_WORKBOOK_MAP: readonly WorkbookMapEntry[] = [
  { trigger_sec: 0, page_number: 1 }, // cover — the 5-zone map
  { trigger_sec: 240, page_number: 2 }, // the amnesia problem, in your own numbers
  { trigger_sec: 540, page_number: 3 }, // why a repo you own (PA-POS-19 frame)
  { trigger_sec: 900, page_number: 4 }, // fork walkthrough + checklist
  { trigger_sec: 1200, page_number: 5 }, // voice zone prompts
  { trigger_sec: 1440, page_number: 6 }, // voice zone — paste-your-samples worksheet
  { trigger_sec: 1500, page_number: 7 }, // customers zone prompts
  { trigger_sec: 1800, page_number: 8 }, // products zone prompts
  { trigger_sec: 2100, page_number: 9 }, // competitive zone prompts
  { trigger_sec: 2340, page_number: 10 }, // decisions zone prompts
  { trigger_sec: 2640, page_number: 11 }, // connect-to-Claude walkthrough
  { trigger_sec: 2940, page_number: 12 }, // the maintenance problem — who updates the brain
  { trigger_sec: 3240, page_number: 13 }, // Pocket Agent login + what runs tomorrow morning
  { trigger_sec: 3480, page_number: 14 }, // your first week, mapped
  { trigger_sec: 3570, page_number: 15 }, // Friday Implementation Lab + Skool
];
