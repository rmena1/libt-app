export const RECORDING_COMPLETED_EVENT = 'libt:recording-completed'

export interface RecordingCompletedDetail {
  dailyDate: string
  recordingId?: string
}
