'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'

const TIERS = [4, 3, 2, 1]
const SIDES = ['L', 'R']

function availableSides(slot_config) {
  if (slot_config === 'L') return ['L']
  if (slot_config === 'R') return ['R']
  return SIDES
}

function buildSlots(location) {
  const sides = availableSides(location.slot_config)
  const slots = []
  for (const tier of TIERS) {
    for (const side of sides) {
      slots.push({ tier, side, slotCode: `${location.code}-${tier}${side}` })
    }
  }
  return slots
}

function drawBarcode(svgEl, code) {
  JsBarcode(svgEl, code, {
    format: 'CODE128', width: 2.2, height: 72,
    displayValue: true, fontSize: 14, margin: 8,
    background: '#ffffff', lineColor: '#000000',
  })
}

export default function LocationLabelPrinter({ location, onClose }) {
  const slots = buildSlots(location)
  const [current, setCurrent] = useState(0)
  const [mounted, setMounted] = useState(false)
  const previewRef = useRef(null)
  const printRefs  = useRef([])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (previewRef.current && slots[current]) drawBarcode(previewRef.current, slots[current].slotCode)
  }, [current, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return
    slots.forEach((slot, i) => {
      const el = printRefs.current[i]
      if (el) drawBarcode(el, slot.slotCode)
    })
  }, [mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePrint() {
    window.print()
  }

  if (slots.length === 0) {
    return (
      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <p className="text-gray-700 mb-4">출력 가능한 슬롯이 없습니다.</p>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-700 text-white font-semibold">
            닫기
          </button>
        </div>
      </div>
    )
  }

  const slot = slots[current]

  const printPortal = mounted ? createPortal(
    <div id="wms-slot-label-print">
      {slots.map((s, i) => (
        <div key={s.slotCode} style={{ pageBreakAfter: i < slots.length - 1 ? 'always' : 'auto' }}>
          <SlotLabelContent location={location} slot={s} barcodeRef={el => { printRefs.current[i] = el }} />
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <>
      <style>{`
        #wms-slot-label-print { display: none; }
        @media print {
          body > *:not(#wms-slot-label-print) { display: none !important; }
          #wms-slot-label-print {
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

      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center
                      bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 className="text-gray-800 font-bold text-lg mb-1 text-center">🏷 슬롯 라벨 출력</h3>
          <p className="text-gray-400 text-xs text-center mb-4">{current + 1} / {slots.length}개</p>

          <SlotLabelContent location={location} slot={slot} barcodeRef={previewRef} />

          <div className="flex gap-2 mt-4">
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
              className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800
                         font-semibold text-sm disabled:opacity-40">
              ← 이전
            </button>
            <button onClick={() => setCurrent(c => Math.min(slots.length - 1, c + 1))}
              disabled={current === slots.length - 1}
              className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800
                         font-semibold text-sm disabled:opacity-40">
              다음 →
            </button>
          </div>

          <div className="flex gap-3 mt-3">
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

function SlotLabelContent({ location, slot, barcodeRef }) {
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
      <div style={{
        textAlign: 'center', fontSize: 11, fontWeight: 700,
        borderBottom: '1px solid black', paddingBottom: 6, marginBottom: 8,
        letterSpacing: '0.1em',
      }}>
        PALETTE RACK WMS
      </div>

      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
        {slot.slotCode}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <svg ref={barcodeRef} />
      </div>

      <div style={{ fontSize: 12, textAlign: 'center', color: '#444' }}>
        {location.code} · {slot.tier}단 · {slot.side === 'L' ? '좌측' : '우측'}
      </div>
    </div>
  )
}
