import { useState, useEffect, useReducer, FormEvent, ChangeEvent } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

const STORAGE_KEY = 'api_key'

// API Response Types
interface ScoreBucket {
  bucket: string
  count: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface PassRateEntry {
  task: string
  avg_score: number
  attempts: number
}

interface LabItem {
  id: number
  type: string
  title: string
  parent_id: number | null
}

// Component State Types
type DashboardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; labs: LabItem[] }
  | { status: 'error'; message: string }

type DashboardAction =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: LabItem[] }
  | { type: 'fetch_error'; message: string }

function dashboardReducer(
  _state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case 'fetch_start':
      return { status: 'loading' }
    case 'fetch_success':
      return { status: 'success', labs: action.data }
    case 'fetch_error':
      return { status: 'error', message: action.message }
  }
}

type ScoresState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ScoreBucket[] }
  | { status: 'error'; message: string }

type ScoresAction =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: ScoreBucket[] }
  | { type: 'fetch_error'; message: string }

function scoresReducer(
  _state: ScoresState,
  action: ScoresAction,
): ScoresState {
  switch (action.type) {
    case 'fetch_start':
      return { status: 'loading' }
    case 'fetch_success':
      return { status: 'success', data: action.data }
    case 'fetch_error':
      return { status: 'error', message: action.message }
  }
}

type TimelineState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: TimelineEntry[] }
  | { status: 'error'; message: string }

type TimelineAction =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: TimelineEntry[] }
  | { type: 'fetch_error'; message: string }

function timelineReducer(
  _state: TimelineState,
  action: TimelineAction,
): TimelineState {
  switch (action.type) {
    case 'fetch_start':
      return { status: 'loading' }
    case 'fetch_success':
      return { status: 'success', data: action.data }
    case 'fetch_error':
      return { status: 'error', message: action.message }
  }
}

type PassRatesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: PassRateEntry[] }
  | { status: 'error'; message: string }

type PassRatesAction =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: PassRateEntry[] }
  | { type: 'fetch_error'; message: string }

function passRatesReducer(
  _state: PassRatesState,
  action: PassRatesAction,
): PassRatesState {
  switch (action.type) {
    case 'fetch_start':
      return { status: 'loading' }
    case 'fetch_success':
      return { status: 'success', data: action.data }
    case 'fetch_error':
      return { status: 'error', message: action.message }
  }
}

interface DashboardProps {
  token: string
}

function Dashboard({ token }: DashboardProps) {
  const [dashboardState, dispatch] = useReducer(dashboardReducer, {
    status: 'idle',
  })
  const [scoresState, dispatchScores] = useReducer(scoresReducer, {
    status: 'idle',
  })
  const [timelineState, dispatchTimeline] = useReducer(timelineReducer, {
    status: 'idle',
  })
  const [passRatesState, dispatchPassRates] = useReducer(passRatesReducer, {
    status: 'idle',
  })
  const [selectedLab, setSelectedLab] = useState<string>('')

  // Fetch labs on mount
  useEffect(() => {
    dispatch({ type: 'fetch_start' })

    fetch('/items/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: LabItem[]) => dispatch({ type: 'fetch_success', data }))
      .catch((err: Error) =>
        dispatch({ type: 'fetch_error', message: err.message }),
      )
  }, [token])

  // Fetch analytics when selected lab changes
  useEffect(() => {
    if (!selectedLab) return

    const fetchScores = async () => {
      dispatchScores({ type: 'fetch_start' })
      try {
        const res = await fetch(`/analytics/scores?lab=${selectedLab}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ScoreBucket[] = await res.json()
        dispatchScores({ type: 'fetch_success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        dispatchScores({ type: 'fetch_error', message })
      }
    }

    const fetchTimeline = async () => {
      dispatchTimeline({ type: 'fetch_start' })
      try {
        const res = await fetch(`/analytics/timeline?lab=${selectedLab}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: TimelineEntry[] = await res.json()
        dispatchTimeline({ type: 'fetch_success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        dispatchTimeline({ type: 'fetch_error', message })
      }
    }

    const fetchPassRates = async () => {
      dispatchPassRates({ type: 'fetch_start' })
      try {
        const res = await fetch(`/analytics/pass-rates?lab=${selectedLab}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: PassRateEntry[] = await res.json()
        dispatchPassRates({ type: 'fetch_success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        dispatchPassRates({ type: 'fetch_error', message })
      }
    }

    fetchScores()
    fetchTimeline()
    fetchPassRates()
  }, [selectedLab, token])

  // Filter labs (only top-level labs, no parent)
  const labs =
    dashboardState.status === 'success'
      ? dashboardState.labs.filter((lab) => lab.type === 'lab')
      : []

  // Prepare chart data for scores
  const scoresChartData =
    scoresState.status === 'success'
      ? {
          labels: scoresState.data.map((d) => d.bucket),
          datasets: [
            {
              label: 'Number of Students',
              data: scoresState.data.map((d) => d.count),
              backgroundColor: [
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(54, 162, 235, 0.6)',
              ],
              borderColor: [
                'rgb(255, 99, 132)',
                'rgb(255, 159, 64)',
                'rgb(75, 192, 192)',
                'rgb(54, 162, 235)',
              ],
              borderWidth: 1,
            },
          ],
        }
      : { labels: [], datasets: [] }

  // Prepare chart data for timeline
  const timelineChartData =
    timelineState.status === 'success'
      ? {
          labels: timelineState.data.map((d) => d.date),
          datasets: [
            {
              label: 'Submissions',
              data: timelineState.data.map((d) => d.submissions),
              borderColor: 'rgb(54, 162, 235)',
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              tension: 0.1,
            },
          ],
        }
      : { labels: [], datasets: [] }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '',
      },
    },
  }

  function handleLabChange(e: ChangeEvent<HTMLSelectElement>) {
    setSelectedLab(e.target.value)
  }

  // Helper to convert lab title to lab ID format (e.g., "Lab 04 — Testing" → "lab-04")
  function titleToLabId(title: string): string {
    // Extract "Lab XX" pattern from title like "Lab 04 — Testing"
    const match = title.match(/Lab\s+(\d+)/i)
    if (match) {
      return `lab-${match[1].padStart(2, '0')}`
    }
    // Fallback: convert title to lowercase and replace spaces with hyphens
    return title.toLowerCase().replace(/\s+/g, '-').replace(/-+$/, '')
  }

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>

      {/* Lab Selector */}
      <div className="lab-selector">
        <label htmlFor="lab-select">Select Lab: </label>
        <select
          id="lab-select"
          value={selectedLab}
          onChange={handleLabChange}
          disabled={dashboardState.status !== 'success'}
        >
          <option value="">-- Choose a lab --</option>
          {labs.map((lab) => (
            <option key={lab.id} value={titleToLabId(lab.title)}>
              {lab.title}
            </option>
          ))}
        </select>
      </div>

      {dashboardState.status === 'loading' && <p>Loading labs...</p>}
      {dashboardState.status === 'error' && (
        <p>Error: {dashboardState.message}</p>
      )}

      {selectedLab && (
        <>
          {/* Score Distribution Bar Chart */}
          <div className="chart-container">
            <h3>Score Distribution</h3>
            {scoresState.status === 'loading' && <p>Loading...</p>}
            {scoresState.status === 'error' && (
              <p>Error: {scoresState.message}</p>
            )}
            {scoresState.status === 'success' && (
              <Bar options={chartOptions} data={scoresChartData} />
            )}
          </div>

          {/* Timeline Line Chart */}
          <div className="chart-container">
            <h3>Submissions Over Time</h3>
            {timelineState.status === 'loading' && <p>Loading...</p>}
            {timelineState.status === 'error' && (
              <p>Error: {timelineState.message}</p>
            )}
            {timelineState.status === 'success' && (
              <Line options={chartOptions} data={timelineChartData} />
            )}
          </div>

          {/* Pass Rates Table */}
          <div className="table-container">
            <h3>Pass Rates by Task</h3>
            {passRatesState.status === 'loading' && <p>Loading...</p>}
            {passRatesState.status === 'error' && (
              <p>Error: {passRatesState.message}</p>
            )}
            {passRatesState.status === 'success' && (
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Avg Score</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {passRatesState.data.map((entry) => (
                    <tr key={entry.task}>
                      <td>{entry.task}</td>
                      <td>{entry.avg_score.toFixed(1)}</td>
                      <td>{entry.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
