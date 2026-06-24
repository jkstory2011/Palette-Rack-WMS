'use client'

import { useEffect, useRef } from 'react'

/**
 * 파렛트 바코드 라벨 인쇄 컴포넌트
 * - window.print()로 인쇄 다이얼로그 호출
 * - @media print CSS로 라벨 영역만 출력
 */
export default function LabelPrinter({ pallet, onClose }) {
  const barcodeRef = useRef(null)

  useEffect(() => {
    // JsBarcode는 SVG에 직접 바코드를 그림
    if (!barcodeRef.current) return

    import('jsbarcode').then(({ default: JsBarcode }) => {
      JsBarcode(barcodeRef.current, pallet.code, {
        format:      'CODE128',
        width:       2.5,
        height:      80,
        displayValue: true,
        fontSize:    16,
        margin:      10,
        background:  '#ffffff',
        lineColor:   '#000000',
      })
    })
  }, [pallet.code])

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/*
        인쇄 전용 영역: @media print에서 .no-print가 숨겨지고
        .print-only 영역만 출력됨
      */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-label { display: block !important; }
        }
      `}</style>

      {/* 화면 미리보기 오버레이 (no-print) */}
      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center
                      bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">

          {/* 미리보기 제목 */}
          <h3 className="text-gray-800 font-bold text-lg mb-4 text-center">
            라벨 미리보기
          </h3>

          {/* 라벨 미리보기 */}
          <LabelContent pallet={pallet} barcodeRef={barcodeRef} />

          {/* 버튼 */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600
                         hover:bg-gray-100 font-medium transition-colors"
            >
              취소
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                         text-white font-bold transition-colors"
            >
              🖨 인쇄
            </button>
          </div>
        </div>
      </div>

      {/* 실제 인쇄될 DOM (평소에는 숨김, print시에만 표시) */}
      <div className="print-label hidden fixed inset-0 bg-white z-[70] p-8">
        <LabelContent pallet={pallet} barcodeRef={null} isPrint />
      </div>
    </>
  )
}

// 라벨 내용 — 화면 미리보기와 인쇄 영역에서 동일하게 사용
function LabelContent({ pallet, barcodeRef, isPrint = false }) {
  const items = pallet.pallet_items ?? []

  return (
    <div
      className={`border-2 border-black rounded-lg p-4 font-mono
                  ${isPrint ? 'text-black' : 'text-gray-800'}`}
    >
      {/* 창고명 */}
      <div className="text-center text-xs font-bold border-b border-black pb-1 mb-2">
        PALETTE RACK WMS
      </div>

      {/* 파렛트 코드 */}
      <div className="text-center text-sm font-black mb-1">{pallet.code}</div>

      {/* 바코드 SVG */}
      <div className="flex justify-center my-2">
        <svg ref={barcodeRef} />
      </div>

      {/* 입고 일시 */}
      <div className="text-xs text-center mb-2">
        입고: {new Date(pallet.inbound_at).toLocaleString('ko-KR')}
      </div>

      {/* 혼적 상품 목록 */}
      {items.length > 0 && (
        <table className="w-full text-xs border-t border-black pt-1 mt-1">
          <thead>
            <tr className="text-left">
              <th className="py-0.5">상품명</th>
              <th className="py-0.5 text-right">수량</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-0.5 truncate max-w-[140px]">
                  {item.products?.name}
                </td>
                <td className="py-0.5 text-right">
                  {item.qty} {item.products?.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
