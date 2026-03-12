import type { DetailPanelState } from '../App'

export interface CommitMessage {
  actionType?: 'commit_patch' | 'delete_node'
  title: string
  description: string
  nextPanel?: DetailPanelState
}
