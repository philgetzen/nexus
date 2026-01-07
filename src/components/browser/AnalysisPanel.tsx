import { useAppStore } from '@/stores/useAppStore'
import {
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileCode,
  GitBranch,
  Hash,
} from 'lucide-react'
import { useProjectActions } from '@/hooks/useProjectActions'

interface AnalysisPanelProps {
  onClose?: () => void
}

export function AnalysisPanel({ onClose: _onClose }: AnalysisPanelProps) {
  const { currentProject, analysisProgress, panels } = useAppStore()
  const { analyzeProject, cancelAnalysis, isLoading } = useProjectActions()

  if (!panels.analysisPanelOpen) return null

  const isAnalyzing = analysisProgress.status === 'analyzing'
  const isComplete = analysisProgress.status === 'complete'
  const isError = analysisProgress.status === 'error'
  const isIdle = analysisProgress.status === 'idle'

  const handleStartAnalysis = async () => {
    if (!currentProject) return
    try {
      await analyzeProject(currentProject.id)
    } catch (err) {
      console.error('Analysis failed:', err)
    }
  }

  const handleCancelAnalysis = async () => {
    if (!currentProject) return
    await cancelAnalysis(currentProject.id)
  }

  return (
    <div
      className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
      style={{ height: panels.analysisPanelHeight }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {isAnalyzing && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
          {isComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
          {isError && <AlertCircle className="w-4 h-4 text-red-500" />}
          {isIdle && <FileCode className="w-4 h-4 text-zinc-400" />}
          <span className="font-medium text-sm">
            {isAnalyzing && 'Analyzing...'}
            {isComplete && 'Analysis Complete'}
            {isError && 'Analysis Failed'}
            {isIdle && 'Code Analysis'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isIdle && currentProject && (
            <button
              onClick={handleStartAnalysis}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 rounded-md transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Analyze
            </button>
          )}
          {isAnalyzing && (
            <button
              onClick={handleCancelAnalysis}
              className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-red-500 text-white hover:bg-red-600 rounded-md transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
          {isComplete && currentProject && (
            <button
              onClick={handleStartAnalysis}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Re-analyze
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-auto" style={{ height: 'calc(100% - 49px)' }}>
        {!currentProject ? (
          <div className="text-center py-4">
            <FileCode className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500">Open a project to analyze</p>
          </div>
        ) : isIdle ? (
          <div className="text-center py-4">
            <p className="text-sm text-zinc-500">
              Click "Analyze" to parse <strong>{currentProject.name}</strong> and generate the dependency graph.
            </p>
          </div>
        ) : isAnalyzing ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-500">Progress</span>
                <span className="font-medium">{Math.round(analysisProgress.percentComplete)}%</span>
              </div>
              <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${analysisProgress.percentComplete}%` }}
                />
              </div>
            </div>

            {/* Current file */}
            {analysisProgress.currentFile && (
              <div className="text-sm">
                <span className="text-zinc-500">Parsing: </span>
                <span className="font-mono text-xs">{analysisProgress.currentFile}</span>
              </div>
            )}

            {/* File count */}
            <div className="text-sm text-zinc-500">
              {analysisProgress.filesProcessed} / {analysisProgress.totalFiles} files processed
            </div>
          </div>
        ) : isComplete ? (
          <div className="space-y-4">
            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                icon={<FileCode className="w-5 h-5" />}
                label="Files"
                value={analysisProgress.statistics.totalFiles}
              />
              <StatCard
                icon={<Hash className="w-5 h-5" />}
                label="Symbols"
                value={analysisProgress.statistics.totalSymbols}
              />
              <StatCard
                icon={<GitBranch className="w-5 h-5" />}
                label="Relationships"
                value={analysisProgress.statistics.totalRelationships}
              />
            </div>

            <p className="text-sm text-green-600 dark:text-green-400">
              Analysis complete! The dependency graph is now available.
            </p>
          </div>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">
              {analysisProgress.errorMessage || 'An error occurred during analysis.'}
            </p>
            <button
              onClick={handleStartAnalysis}
              className="text-sm text-violet-500 hover:text-violet-600 underline"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center gap-2 text-zinc-400 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  )
}
