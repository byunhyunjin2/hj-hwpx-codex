/** 표 행 나눔과 하위 목록 조판. 본문 조판 함수는 인자로 받아 중첩 흐름을 이어간다. */
import { buildPara, collectCells, findFirst, measureTableHeight, measureTableRowHeights, captionExtra, captionOf, cellContentExtent, cellMarginOf, OBJ_TAGS, elements, ln, num } from "./para-model.js"
import { type RenderStyles, type RenderParaGeom } from "./head-styles.js"
import { type NumberCounters } from "./para-number.js"
import { type WrapMode } from "../hwpx/text-metrics.js"
import { findChildByLocalName } from "../hwpx/parser-shared.js"
import { solveRowHeights } from "./layout.js"

type BlockFlow = (container: Element, doc: Document, styles: RenderStyles, areaW: number, mode: WrapMode,
  counter: { n: number; bodyW?: number; endNoteW?: number; nums?: NumberCounters }, bodyH: number) => void

/**
 * 글 없는 문단에 앵커된 떠 있는 위아래 배치 표(문단 기준)가 lim 을 넘으면 행 단위로 쪽을 나눠, 마지막 쪽에서 표 바닥(outMargin 아래 포함)을 돌려준다.
 * 행은 (행 바닥 + outMargin 아래) ≤ 쪽 바닥일 때까지 그 쪽에 놓인다. 그런 표가 없으면 undefined
 */
/** 글 없는 문단의 어울림(SQUARE) 표가 쪽 바닥을 넘는지 — 위아래 배치와 달리 문단 바닥을 밀지 않아 따로 본다.
 *  넘으면 위아래 배치 표처럼 행 단위로 나뉜다(한컴 저장본: 새 쪽 맨 위의 어울림 CELL 표 칸 줄이 쪽마다 0 부터) */
export function squareTableOver(p: Element, startV: number, lim: number, withText = false, areaW = 0): boolean {
  const m = buildPara(p)
  if (!withText && m.chars.some(c => c.ch !== "")) return false
  return m.objs.some(o => {
    if (o.inline || o.tag !== "tbl" || o.el.getAttribute("textWrap") !== "SQUARE") return false
    const pb = o.el.getAttribute("pageBreak")
    if (pb !== "CELL" && pb !== "TABLE") return false
    const pos = findChildByLocalName(o.el, "pos"), om = findChildByLocalName(o.el, "outMargin")
    if ((pos?.getAttribute("vertRelTo") ?? "PARA") !== "PARA") return false
    const vo = num(pos, "vertOffset"), voS = Math.max(0, vo >= 2 ** 31 ? vo - 2 ** 32 : vo)
    if (withText && Math.max(0, num(pos, "horzOffset")) + num(om, "left") + o.width + num(om, "right") < areaW - 1440) return false
    return startV + voS + num(om, "top") + (withText ? measureTableHeight(o.el) : Math.max(o.height, measureTableHeight(o.el))) + num(om, "bottom") > lim
  })
}

/** 글머리표 문단인 빈 호스트에 위아래 배치 표만 있다 — 줄은 표 아래로 간다(공백 호스트처럼) */
export function bulletEmptyHost(p: Element, g?: RenderParaGeom): boolean {
  if (!g?.bullet) return false
  const m = buildPara(p)
  return m.objs.length > 0 && !m.chars.some(c => c.ch !== "" && c.ch.trim() !== "") && m.objs.every(o => !o.inline && o.tag === "tbl" && o.el.getAttribute("textWrap") === "TOP_AND_BOTTOM")
}

export function hasTbFloat(p: Element): boolean {
  return buildPara(p).objs.some(o => !o.inline && o.el.getAttribute("textWrap") === "TOP_AND_BOTTOM" && (findChildByLocalName(o.el, "pos")?.getAttribute("vertRelTo") ?? "PARA") === "PARA")
}

export function m0Objs(p: Element): Element | undefined {
  return buildPara(p).objs.find(o => !o.inline && o.tag === "tbl")?.el
}

/** 칸 내용(+ 칸 여백)만으로 잰 표 높이 — 저장된 칸 높이(cellSz)는 보지 않는다 */
function contentTableHeight(tbl: Element): number {
  const cells = collectCells(tbl)
  if (!cells.length) return 0
  const n = Math.max(...cells.map(c => c.ra + c.rs))
  return solveRowHeights(cells.map(c => ({ rowAddr: c.ra, rowSpan: c.rs, height: c.rs === 1 ? cellContentExtent(c) + c.marginT + c.marginB : 0, contentH: c.rs === 1 ? undefined : cellContentExtent(c) + c.marginT + c.marginB })), n).reduce((a, b) => a + b, 0)
}

/** 글 있는 문단의 오프셋(> 0) 위아래 배치 나눔 표가 쪽 바닥을 넘는가 — top 은 문단 영역 위(위 간격 앞) */
export function bandTableOver(p: Element, top: number, lim: number): boolean {
  const m = buildPara(p)
  if (!m.chars.some(c => c.ch !== "" && c.ch.trim() !== "")) return false
  return m.objs.some(o => {
    if (o.inline || o.tag !== "tbl" || o.el.getAttribute("textWrap") !== "TOP_AND_BOTTOM") return false
    const pb = o.el.getAttribute("pageBreak")
    if (pb !== "CELL" && pb !== "TABLE") return false
    const pos = findChildByLocalName(o.el, "pos"), om = findChildByLocalName(o.el, "outMargin")
    if ((pos?.getAttribute("vertRelTo") ?? "PARA") !== "PARA") return false
    const vo = num(pos, "vertOffset")
    if (vo <= 0 || vo >= 2 ** 31) return false
    return top + vo + num(om, "top") + contentTableHeight(o.el) + num(om, "bottom") > lim
  })
}

export function splitFloatTableRemainder(p: Element, startV: number, lim: number, bodyH: number, styles?: RenderStyles, withText = false, notes?: SplitNotes): number | undefined {
  const m = buildPara(p)
  if (!withText && m.chars.some(c => c.ch !== "")) return undefined
  let best: number | undefined, whole = true
  for (const o of m.objs) {
    if (o.inline || o.tag !== "tbl" || !(o.el.getAttribute("textWrap") === "TOP_AND_BOTTOM" || o.el.getAttribute("textWrap") === "SQUARE")) continue
    const pos = findChildByLocalName(o.el, "pos")
    if ((pos?.getAttribute("vertRelTo") ?? "PARA") !== "PARA") continue
    const b = splitTableRows(o.el, startV + Math.max(0, num(pos, "vertOffset")), lim, bodyH, styles, notes)
    if (b !== undefined) { best = Math.max(best ?? 0, b); whole &&= splitWhole }
  }
  splitWhole = best !== undefined && whole
  return best
}

/**
 * 표를 쪽 바닥에서 나눈다 — 행 단위(pageBreak=TABLE)와 칸 안 나눔(CELL — 넘치는 행은 쪽 바닥에서 갈라 나머지를 다음 쪽 맨 위에).
 * top 은 표 바깥 여백 위쪽 자리. 마지막 쪽에서 표 바닥(outMargin 아래 포함)을 돌려준다. 나누지 않는 표는 undefined.
 * 칸 안에서 갈린 칸의 줄은 쪽마다 0 부터 다시 적는다(rebaseSplitCells)
 */
/** 마지막 splitTableRows 가 첫 행부터 안 들어 표를 통째로 다음 쪽으로 옮겼는가 */
export let splitWhole = false
/** 표 칸 안 각주 — 첫 쪽에 이미 놓인 각주(n0·s0)와 각주 영역 높이 함수 */
interface SplitNotes { n0: number; s0: number; area: (n: number, sum: number) => number }
/** 마지막 splitTableRows 가 쪽을 넘겼을 때 표가 끝나는 쪽에 남기는 칸 안 각주(수·높이 합) */
export let splitNotesLast = { n: 0, s: 0 }
/** 마지막 splitTableRows 가 행을 다음 쪽으로 넘겼는가(아니면 표가 그 쪽에 다 든다) */
export let splitMovedLast = false
function noteBottom(fn: Element): number {
  const sub = findChildByLocalName(fn, "subList")
  let bottom = 0
  for (const q of sub ? elements(sub) : []) {
    if (ln(q) !== "p") continue
    const lsa = findChildByLocalName(q, "linesegarray")
    for (const seg of lsa ? elements(lsa) : []) if (ln(seg) === "lineseg") bottom = Math.max(bottom, num(seg, "vertpos") + num(seg, "vertsize"))
  }
  return bottom
}
function splitTableRows(tbl: Element, top: number, lim: number, bodyH: number, styles?: RenderStyles, notes?: SplitNotes): number | undefined {
  splitWhole = false
  splitNotesLast = { n: 0, s: 0 }
  const mode = tbl.getAttribute("pageBreak")
  if (mode !== "TABLE" && mode !== "CELL") return undefined
  const om = findChildByLocalName(tbl, "outMargin")
  const outB = num(om, "bottom")
  const rows = measureTableRowHeights(tbl)
  if (rows.length === 0) return undefined
  const outT = num(om, "top")
  // 위·아래 캡션은 표에 한 번만 선다 — 위 캡션은 첫 조각 앞, 아래 캡션은 마지막 조각 뒤(새 쪽마다 되풀이하지 않는다)
  const cap = captionOf(tbl)
  const capTop = cap?.side === "TOP" ? cap.h + cap.gap : 0, capBottom = cap?.side === "BOTTOM" ? cap.h + cap.gap : 0
  // 머리 행 반복(repeatHeader)이면 새 쪽마다 앞쪽 머리 행(칸 header="1")이 먼저 선다(한컴 저장본: 103행 조문 표의 칸 줄이 쪽마다 머리 행 아래에서 다시 시작)
  let headH = 0
  if (tbl.getAttribute("repeatHeader") === "1") {
    const heads = new Set<number>()
    for (const c of collectCells(tbl)) if (c.el.getAttribute("header") === "1") for (let r = c.ra; r < c.ra + c.rs; r++) heads.add(r)
    for (let r = 0; heads.has(r) && r < rows.length; r++) headH += rows[r]
  }
  // 넘치는 행은 다음 쪽 맨 위(outMargin 위 아래)로 — 첫 쪽에서 첫 행부터 넘치면 표째 넘어간다. 새 쪽 첫 행은 넘쳐도 그 쪽에 둔다
  let y = top + outT + capTop, floor = lim, moved = false
  // 칸 안 각주 — 본문이 먼저다: 쪽에서 처음 나오는 표 안 각주만 앞 두 줄 몫으로 그 쪽 바닥을 올리고(나머지 줄은 다음 쪽으로 이어진다),
  // 뒤 각주는 다음 쪽으로 미뤄 바닥을 올리지 않는다(한컴 저장본: 칸 안 각주 6개인 7행 표가 첫 쪽에 5행 11645(= 저장 표 높이) —
  // 첫 각주 네 줄 중 두 줄 2072 만 첫 쪽, 나머지 각주는 다음 쪽)
  const rowNoteLines: number[][][] = rows.map(() => [])
  let allN = 0, allS = 0
  if (notes) for (const c of collectCells(tbl)) for (const fn of Array.from(c.el.getElementsByTagName("hp:footNote") as unknown as Element[])) {
    rowNoteLines[Math.min(c.ra, rows.length - 1)].push(Array.from(fn.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(sg => num(sg, "vertpos") + num(sg, "vertsize")))
    allN++; allS += noteBottom(fn)
  }
  /** 이 쪽 바닥을 올리는 표 안 각주(쪽의 첫 각주 앞 두 줄) · 앞 쪽들에 놓고 온 몫 */
  let nN = 0, nS = 0, placed = 0
  const fl = (): number => (notes && nN > 0 ? Math.min(floor, bodyH - notes.area((moved ? 0 : notes.n0) + nN, (moved ? 0 : notes.s0) + nS)) : floor)
  // 칸 간격(cellSpacing) — 쪽에서 갈린 행 조각도 위아래에 간격을 하나씩 둔다(행 높이에는 measureTableRowHeights 가 넣었다)
  // (한컴 저장본: 간격 255 표의 갈린 칸이 쪽 바닥에서 한 줄 일찍 끊긴다)
  const sp = num(tbl, "cellSpacing")
  const cells = mode === "CELL" ? collectCells(tbl) : []
  const record = mode === "CELL" ? new Map<Element, number[]>() : undefined
  const carries = new Map<Element, Map<number, number>>()
  for (let r = 0; r < rows.length; r++) {
    let h = rows[r]
    for (const ls of rowNoteLines[r]) if (nN === 0 && ls.length) { nN = 1; nS = ls[Math.min(1, ls.length - 1)] }
    if (mode === "CELL") {
      // 행을 칸 줄 경계에서 가른다 — 칸마다 쪽에 드는 줄까지 이 쪽, 나머지 줄은 다음 쪽 맨 위에서 칸 여백과 함께
      const from = new Map<Element, number>(), bases = new Map<Element, number>()
      while (y + h + outB > fl() && bodyH - outT - outB > 0) {
        // 이어지는 쪽에서 행을 가를 때는 칸 줄이 쪽 바닥에서 100 넘게 떨어져야 든다(한컴 저장본: 이어지는 쪽에서 넘어간 줄의 남았을 여유 21~98,
        // 남은 줄은 114 이상), 첫 쪽에서는 20(넘어간 줄의 남았을 여유 18, 남은 줄 23). 행 전체가 쪽에 들면 그 행은 가르지 않는다(편람: 바닥 가까이에서 끝나는 행이 그 쪽에 남는다)
        // 쪽에 남는 행 조각은 남은 높이보다 101 작고, 칸 높이를 고정한 표(noAdjust)는 2 작다 — 한컴 저장본: 칸 안 나눔 표의 저장 높이 = 첫 쪽 조각,
        // 조각이 남은 높이 − 101~102 인 표 52곳은 모두 고정 아님, − 2 인 표 10곳은 모두 고정. 고정 표는 칸 저장 높이를 쪽마다 나눠 가져
        // 위 정렬 칸도 저장 높이 − 조각이 다음 쪽 몫이다(위 정렬 29,198 칸 = 첫 쪽 11,058 + 다음 쪽 18,140 — 남은 글만 세면 797 모자람)
        const fixedRows = tbl.getAttribute("noAdjust") === "1"
        const rem = cellRowRemainder(cells, r, fl() - outB - y - (moved ? 100 : 20) - 2 * sp, from, record, bases, carries, styles, bodyH - outT - outB, fl() - outB - y - (fixedRows ? 2 : 101) - 2 * sp, fixedRows)
        // 마지막 행의 칸 줄이 이 쪽에 다 들면(넘는 것은 저장된 행의 빈 높이뿐) 표는 이 쪽에서 끝난다 — 다음 쪽에 바깥 여백만 남기지 않는다
        // (한컴 저장본: 글이 다 든 21090 행이 쪽 바닥을 넘는 3행 표 뒤 빈 문단이 다음 쪽 0, 종전 566)
        if (rem === 0 && r === rows.length - 1) break
        if (rem === undefined || rem + sp + (r === rows.length - 1 ? sp : 0) >= h) {
          if (moved && y === outT + headH) break
          if (!moved && r === 0) splitWhole = true
        } else h = rem + sp + (r === rows.length - 1 ? sp : 0)
        y = outT + headH; floor = bodyH; moved = true; placed += nS; nN = 0; nS = 0
      }
      y += h
      continue
    }
    if (y + h + outB > fl() && !(moved && y === outT + headH)) { if (!moved && r === 0) splitWhole = true; y = outT + headH; floor = bodyH; moved = true; placed += nS; nN = 0; nS = 0 }
    y += h
  }
  if (record) rebaseSplitCells(record, carries, styles)
  // 앞 쪽들에 놓고 온 몫을 뺀 표 안 각주는 표가 끝나는 쪽 각주로 남긴다(뒤 문단의 쪽 바닥)
  if (moved) splitNotesLast = { n: allN, s: Math.max(0, allS - placed) }
  splitMovedLast = moved
  return y + capBottom + outB
}

/**
 * 칸 안 나눔(CELL) 행을 쪽에 남은 높이 avail 에서 가를 때 다음 쪽으로 넘어가는 행 높이. 칸마다 (칸 위 여백 + 줄 바닥) ≤ avail − 칸 아래 여백 인 줄까지
 * 이 쪽에 두고, 남은 줄(첫 남은 줄 위 ~ 내용 끝)에 칸 위아래 여백을 더한다. 어느 칸도 한 줄을 못 넣으면 undefined(행째 다음 쪽)
 */
function cellRowRemainder(cells: ReturnType<typeof collectCells>, row: number, avail: number, from: Map<Element, number>, record?: Map<Element, number[]>, bases?: Map<Element, number>, carries?: Map<Element, Map<number, number>>, styles?: RenderStyles, contH = 0, piece = Infinity, fixedRows = false): number | undefined {
  // from: 칸마다 앞 쪽들에 이미 놓은 내용 위치 — 그 위치부터의 줄만 이 쪽에 채운다(가른 뒤 갱신)
  // bases: 그 쪽 조각의 기준 — 자르기 직전 줄의 끝(줄 위치 + 높이 + 간격). 넘어간 줄은 그만큼 올라와 0 부터 다시 적힌다(rebaseSplitCells)
  let rem = 0, any = false, placed = false
  const cuts: [Element, number, number][] = []
  for (const c of cells) {
    if (c.ra !== row || c.rs !== 1 || !c.sub) continue
    const off = from.get(c.el) ?? 0, base = bases?.get(c.el) ?? 0
    // 쪽 바닥을 넘는 칸 안 위아래 배치 개체는 다음 쪽 맨 위로 옮겨 간다(vertOffset 은 버린다) — 이 쪽의 뒤 글은 개체에 밀리지 않고 이어지며,
    // 다음 쪽 글은 그 개체 아래에서 시작한다(한컴 저장본: 큰 칸 안 그림 바깥 852 + 13924 + 캡션 2050 + 852 = 다음 쪽 첫 줄 17678)
    const limAbs = base + avail - c.marginB - c.marginT
    let carry = 0, carryFrom = Infinity
    let splitAt: { bottom: number; rem: number } | undefined
    for (let guard = 0; guard < 16; guard++) {
      const f = subFloatBottoms(c.sub).find(f => f.v0 >= off && f.lineBottom <= limAbs && f.bottom > limAbs && f.v0 < carryFrom)
      if (!f) break
      // 나뉘는 표는 이 쪽에 드는 행까지 남기고 나머지 행만 다음 쪽 맨 위로 — 뒤 글은 그 아래(한컴 저장본: 첫 행 2797 이 쪽 바닥 74837 까지 들고
      // 나머지 7행 34766 + 바깥 140×2 = 다음 쪽 첫 줄 35046)
      if (f.rows?.length) {
        let y = f.bottom - f.carry + f.outT!, k = 0
        while (k < f.rows.length && y + f.rows[k] <= limAbs) y += f.rows[k++]
        // 행이 모두 들면(바깥 아래 여백만 넘침) 표는 이 쪽에 그대로, 뒤 글만 다음 쪽 맨 위에서(한컴 저장본: 표 바닥 74636 뒤 빈 문단이 다음 쪽 0)
        if (k === f.rows.length) break
        // 표는 같은 나눔으로 재귀해 쪽마다 가르고(칸 안 나눔은 칸 줄 경계에서, 여러 쪽이면 쪽마다), 마지막 쪽의 표 바닥 아래에서 뒤 글이 이어진다 —
        // 중첩 칸 줄도 쪽마다 다시 적힌다(한컴 저장본: 머리 행 반복 70행 표가 두 쪽을 넘겨 끝난 뒤 다음 줄 10132). 첫 행부터 안 드는 TABLE 표는 표째 옮긴다
        if ((k > 0 || f.el?.getAttribute("pageBreak") === "CELL") && contH > 0 && f.el) {
          const nested = splitTableRows(f.el, f.bottom - f.carry - base, avail - c.marginB - c.marginT, contH - c.marginT - c.marginB, styles)
          const rem = nested ?? (k > 0 ? f.outT! + f.rows.slice(k).reduce((a, b) => a + b, 0) + f.outB! : undefined)
          if (rem !== undefined) { splitAt = { bottom: f.bottom, rem }; carryFrom = f.v0; break }
        }
      }
      const delta = f.bottom - f.hostEnd
      if (delta > 0) for (const p of elements(c.sub)) if (ln(p) === "p") { const lsa = findChildByLocalName(p, "linesegarray"); for (const sg of lsa ? elements(lsa) : []) if (ln(sg) === "lineseg" && num(sg, "vertpos") >= f.bottom) sg.setAttribute("vertpos", String(num(sg, "vertpos") - delta)) }
      carry = Math.max(carry, f.carry); carryFrom = f.v0
    }
    const segs: Element[] = []
    for (const p of elements(c.sub)) if (ln(p) === "p") {
      const lsa = findChildByLocalName(p, "linesegarray")
      for (const sg of lsa ? elements(lsa) : []) if (ln(sg) === "lineseg" && num(sg, "vertpos") >= off) segs.push(sg)
    }
    if (segs.length === 0) continue
    any = true
    const lines = segs.map(sg => [num(sg, "vertpos") - base, num(sg, "vertpos") + num(sg, "vertsize") - base] as [number, number])
    const end = Math.max(...lines.map(l => l[1]))
    const k = lines.findIndex(l => c.marginT + l[1] > avail - c.marginB)
    if (k < 0) {
      // 모든 줄을 이 쪽에 놓았다. 저장된 행의 빈 높이는 다음 쪽 내용이 아니다.
      placed = true
      // 줄은 다 들어도 옮겨 간 개체가 있으면 그 개체가 다음 쪽 조각이다(한컴 저장본: 그림 칸의 빈 줄은 이 쪽에, 그림은 다음 쪽 맨 위)
      if (carry > 0) rem = Math.max(rem, c.marginT + carry + c.marginB)
      cuts.push([c.el, base + end + 1, base]); continue
    }
    if (k > 0) placed = true
    let nb = k > 0 ? num(segs[k - 1], "vertpos") + num(segs[k - 1], "vertsize") + num(segs[k - 1], "spacing") + spaceAfterAt(segs[k - 1], styles) : base
    const cutV = num(segs[k], "vertpos")
    for (const f of subFloatBottoms(c.sub)) if (f.v0 >= off && f.v0 < cutV && f.bottom <= cutV) nb = Math.max(nb, f.bottom)
    if (splitAt && cutV >= splitAt.bottom) { nb = Math.max(nb, splitAt.bottom); carry = splitAt.rem - (cutV - splitAt.bottom) }
    if (carry > 0 && cutV > carryFrom) { nb -= carry; const m = carries?.get(c.sub) ?? new Map<number, number>(); m.set(cutV, carry); carries?.set(c.sub, m) }
    cuts.push([c.el, base + lines[k][0], nb])
    rem = Math.max(rem, end + base - nb + c.marginT + c.marginB)
    // 가운데·아래 정렬 칸(과 칸 높이 고정 표의 모든 칸)은 글이 덜 차도 저장 높이만큼 선다 — 처음 가르는 칸은 저장 높이에서 이 쪽 조각(piece)을 뺀 만큼이 다음 쪽 몫
    // (한컴 저장본: 가운데 정렬 83,780 칸이 첫 쪽 55,937 + 다음 쪽 27,843 — 남은 글만 세면 24,176 이라 뒤 문단이 3,667 위로 올라왔다)
    if (off === 0 && (fixedRows || /^(CENTER|BOTTOM)$/.test(c.sub.getAttribute("vertAlign") ?? ""))) rem = Math.max(rem, c.h - piece)
  }
  if (!(any && placed)) return undefined
  for (const [el, v, nb] of cuts) { from.set(el, v); bases?.set(el, nb) }
  if (record) for (const c of cells) {
    if (c.ra !== row || c.rs !== 1 || !c.sub) continue
    const v = from.get(c.el)
    if (v === undefined) continue
    const list = record.get(c.sub) ?? []
    // 끝까지 다 든 칸(줄 끝 + 1)은 자른 자리가 아니다
    let last = 0
    for (const p of elements(c.sub)) if (ln(p) === "p") { const lsa = findChildByLocalName(p, "linesegarray"); for (const sg of lsa ? elements(lsa) : []) if (ln(sg) === "lineseg") last = Math.max(last, num(sg, "vertpos") + num(sg, "vertsize")) }
    if (v <= last && !list.includes(v)) { list.push(v); record.set(c.sub, list) }
  }
  return rem
}

/** 글이 공백뿐인 문단(빈칸 하나 이상, 인라인 개체 없음) */
export function spacesHost(p: Element): boolean {
  const m = buildPara(p)
  return m.chars.some(c => c.ch === " ") && m.chars.every(c => c.ch === "" || c.ch === " ") && !m.objs.some(o => o.inline)
}

/** 칸 안 문단에 앵커된 위아래 배치 개체 — 앵커 문단 첫 줄 위치·그 줄 바닥·문단 글 끝(간격 포함), 개체 바닥(vertOffset·바깥 여백·캡션 포함),
 *  다음 쪽으로 옮겨 갈 때 차지하는 높이(vertOffset 뺀 것).
 *  칸이 쪽에서 갈릴 때 자르기 직전 개체 바닥도 새 조각의 기준이 된다 — 개체에 밀려 넘어간 문단은 새 쪽 0 에서
 *  (한컴 저장본: 큰 칸 안 표 바닥 74636 에 밀린 빈 문단이 다음 쪽 0, 종전엔 표 몫 7936 이 새 쪽 위에 남았다) */
export interface SubFloat { v0: number; bottom: number; carry: number; hostEnd: number; lineBottom: number; rows?: number[]; outT?: number; outB?: number; el?: Element; seg?: Element }
export function subFloatBottoms(sub: Element): SubFloat[] {
  const out: SubFloat[] = []
  for (const p of elements(sub)) {
    if (ln(p) !== "p") continue
    const lsa = findChildByLocalName(p, "linesegarray"), segs = lsa ? elements(lsa).filter(e => ln(e) === "lineseg") : [], seg = segs[0]
    if (!seg) continue
    const last = segs[segs.length - 1], hostEnd = num(last, "vertpos") + num(last, "vertsize") + num(last, "spacing")
    for (const run of elements(p)) {
      if (ln(run) !== "run") continue
      for (const o of elements(run)) {
        if (!OBJ_TAGS.has(ln(o)) || o.getAttribute("textWrap") !== "TOP_AND_BOTTOM") continue
        const pos = findChildByLocalName(o, "pos")
        if (pos?.getAttribute("treatAsChar") === "1" || (pos?.getAttribute("vertRelTo") ?? "PARA") !== "PARA") continue
        const om = findChildByLocalName(o, "outMargin"), sz = findChildByLocalName(o, "sz")
        const h = (ln(o) === "tbl" ? Math.max(num(sz, "height"), measureTableHeight(o)) : num(sz, "height")) + captionExtra(o)
        const vo = num(pos, "vertOffset"), v0 = num(seg, "vertpos"), carry = num(om, "top") + h + num(om, "bottom")
        const voS = Math.max(0, vo >= 2 ** 31 ? vo - 2 ** 32 : vo) + (o.hasAttribute("data-hwp5-unpushed-anchor") ? Number(o.getAttribute("data-hwp5-unpushed-anchor")) : 0)
        const split = ln(o) === "tbl" && (o.getAttribute("pageBreak") === "CELL" || o.getAttribute("pageBreak") === "TABLE")
        const rowInfo = split ? { rows: measureTableRowHeights(o), outT: num(om, "top"), outB: num(om, "bottom"), el: o } : {}
        // 공백만 있는 호스트는 줄이 개체 아래에 있다 — 개체 자리는 그 줄 위(옮겨 가면 줄도 제자리로 올라온다)
        if (spacesHost(p) && !o.hasAttribute("data-hwp5-unpushed-anchor")) { const top0 = v0 - voS - carry; out.push({ v0: top0, bottom: v0, carry, hostEnd: top0, lineBottom: top0 + num(seg, "vertsize"), ...rowInfo, seg }); continue }
        out.push({ v0, bottom: v0 + voS + carry, carry, hostEnd, lineBottom: v0 + num(seg, "vertsize"), ...rowInfo, seg })
      }
    }
  }
  return out
}

/** 칸 안에서 쪽이 갈린 칸의 줄을 조각마다 다시 적는다 — 넘어간 줄은 자르기 직전 줄의 끝(줄 위치 + 높이 + 간격)을 0 으로
 *  (한컴 저장본: 쪽을 넘는 큰 칸의 줄 vertpos 가 쪽마다 0 부터 — 문단 위 간격 1500 인 문단이 새 쪽 1500) */
/** 문단 마지막 줄이면 그 문단의 아래 간격 — 쪽이 바뀌면 앞 문단 아래 간격은 새 쪽에 남지 않는다(다음 문단 위 간격만 남는다)
 *  (한컴 저장본: 아래 간격 570 문단 뒤에서 갈린 칸의 다음 쪽 첫 줄 0) */
function spaceAfterAt(sg: Element, styles?: RenderStyles): number {
  if (!styles) return 0
  const lsa = sg.parentNode as Element | null, p = lsa?.parentNode as Element | null
  if (!lsa || !p) return 0
  const segs = elements(lsa).filter(e => ln(e) === "lineseg")
  if (segs[segs.length - 1] !== sg) return 0
  return styles.paraGeom.get(p.getAttribute("paraPrIDRef") ?? "")?.spaceAfter ?? 0
}

function rebaseSplitCells(record: Map<Element, number[]>, carries?: Map<Element, Map<number, number>>, styles?: RenderStyles): void {
  for (const [sub, cuts] of record) {
    const segs: Element[] = []
    for (const p of elements(sub)) if (ln(p) === "p") { const lsa = findChildByLocalName(p, "linesegarray"); for (const sg of lsa ? elements(lsa) : []) if (ln(sg) === "lineseg") segs.push(sg) }
    const old = segs.map(sg => num(sg, "vertpos"))
    const floats = subFloatBottoms(sub)
    const sorted = [...cuts].sort((a, b) => a - b)
    const bases = sorted.map(c => {
      let base = 0
      segs.forEach((sg, i) => { if (old[i] < c) base = Math.max(base, old[i] + num(sg, "vertsize") + num(sg, "spacing") + spaceAfterAt(sg, styles)) })
      for (const f of floats) if (f.v0 < c && f.bottom <= c) base = Math.max(base, f.bottom)
      return base - (carries?.get(sub)?.get(c) ?? 0)
    })
    segs.forEach((sg, i) => {
      let j = -1
      for (let k = 0; k < sorted.length; k++) if (old[i] >= sorted[k]) j = k
      if (j >= 0) sg.setAttribute("vertpos", String(old[i] - bases[j]))
    })
  }
}

/** 문단에 앵커된, 쪽 아래에 붙은 위아래 배치 개체가 본문 바닥에서 차지하는 높이(바깥 여백·vertOffset 포함). 없으면 0 */
export function pageBottomReserve(p: Element): number {
  let r = 0
  for (const run of elements(p)) {
    if (ln(run) !== "run") continue
    for (const o of elements(run)) {
      if (!OBJ_TAGS.has(ln(o)) || o.getAttribute("textWrap") !== "TOP_AND_BOTTOM") continue
      const pos = findChildByLocalName(o, "pos")
      if (pos?.getAttribute("treatAsChar") === "1" || pos?.getAttribute("vertRelTo") !== "PAGE" || pos?.getAttribute("vertAlign") !== "BOTTOM") continue
      const om = findChildByLocalName(o, "outMargin"), sz = findChildByLocalName(o, "sz")
      const h = ln(o) === "tbl" ? Math.max(num(sz, "height"), measureTableHeight(o)) : num(sz, "height")
      r = Math.max(r, num(pos, "vertOffset") + num(om, "top") + h + num(om, "bottom"))
    }
  }
  return r
}

/** 문단 run 의 단 정의(ctrl>colPr) → 단 폭. 같은 폭이면 (본문 폭 − 간격×(단 수−1)) ÷ 단 수, 아니면 첫 단(colSz) 폭. 없으면 undefined */
export function columnWidthIn(p: Element, bodyW: number): number | undefined {
  for (const run of elements(p)) {
    if (ln(run) !== "run") continue
    for (const ch of elements(run)) {
      if (ln(ch) !== "ctrl") continue
      const col = findChildByLocalName(ch, "colPr")
      if (!col) continue
      const n = Math.max(1, num(col, "colCount", 1))
      if (n === 1) return bodyW
      if (col.getAttribute("sameSz") !== "0") return Math.trunc((bodyW - num(col, "sameGap") * (n - 1)) / n)
      const first = findChildByLocalName(col, "colSz")
      return first ? num(first, "width", bodyW) : bodyW
    }
  }
  return undefined
}

/**
 * 문단 run 안 표 칸 밖의 하위 목록 reflow — 머리말·꼬리말은 구역 본문 폭, 각주는 noteW(본문 흐름이면 그 단 폭 —
 * 2단 문서의 미주 lineseg 폭 = 단 폭), 미주는 구역 끝의 단 폭(counter.endNoteW, 없으면 noteW),
 * 도형 글상자(drawText)와 표 캡션은 저장된 글 영역 폭(lastWidth, 글상자는 안 여백을 뺀다).
 * 종전엔 건너뛰어 캐시 없는 문서에서 이 안의 글이 줄 정보 없이 남았다
 */
export function reflowSubListsIn(p: Element, doc: Document, styles: RenderStyles, mode: WrapMode, counter: { n: number; bodyW?: number; endNoteW?: number; nums?: NumberCounters }, flow: BlockFlow, noteW = counter.bodyW): void {
  const visit = (el: Element): void => {
    for (const ch of elements(el)) {
      const t = ln(ch)
      if (t === "footNote" || t === "endNote" || t === "header" || t === "footer") {
        const sub = findChildByLocalName(ch, "subList"), w = t === "endNote" ? counter.endNoteW ?? noteW : t === "footNote" ? noteW : counter.bodyW
        if (sub && w) flow(sub, doc, styles, w, mode, counter, 0)
        continue
      }
      if (t === "drawText" || t === "caption") {
        // 글상자는 안 여백(textMargin 좌우)을 뺀 폭 — 한컴 저장 lineseg 실측: lastWidth 30907 − 283×2 → 30340
        const sub = findChildByLocalName(ch, "subList"), tm = findChildByLocalName(ch, "textMargin")
        const textW = num(ch, "lastWidth") || (t === "caption" ? num(ch, "width") : 0)
        const w = textW - num(tm, "left") - num(tm, "right")
        if (sub && w > 0) flow(sub, doc, styles, w, mode, counter, 0)
        continue
      }
      if (t === "tr" || t === "subList" || t === "linesegarray") continue
      visit(ch)
    }
  }
  for (const run of elements(p)) if (ln(run) === "run") visit(run)
}

/** 문단 run 안의 표를 찾아 각 셀 subList를 셀 로컬로 reflow (중첩 재귀) */
export function reflowTablesIn(p: Element, doc: Document, styles: RenderStyles, mode: WrapMode, counter: { n: number; bodyW?: number; endNoteW?: number; nums?: NumberCounters }, flow: BlockFlow): void {
  for (const run of elements(p)) {
    if (ln(run) !== "run") continue
    for (const obj of elements(run)) {
      if (ln(obj) !== "tbl") continue
      const inM = findChildByLocalName(obj, "inMargin")
      // 한 칸짜리 칸의 폭은 그 열에서 가장 넓은 칸 폭 — 한컴 저장 lineseg 실측: 열 1 칸 22393 이 같은 열 다른 행 22396 기준으로 21264 (여백 566×2)
      const colMax = new Map<number, number>()
      for (const tr of elements(obj)) for (const tc of elements(tr)) {
        if (ln(tc) !== "tc" || num(findChildByLocalName(tc, "cellSpan"), "colSpan", 1) !== 1) continue
        const c = num(findChildByLocalName(tc, "cellAddr"), "colAddr"), w = num(findChildByLocalName(tc, "cellSz"), "width")
        colMax.set(c, Math.max(colMax.get(c) ?? 0, w))
      }
      // 열 경계 = 그 경계에서 끝나는 칸들의 가장 먼 끝(왼쪽 경계 + 칸 폭) — 행마다 칸 폭 합이 다르면 짧은 행의 끝 칸이 늘어난다
      // (한컴 저장본: 565 + 7287 로 끝나는 행 아래 565 + 565 + 6320 행의 끝 칸 줄 폭 6440 = 7852 − 1130 − 여백 282)
      const xs: number[] = []
      {
        const cl = [] as Array<[number, number, number]>
        for (const tr of elements(obj)) for (const tc of elements(tr)) if (ln(tc) === "tc") cl.push([num(findChildByLocalName(tc, "cellAddr"), "colAddr"), num(findChildByLocalName(tc, "cellSpan"), "colSpan", 1), num(findChildByLocalName(tc, "cellSz"), "width")])
        cl.sort((p, q) => p[0] - q[0]); xs[0] = 0
        for (const [c, sp, w] of cl) xs[c + sp] = Math.max(xs[c + sp] ?? 0, (xs[c] ?? 0) + w)
      }
      for (const tr of elements(obj)) {
        if (ln(tr) !== "tr") continue
        for (const tc of elements(tr)) {
          if (ln(tc) !== "tc") continue
          const csz = findChildByLocalName(tc, "cellSz")
          // hasMargin="0" 이면 표 안 여백(inMargin) — collectCells 와 같은 해석
          const cm = tc.getAttribute("hasMargin") === "0" ? null : findChildByLocalName(tc, "cellMargin")
          // 모든 열에 걸친 칸은 표 폭 — 한컴 저장 lineseg 실측: 7열 병합 칸 47899 가 표 폭 47943 기준으로 47660 (여백 141×2). 일부 열 병합은 제 폭
          const span = num(findChildByLocalName(tc, "cellSpan"), "colSpan", 1)
          let cellW = span === 1 ? colMax.get(num(findChildByLocalName(tc, "cellAddr"), "colAddr")) ?? num(csz, "width")
            : span === num(obj, "colCnt") ? num(findChildByLocalName(obj, "sz"), "width") || num(csz, "width") : num(csz, "width")
          const ca = num(findChildByLocalName(tc, "cellAddr"), "colAddr")
          const gw = xs[ca + span] !== undefined && xs[ca] !== undefined ? xs[ca + span] - xs[ca] : 0
          if (gw > cellW) cellW = gw
          const mL = cellMarginOf(cm, "left", num(inM, "left", 141))
          const mR = cellMarginOf(cm, "right", num(inM, "right", 141))
          const areaW = Math.max(500, cellW - mL - mR)
          const sub = findChildByLocalName(tc, "subList")
          if (sub) flow(sub, doc, styles, areaW, mode, counter, 0)
        }
      }
    }
  }
}
