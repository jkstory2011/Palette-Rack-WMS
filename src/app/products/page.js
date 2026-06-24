'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ code: '', name: '', unit: 'BOX' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, code, name, unit, created_at')
      .order('created_at', { ascending: false })
    setProducts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.code.trim() || !form.name.trim()) {
      setError('상품코드와 상품명은 필수입니다.')
      return
    }

    setSaving(true)
    const { error: err } = await supabase
      .from('products')
      .insert({ code: form.code.trim(), name: form.name.trim(), unit: form.unit.trim() || 'EA' })

    setSaving(false)
    if (err) {
      setError(err.code === '23505' ? '이미 존재하는 상품코드입니다.' : err.message)
      return
    }

    setForm({ code: '', name: '', unit: 'BOX' })
    fetchProducts()
  }

  async function handleDelete(id) {
    if (!confirm('이 상품을 삭제하면 연결된 재고 데이터에 영향을 줄 수 있습니다. 계속할까요?')) return
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
  }

  const filtered = products.filter(
    (p) =>
      p.name.includes(search) ||
      p.code.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">상품 마스터</h1>

      {/* ── 등록 폼 */}
      <form onSubmit={handleSubmit} className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">신규 상품 등록</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FieldInput
            label="상품코드 *"
            placeholder="PRD-001"
            value={form.code}
            onChange={(v) => setForm((f) => ({ ...f, code: v }))}
          />
          <FieldInput
            label="상품명 *"
            placeholder="삼다수 2L 6입"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            className="sm:col-span-1"
          />
          <FieldInput
            label="단위"
            placeholder="BOX / EA / SET"
            value={form.unit}
            onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white font-semibold transition-colors disabled:opacity-40"
        >
          {saving ? '등록 중...' : '+ 상품 등록'}
        </button>
      </form>

      {/* ── 검색 + 목록 */}
      <div className="wms-card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-300">
            전체 상품 <span className="text-gray-500 font-normal">({products.length}종)</span>
          </h2>
          <input
            type="search"
            placeholder="코드 또는 이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-2
                       text-white text-sm placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500/50 w-56"
          />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-8">등록된 상품이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                <th className="pb-2 font-medium">상품코드</th>
                <th className="pb-2 font-medium">상품명</th>
                <th className="pb-2 font-medium text-center">단위</th>
                <th className="pb-2 font-medium text-right">등록일</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 font-mono text-gray-300">{p.code}</td>
                  <td className="py-3 text-white font-medium">{p.name}</td>
                  <td className="py-3 text-gray-400 text-center">{p.unit}</td>
                  <td className="py-3 text-gray-600 text-right text-xs">
                    {new Date(p.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function FieldInput({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <input
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                   text-white placeholder-gray-600 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
      />
    </div>
  )
}
