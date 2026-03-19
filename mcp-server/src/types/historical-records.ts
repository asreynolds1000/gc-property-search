// Historical Records Search types
// Based on Greenville County Historical Records Search app

export interface HistoricalRecordEntry {
  /** Display name of the folder or volume */
  name: string
  /** Number of items (subfolders) or viewable pages */
  count: number
  /** Last updated date string (e.g., "1/25/2007 12:00:00 AM") */
  lastUpdated: string
  /** 'folder' = has subfolders, 'volume' = leaf node with viewable pages */
  type: 'folder' | 'volume'
}

