'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function drawBarcode(svgEl, code) {
  return import('jsbarcode').then(({ default: JsBarcode }) => {
    JsBarcode(svgEl, code, {
      format:       'CODE128',
      width:        2.5,
      height:       80,
      displayValue: true,
      fontSize:     16,
      margin:       10,
      background:   '#ffffff',
      lineColor:    '#000000',
    })
  })
}

export default function LabelPrinter({ pallet, onClose }) {
  const previewRef = useRef(null)
  const printRef   = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (previewRef.current) drawBarcode(previewRef.current, pallet.code)
  }, [pallet.code, mounted])

  useEffect(() => {
    if (printRef.current) drawBarcode(printRef.current, pallet.code)
  }, [pallet.code, mounted])

  function handlePrint() {
    window.print()
  }

  // Portal: body 직계 자식으로 렌더링 → print CSS가 정확히 적용됨
  const printPortal = mounted ? createPortal(
    <div id="wms-label-print">
      <LabelContent pallet={pallet} barcodeRef={printRef} />
    </div>,
    document.body
  ) : null

  return (
    <>
      {/* 인쇄 전용 CSS */}
      <style>{`
        #wms-label-print {
          display: none;
        }
        @media print {
          body > *:not(#wms-label-print) { display: none !important; }
          #wms-label-print {
            display: block !important;
            position: fixed;
            top: 0; left: 0;
            width: 100%; min-height: 100vh;
            background: white !important;
            color: black !important;
            padding: 32px;
            font-family: ui-monospace, monospace;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* 화면 미리보기 오버레이 */}
      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center
                      bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">

          <h3 className="text-gray-800 font-bold text-lg mb-4 text-center">
            🖨 라벨 미리보기
          </h3>

          <LabelContent pallet={pallet} barcodeRef={previewRef} />

          <div className="flex gap-3 mt-5">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600
                         hover:bg-gray-100 font-medium transition-colors">
              취소
            </button>
            <button onClick={handlePrint}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                         text-white font-bold transition-colors">
              🖨 인쇄
            </button>
          </div>
        </div>
      </div>

      {printPortal}
    </>
  )
}

function LabelContent({ pallet, barcodeRef }) {
  const items = pallet.pallet_items ?? []

  return (
    <div style={{
      border: '2px solid black',
      borderRadius: 8,
      padding: 16,
      fontFamily: 'ui-monospace, monospace',
      color: 'black',
      background: 'white',
      maxWidth: 320,
    }}>
      {/* 헤더 */}
      <div style={{
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        borderBottom: '1px solid black',
        paddingBottom: 6,
        marginBottom: 8,
        letterSpacing: '0.1em',
      }}>
        PALETTE RACK WMS
      </div>

      {/* 파렛트 코드 */}
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 900, marginBottom: 4 }}>
        {pallet.code}
      </div>

      {/* 바코드 */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <svg ref={barcodeRef} />
      </div>

      {/* 입고 일시 */}
      <div style={{ fontSize: 11, textAlign: 'center', color: '#444', marginBottom: 8 }}>
        입고: {new Date(pallet.inbound_at).toLocaleString('ko-KR')}
      </div>

      {/* 상품 목록 */}
      {items.length > 0 && (
        <table style={{ width: '100%', fontSize: 11, borderTop: '1px solid black', marginTop: 4 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '3px 0', fontWeight: 700 }}>상품명</th>
              <th style={{ textAlign: 'right', padding: '3px 0', fontWeight: 700 }}>수량</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '2px 0' }}>{item.products?.name}</td>
                <td style={{ padding: '2px 0', textAlign: 'right' }}>
                  {item.qty} {item.products?.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 혼적 표시 */}
      {items.length > 1 && (
        <div style={{
          marginTop: 8, padding: '3px 8px',
          background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: 4, fontSize: 11, fontWeight: 700, textAlign: 'center',
          color: '#92400e',
        }}>
          혼적 {items.length}종
        </div>
      )}
    </div>
  )
}
