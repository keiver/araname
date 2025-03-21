import React from "react"
import {StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions} from "react-native"
import {Ionicons} from "@expo/vector-icons"

interface FilterOption {
  id: string
  label: string
  icon?: string
}

interface FilterBarProps {
  currentFilter: string
  onFilterChange: (filter: string) => void
  filters: FilterOption[]
  resultCount?: number
}

const {width} = Dimensions.get("window")

export const FilterBar: React.FC<FilterBarProps> = ({currentFilter, onFilterChange, filters, resultCount}) => {
  // Icon mapping for filter types
  const getIconForFilter = (filterId: string): string => {
    switch (filterId) {
      case "all":
        return "grid-outline"
      case "image":
        return "image-outline"
      case "video":
        return "videocam-outline"
      case "svg":
        return "code-outline"
      case "webp":
        return "layers-outline"
      case "gif":
        return "film-outline"
      default:
        return "document-outline"
    }
  }

  return (
    <View style={styles.container}>
      {resultCount !== undefined && (
        <Text style={styles.resultsCount}>
          {resultCount} {resultCount === 1 ? "item" : "items"} found
        </Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterTab, currentFilter === filter.id && styles.activeFilterTab]}
            onPress={() => onFilterChange(filter.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={filter.icon || getIconForFilter(filter.id)}
              size={16}
              color={currentFilter === filter.id ? "#007AFF" : "#666"}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterTabText, currentFilter === filter.id && styles.activeFilterTabText]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12
  },
  scrollContent: {
    paddingRight: 16,
    paddingBottom: 4
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginBottom: 10,
    paddingHorizontal: 4
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    marginRight: 8,
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1
  },
  activeFilterTab: {
    backgroundColor: "#E6F2FF",
    shadowColor: "#007AFF",
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  filterIcon: {
    marginRight: 6
  },
  filterTabText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500"
  },
  activeFilterTabText: {
    color: "#007AFF",
    fontWeight: "600"
  }
})
