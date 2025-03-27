import React, {useRef, useState, useCallback} from "react"
import {View, ViewabilityConfig, ViewToken, FlatList, ListRenderItemInfo} from "react-native"
import {FlashList} from "@shopify/flash-list"

// Extend ViewToken type to include percentVisible property
interface EnhancedViewToken extends ViewToken {
  percentVisible?: number
}

// Extended render item info with visibility properties
export interface EnhancedRenderItemInfo<ItemT> extends ListRenderItemInfo<ItemT> {
  isVisible?: boolean
  viewableArea?: number
}

// Configuration for viewability tracking
const DEFAULT_VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50, // Item is considered visible when 50% is visible
  minimumViewTime: 1000, // Need to be visible for at least 1 second
  waitForInteraction: false // Don't wait for user interaction
}

interface ViewabilityTrackedState {
  viewableItems: Map<string, {isViewable: boolean; viewablePercentage: number}>
}

// Higher-Order Component to add viewability tracking to FlatList
export function withViewabilityTracking<T>(WrappedComponent: React.ComponentType<any>) {
  return React.forwardRef(function ViewabilityTrackedComponent(
    props: {
      itemKeyExtractor: (item: T) => string
      onItemVisibilityChanged?: (itemKey: string, isVisible: boolean, visiblePercentage: number) => void
      customViewabilityConfig?: ViewabilityConfig
      flatListProps: any
    },
    ref
  ) {
    const {
      itemKeyExtractor,
      onItemVisibilityChanged,
      customViewabilityConfig,
      flatListProps: originalFlatListProps,
      ...otherProps
    } = props

    // Extract the key prop to avoid the React key warning
    const {key, ...flatListProps} = originalFlatListProps

    const viewabilityConfig = useRef(customViewabilityConfig || DEFAULT_VIEWABILITY_CONFIG)
    const [viewabilityState, setViewabilityState] = useState<ViewabilityTrackedState>({
      viewableItems: new Map()
    })

    // Handle changes in which items are viewable
    const onViewableItemsChanged = useCallback(
      ({viewableItems, changed}: {viewableItems: EnhancedViewToken[]; changed: EnhancedViewToken[]}) => {
        // Update the viewability state
        setViewabilityState(prevState => {
          const newViewableItems = new Map(prevState.viewableItems)

          // Process changes first
          changed.forEach(token => {
            const itemKey = itemKeyExtractor(token.item)
            if (token.isViewable) {
              // Calculate percentage of item that's visible (if available)
              const viewablePercentage = token.percentVisible !== undefined ? token.percentVisible : 1

              // Update map with new viewability state
              newViewableItems.set(itemKey, {
                isViewable: true,
                viewablePercentage
              })

              // Notify via callback if provided
              if (onItemVisibilityChanged) {
                onItemVisibilityChanged(itemKey, true, viewablePercentage)
              }
            } else {
              // Item is no longer viewable
              if (newViewableItems.has(itemKey)) {
                newViewableItems.set(itemKey, {
                  isViewable: false,
                  viewablePercentage: 0
                })

                // Notify via callback if provided
                if (onItemVisibilityChanged) {
                  onItemVisibilityChanged(itemKey, false, 0)
                }
              }
            }
          })

          return {viewableItems: newViewableItems}
        })
      },
      [itemKeyExtractor, onItemVisibilityChanged]
    )

    // Create a ref to the viewability configuration
    const viewabilityConfigCallbackPairs = useRef([
      {viewabilityConfig: viewabilityConfig.current, onViewableItemsChanged}
    ])

    // Enhance renderItem to inject viewability props
    const enhancedRenderItem = useCallback(
      (info: ListRenderItemInfo<T>) => {
        const originalRenderItem = flatListProps.renderItem
        if (!originalRenderItem) return null

        // Extract the key for this item
        const itemKey = itemKeyExtractor(info.item)

        // Get the viewability state for this item
        const itemViewability = viewabilityState.viewableItems.get(itemKey) || {
          isViewable: false,
          viewablePercentage: 0
        }

        // Call the original renderItem with additional props
        // Using type assertion to work around TypeScript's type checking
        return originalRenderItem({
          ...info,
          isVisible: itemViewability.isViewable,
          viewableArea: itemViewability.viewablePercentage
        } as EnhancedRenderItemInfo<T>)
      },
      [flatListProps.renderItem, itemKeyExtractor, viewabilityState.viewableItems]
    )

    return (
      <WrappedComponent
        {...otherProps}
        {...flatListProps}
        key={key}
        renderItem={enhancedRenderItem}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        ref={ref}
      />
    )
  })
}

// Higher-Order Component specifically for FlashList
export function withFlashListViewabilityTracking<T>(WrappedComponent: React.ComponentType<any>) {
  return React.forwardRef(function ViewabilityTrackedFlashList(
    props: {
      itemKeyExtractor: (item: T) => string
      onItemVisibilityChanged?: (itemKey: string, isVisible: boolean, visiblePercentage: number) => void
      customViewabilityConfig?: ViewabilityConfig
      flashListProps: any
    },
    ref: any
  ) {
    const {itemKeyExtractor, onItemVisibilityChanged, customViewabilityConfig, flashListProps, ...otherProps} = props

    const viewabilityConfig = useRef(customViewabilityConfig || DEFAULT_VIEWABILITY_CONFIG)
    const [viewabilityState, setViewabilityState] = useState<ViewabilityTrackedState>({
      viewableItems: new Map()
    })

    // Handle changes in which items are viewable
    const onViewableItemsChanged = useCallback(
      ({viewableItems, changed}: {viewableItems: EnhancedViewToken[]; changed: EnhancedViewToken[]}) => {
        // Update the viewability state
        setViewabilityState(prevState => {
          const newViewableItems = new Map(prevState.viewableItems)

          // Process changes first
          changed.forEach(token => {
            const itemKey = itemKeyExtractor(token.item)
            if (token.isViewable) {
              // Calculate percentage of item that's visible (if available)
              const viewablePercentage = token.percentVisible !== undefined ? token.percentVisible : 1

              // Update map with new viewability state
              newViewableItems.set(itemKey, {
                isViewable: true,
                viewablePercentage
              })

              // Notify via callback if provided
              if (onItemVisibilityChanged) {
                onItemVisibilityChanged(itemKey, true, viewablePercentage)
              }
            } else {
              // Item is no longer viewable
              if (newViewableItems.has(itemKey)) {
                newViewableItems.set(itemKey, {
                  isViewable: false,
                  viewablePercentage: 0
                })

                // Notify via callback if provided
                if (onItemVisibilityChanged) {
                  onItemVisibilityChanged(itemKey, false, 0)
                }
              }
            }
          })

          return {viewableItems: newViewableItems}
        })
      },
      [itemKeyExtractor, onItemVisibilityChanged]
    )

    // Create a ref to the viewability configuration
    const viewabilityConfigCallbackPairs = useRef([
      {viewabilityConfig: viewabilityConfig.current, onViewableItemsChanged}
    ])

    // Enhance renderItem to inject viewability props
    const enhancedRenderItem = useCallback(
      (info: any) => {
        const originalRenderItem = flashListProps.renderItem
        if (!originalRenderItem) return null

        // Extract the key for this item
        const itemKey = itemKeyExtractor(info.item)

        // Get the viewability state for this item
        const itemViewability = viewabilityState.viewableItems.get(itemKey) || {
          isViewable: false,
          viewablePercentage: 0
        }

        // Call the original renderItem with additional props
        return originalRenderItem({
          ...info,
          isVisible: itemViewability.isViewable,
          viewableArea: itemViewability.viewablePercentage
        })
      },
      [flashListProps.renderItem, itemKeyExtractor, viewabilityState.viewableItems]
    )

    const {key, ...restFlashListProps} = flashListProps

    return (
      <WrappedComponent
        key={key}
        {...otherProps}
        {...restFlashListProps}
        renderItem={enhancedRenderItem}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        ref={ref}
      />
    )
  })
}

// Pre-wrapped components for convenience
export const ViewabilityTrackedFlatList = withViewabilityTracking(FlatList)
export const ViewabilityTrackedFlashList = withFlashListViewabilityTracking(FlashList)

export default withViewabilityTracking
