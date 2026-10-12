import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#EDEDE9] flex items-center justify-center p-4 text-[#1C1917] font-sans-ui">
          <div className="max-w-md w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl shadow-lg p-6 sm:p-8 text-center">
            <div className="w-14 h-14 bg-[#B3261E]/10 text-[#B3261E] rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1C1917] mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#524E4A] font-body mb-6">
              An unexpected error occurred while loading this page. Please try refreshing or return to the main portal.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg flex items-center justify-center space-x-2 transition-colors cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
              <a
                href="/"
                className="px-5 py-2.5 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] font-semibold text-sm rounded-lg flex items-center justify-center space-x-2 transition-colors cursor-pointer min-h-[44px]"
              >
                <Home className="w-4 h-4" />
                <span>Go to Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
