'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '알 수 없는 오류' }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <p className="text-red-400 text-xl font-bold">페이지 로딩 오류</p>
          <p className="text-gray-500 text-sm max-w-md">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition-colors"
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
