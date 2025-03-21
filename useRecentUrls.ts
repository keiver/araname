// useRecentUrls.ts
import {useState, useEffect, useCallback} from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

const STORAGE_KEY = "recent_urls"
const MAX_RECENT_URLS = 10

interface RecentUrl {
  url: string
  timestamp: number
  title?: string // Optional title/description
}

export const useRecentUrls = () => {
  const [recentUrls, setRecentUrls] = useState<RecentUrl[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load recent URLs from storage when the hook is initialized
  useEffect(() => {
    const loadRecentUrls = async () => {
      try {
        setIsLoading(true)
        const storedData = await AsyncStorage.getItem(STORAGE_KEY)

        if (storedData) {
          const parsedData = JSON.parse(storedData) as RecentUrl[]
          setRecentUrls(parsedData)
        }
      } catch (error) {
        console.error("Failed to load recent URLs:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecentUrls()
  }, [])

  // Save URLs to storage whenever the recentUrls state changes
  useEffect(() => {
    const saveRecentUrls = async () => {
      try {
        if (recentUrls.length > 0) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recentUrls))
        }
      } catch (error) {
        console.error("Failed to save recent URLs:", error)
      }
    }

    // Only save if not in the initial loading state
    if (!isLoading) {
      saveRecentUrls()
    }
  }, [recentUrls, isLoading])

  // Add a new URL to the recent list
  const addRecentUrl = useCallback((url: string, title?: string) => {
    setRecentUrls(prevUrls => {
      // Create new URL entry
      const newUrl: RecentUrl = {
        url,
        timestamp: Date.now(),
        title
      }

      // Remove the URL if it already exists (to avoid duplicates)
      const filteredUrls = prevUrls.filter(item => item.url !== url)

      // Add the new URL at the beginning and limit to MAX_RECENT_URLS
      const updatedUrls = [newUrl, ...filteredUrls].slice(0, MAX_RECENT_URLS)

      return updatedUrls
    })
  }, [])

  // Remove a specific URL from the list
  const removeRecentUrl = useCallback((url: string) => {
    setRecentUrls(prevUrls => prevUrls.filter(item => item.url !== url))
  }, [])

  // Clear all recent URLs
  const clearRecentUrls = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
      setRecentUrls([])
    } catch (error) {
      console.error("Failed to clear recent URLs:", error)
    }
  }, [])

  // Update a URL's title
  const updateUrlTitle = useCallback((url: string, title: string) => {
    setRecentUrls(prevUrls => prevUrls.map(item => (item.url === url ? {...item, title} : item)))
  }, [])

  return {
    recentUrls,
    isLoading,
    addRecentUrl,
    removeRecentUrl,
    clearRecentUrls,
    updateUrlTitle
  }
}
