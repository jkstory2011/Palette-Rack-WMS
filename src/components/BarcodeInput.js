'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

/**
 * 바코드 스캐너 전용 인풋 컴포넌트
 *
 * 두 가지 입력 방식 지원:
 * 1) 하드웨어 스캐너 — USB/블루투스 스캐너는 키보드처럼 입력 후 Enter 전송
 *    → onScan(value) 콜백으로 전달
 * 2) 카메라 스캔 — BarcodeDetector API (Chrome 83+, Edge 83+) 활용
 *    → 지원되지 않는 브라우저에서는 버튼 숨김
 */
export default function BarcodeInput({
  value,
  onChange,
  onScan,          // 스캔 완료(Enter 또는 카메라 인식) 시 콜백
  placeholder = '바코드 스캔 또는 직접 입력',
  label,
  autoFocus = false,
  className = '',
}) {
  const inputRef    = useRef(null)
  const videoRef    = useRef(null)
  const detectorRef = useRef(null)
  const rafRef      = useRef(null)

  const [cameraOpen, setCameraOpen]     = useState(false)
  const [cameraError, setCameraError]   = useState('')
  const [hasDetector, setHasDetector]   = useState(false)
  const [scanning, setScanning]         = useState(false)
  const [flash, setFlash]               = useState(false)   // 스캔 성공 플래시 효과

  // BarcodeDetector 지원 여부 확인
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setHasDetector(true)
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix'],
      })
    }
  }, [])

  // ── 하드웨어 스캐너: Enter 키 처리
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (value.trim()) {
        triggerScan(value.trim())
      }
    }
  }

  // ── 스캔 성공 공통 처리
  function triggerScan(code) {
    // 짧은 플래시 효과 (시각적 피드백)
    setFlash(true)
    setTimeout(() => setFlash(false), 300)

    // 짧은 진동 피드백 (모바일)
    if (navigator.vibrate) navigator.vibrate(50)

    onScan?.(code)
  }

  // ── 카메라 열기
  async function openCamera() {
    setCameraError('')
    setCameraOpen(true)
    setScanning(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        startDetectionLoop()
      }
    } catch (err) {
      setCameraError('카메라 접근 권한이 필요합니다.')
      setScanning(false)
    }
  }

  // ── 프레임마다 바코드 감지
  const startDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || !detectorRef.current) return
      if (videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect)
        return
      }
      try {
        const codes = await detectorRef.current.detect(videoRef.current)
        if (codes.length > 0) {
          const code = codes[0].rawValue
          stopCamera()
          onChange?.(code)
          triggerScan(code)
          return
        }
      } catch {}
      rafRef.current = requestAnimationFrame(detect)
    }
    rafRef.current = requestAnimationFrame(detect)
  }, [onChange])

  // ── 카메라 닫기
  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    setScanning(false)
    setCameraOpen(false)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => () => stopCamera(), [])

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-gray-400">{label}</label>
      )}

      {/* 입력 영역 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            {/* 바코드 아이콘 */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2">
              <rect x="1"  y="4"  width="3" height="16" />
              <rect x="6"  y="4"  width="1" height="16" />
              <rect x="9"  y="4"  width="2" height="16" />
              <rect x="13" y="4"  width="1" height="16" />
              <rect x="16" y="4"  width="3" height="16" />
              <rect x="21" y="4"  width="2" height="16" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full bg-gray-800 border rounded-xl pl-10 pr-4 py-3
                        text-white text-sm placeholder-gray-500 min-h-[52px]
                        focus:outline-none focus:ring-2 transition-all duration-150
                        ${flash
                          ? 'border-green-500 ring-2 ring-green-500/50 bg-green-900/20'
                          : 'border-gray-600 hover:border-gray-500 focus:ring-blue-500/50 focus:border-blue-500'
                        }`}
          />
        </div>

        {/* 카메라 스캔 버튼 (BarcodeDetector 지원 시만 표시) */}
        {hasDetector && (
          <button
            type="button"
            onClick={cameraOpen ? stopCamera : openCamera}
            className={`shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              cameraOpen
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {cameraOpen ? '📷 닫기' : '📷 카메라'}
          </button>
        )}
      </div>

      {/* 카메라 뷰파인더 */}
      {cameraOpen && (
        <div className="relative rounded-xl overflow-hidden bg-black border border-gray-700">
          <video
            ref={videoRef}
            className="w-full max-h-56 object-cover"
            muted
            playsInline
          />
          {/* 스캔 가이드 오버레이 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-blue-400 w-2/3 h-16 rounded-lg opacity-70" />
          </div>
          {scanning && (
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-xs text-blue-300 bg-black/60 px-3 py-1 rounded-full">
                바코드를 가이드 안에 맞춰주세요
              </span>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <p className="text-red-400 text-sm text-center px-4">{cameraError}</p>
            </div>
          )}
        </div>
      )}

      {/* 힌트 */}
      <p className="text-[11px] text-gray-600">
        스캐너로 스캔하거나 직접 입력 후 Enter를 누르세요.
        {hasDetector && ' 카메라 스캔도 지원합니다.'}
      </p>
    </div>
  )
}
