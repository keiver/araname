import React, {useCallback, useState, useEffect} from "react"
import {View, StyleSheet, ScrollView, Dimensions, LayoutChangeEvent, ViewStyle} from "react-native"

interface MasonryGridProps<T> {
  data: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  numColumns: number
  spacing: number
  containerStyle?: ViewStyle
}

const {width} = Dimensions.get("window")

export function MasonryGrid<T>({data, renderItem, numColumns = 2, spacing = 10, containerStyle}: MasonryGridProps<T>) {
  // Initialize columns to track heights
  const [columns, setColumns] = useState<T[][]>(Array.from({length: numColumns}, () => []))
  const [columnHeights, setColumnHeights] = useState<number[]>(Array.from({length: numColumns}, () => 0))
  const [contentWidth, setContentWidth] = useState(width)

  // Reset when data or columns change
  useEffect(() => {
    distributeItems()
  }, [data, numColumns])

  // Handle layout changes
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const {width: newWidth} = event.nativeEvent.layout
    setContentWidth(newWidth)
  }, [])

  // Distribute items among columns
  const distributeItems = useCallback(() => {
    // Reset columns
    const newColumns: T[][] = Array.from({length: numColumns}, () => [])
    const newHeights: number[] = Array.from({length: numColumns}, () => 0)

    // Distribute items based on a greedy algorithm
    data.forEach(item => {
      // Find the column with the smallest height
      const columnIndex = newHeights.indexOf(Math.min(...newHeights))

      // Add item to that column
      newColumns[columnIndex].push(item)

      // Estimate the height (could be improved with actual item heights)
      // For now we're using a simplified approach
      const estimatedHeight = 200 // Base height
      newHeights[columnIndex] += estimatedHeight
    })

    setColumns(newColumns)
    setColumnHeights(newHeights)
  }, [data, numColumns])

  // Calculate column width
  const columnWidth = (contentWidth - spacing * (numColumns + 1)) / numColumns

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, containerStyle]}
      onLayout={handleLayout}
    >
      <View style={styles.columnsContainer}>
        {columns.map((column, columnIndex) => (
          <View
            key={`column_${columnIndex}`}
            style={[
              styles.column,
              {
                width: columnWidth,
                marginLeft: spacing
              }
            ]}
          >
            {column.map((item, itemIndex) => (
              <View key={`item_${columnIndex}_${itemIndex}`} style={{marginBottom: spacing}}>
                {renderItem(item, data.indexOf(item))}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingTop: 10,
    paddingBottom: 20
  },
  columnsContainer: {
    flexDirection: "row"
  },
  column: {
    flexDirection: "column"
  }
})
