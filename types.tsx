// Resource types
export enum ResourceType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  DOCUMENT = "document"
}

// File extensions by type
export const FILE_EXTENSIONS = {
  [ResourceType.IMAGE]: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".avif"],
  [ResourceType.VIDEO]: [".mp4", ".webm", ".ogg", ".mov", ".avi", ".wmv", ".flv", ".mkv", ".m4v"],
  [ResourceType.AUDIO]: [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"],
  [ResourceType.DOCUMENT]: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".csv"]
}

// MIME types by resource type
export const MIME_TYPES = {
  [ResourceType.IMAGE]: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"],
  [ResourceType.VIDEO]: ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo"],
  [ResourceType.AUDIO]: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac"],
  [ResourceType.DOCUMENT]: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]
}

// Resource interface
export interface WebResource {
  id: string
  url: string
  type: ResourceType
  filename: string
  isEmbed?: boolean
}

// Video embed domains
export const VIDEO_EMBED_DOMAINS = [
  "youtube.com/embed",
  "youtube-nocookie.com/embed",
  "player.vimeo.com",
  "dailymotion.com/embed",
  "facebook.com/plugins/video"
]
